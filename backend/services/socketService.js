const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const readline = require("readline");

const User = require("../models/user");
const Chat = require("../models/chat");
const Message = require("../models/message");
const { generateAIStream } = require("./ollamaServices");
const { classifyQuestion } = require("./classificationService");
const {
  resolveChatbotForChat,
  buildOutOfDomainMessage,
  buildAmbiguousMessage,
  buildConversationMessages,
  recordUsageLog
} = require("./chatServices");

const SOCKET_WINDOW_MS = 60 * 1000;
const SOCKET_MAX_MESSAGES = 40;

function createSocketRateChecker() {
  const hits = new Map();
  return (userId) => {
    const key = String(userId);
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + SOCKET_WINDOW_MS });
      return true;
    }
    entry.count += 1;
    return entry.count <= SOCKET_MAX_MESSAGES;
  };
}

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"]
    }
  });

  const allowMessage = createSocketRateChecker();

  // Secure JWT authentication middleware for every socket handshake
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const bearerToken =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ")
          ? authHeader.split(" ")[1]
          : null;
      const token = socket.handshake.auth?.token || bearerToken;

      if (!token) {
        return next(new Error("Authentication error: missing token"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        return next(new Error("Authentication error: user not found or inactive"));
      }

      socket.user = user;
      return next();
    } catch (_error) {
      return next(new Error("Authentication error: invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userRoom = `user:${socket.user._id}`;
    socket.join(userRoom);

    const activeStreams = new Map();

    socket.on("chat:stop", ({ requestId } = {}) => {
      if (requestId && activeStreams.has(requestId)) {
        const controller = activeStreams.get(requestId);
        controller.abort();
        activeStreams.delete(requestId);
      }
    });

    socket.on("chat:send", async (payload = {}) => {
      const startedAt = Date.now();
      const requestId =
        typeof payload.requestId === "string" && payload.requestId.trim()
          ? payload.requestId.trim()
          : `req-${Date.now()}`;

      const abortController = new AbortController();
      activeStreams.set(requestId, abortController);

      let chat = null;
      let chatbot = null;
      let selectedModel = null;
      let classificationMeta = null;

      try {
        if (!allowMessage(socket.user._id)) {
          socket.emit("chat:error", {
            requestId,
            message: "Too many messages sent. Please slow down."
          });
          return;
        }

        const { chatId, content } = payload;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
          socket.emit("chat:error", {
            requestId,
            message: "Invalid chat ID"
          });
          return;
        }

        if (typeof content !== "string" || !content.trim()) {
          socket.emit("chat:error", {
            requestId,
            message: "Message content is required"
          });
          return;
        }

        const userContent = content.trim();
        if (userContent.length > 20000) {
          socket.emit("chat:error", {
            requestId,
            message: "Message cannot exceed 20000 characters"
          });
          return;
        }

        chat = await Chat.findOne({
          _id: chatId,
          userId: socket.user._id
        });

        if (!chat) {
          socket.emit("chat:error", {
            requestId,
            message: "Chat not found"
          });
          return;
        }

        try {
          chatbot = await resolveChatbotForChat(chat, socket.user);
        } catch (domainErr) {
          socket.emit("chat:error", {
            requestId,
            message: domainErr.message
          });
          return;
        }

        selectedModel =
          chatbot.model || chat.model || process.env.OLLAMA_MODEL || "qwen2.5:3b";

        // Classify BEFORE starting answer generation
        const classificationResult = await classifyQuestion({
          chatbot,
          question: userContent,
          signal: abortController.signal
        });

        if (abortController.signal.aborted) {
          return;
        }

        classificationMeta = {
          status: classificationResult.classification,
          reason: classificationResult.reason
        };

        const userMessage = await Message.create({
          chatId: chat._id,
          userId: socket.user._id,
          role: "user",
          content: userContent,
          classification: classificationMeta
        });

        if (chat.title === "New Chat") {
          chat.title = userContent.slice(0, 40);
          await chat.save();
        }

        socket.emit("chat:start", {
          requestId,
          chatId: String(chat._id),
          model: selectedModel,
          chatbotId: chatbot._id || null,
          chatbotName: chatbot.name,
          userMessageId: userMessage._id,
          classification: classificationMeta
        });

        // Structured rejection / clarification without starting AI answer stream
        if (classificationResult.classification !== "IN_DOMAIN") {
          const responseText =
            classificationResult.classification === "OUT_OF_DOMAIN"
              ? buildOutOfDomainMessage(chatbot)
              : buildAmbiguousMessage();

          const assistantMessage = await Message.create({
            chatId: chat._id,
            userId: socket.user._id,
            role: "assistant",
            content: responseText,
            classification: classificationMeta,
            model: null
          });

          await Chat.updateOne(
            { _id: chat._id, userId: socket.user._id },
            { $set: { updatedAt: new Date() } }
          );

          await recordUsageLog({
            userId: socket.user._id,
            chatbotId: chatbot._id || null,
            chatId: chat._id,
            messageId: assistantMessage._id,
            action: "stream_message",
            classificationStatus: classificationMeta.status,
            model: selectedModel,
            responseTimeMs: Date.now() - startedAt,
            success: true
          });

          socket.emit("chat:done", {
            requestId,
            assistantMessageId: assistantMessage._id,
            content: responseText,
            classification: classificationMeta,
            rejected: classificationResult.classification === "OUT_OF_DOMAIN",
            clarification: classificationResult.classification === "AMBIGUOUS"
          });
          return;
        }

        // IN_DOMAIN: load chatbot system prompt + chat-scoped history
        const messages = await buildConversationMessages({
          chatId: chat._id,
          userId: socket.user._id,
          chatbot
        });

        const stream = await generateAIStream({
          model: selectedModel,
          messages,
          signal: abortController.signal
        });

        let assistantContent = "";
        const reader = readline.createInterface({
          input: stream,
          crlfDelay: Infinity
        });

        for await (const line of reader) {
          if (abortController.signal.aborted) break;
          if (!line.trim()) continue;

          const data = JSON.parse(line);
          const chunk = data.message?.content || "";
          if (chunk) {
            assistantContent += chunk;
            socket.emit("chat:chunk", {
              requestId,
              content: chunk
            });
          }

          if (data.error) {
            throw new Error(data.error);
          }
          if (data.done) break;
        }

        // Never persist a partial response when stopped/disconnected
        if (abortController.signal.aborted) {
          return;
        }

        if (!assistantContent.trim()) {
          throw new Error("Ollama returned an empty response");
        }

        const assistantMessage = await Message.create({
          chatId: chat._id,
          userId: socket.user._id,
          role: "assistant",
          content: assistantContent,
          classification: classificationMeta,
          model: selectedModel
        });

        await Chat.updateOne(
          { _id: chat._id, userId: socket.user._id },
          { $set: { updatedAt: new Date() } }
        );

        await recordUsageLog({
          userId: socket.user._id,
          chatbotId: chatbot._id || null,
          chatId: chat._id,
          messageId: assistantMessage._id,
          action: "stream_message",
          classificationStatus: "IN_DOMAIN",
          model: selectedModel,
          responseTimeMs: Date.now() - startedAt,
          success: true
        });

        socket.emit("chat:done", {
          requestId,
          assistantMessageId: assistantMessage._id,
          content: assistantContent,
          classification: classificationMeta
        });
      } catch (error) {
        if (abortController.signal.aborted || error.name === "CanceledError") {
          return;
        }

        console.error("Socket Streaming Error:", error.message);

        if (chat) {
          await recordUsageLog({
            userId: socket.user._id,
            chatbotId: chatbot?._id || null,
            chatId: chat._id,
            action: "stream_message",
            classificationStatus: classificationMeta?.status || null,
            model: selectedModel || null,
            responseTimeMs: Date.now() - startedAt,
            success: false,
            errorMessage: error.message
          });
        }

        socket.emit("chat:error", {
          requestId,
          message: "Unable to complete AI response. Please check Ollama and try again."
        });
      } finally {
        activeStreams.delete(requestId);
      }
    });

    socket.on("disconnect", () => {
      for (const controller of activeStreams.values()) {
        controller.abort();
      }
      activeStreams.clear();
    });
  });

  return io;
}

module.exports = { initSocketServer };
