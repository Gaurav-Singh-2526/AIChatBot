const mongoose = require("mongoose");
const readline = require("readline");

const Chat = require("../models/chat");
const Message = require("../models/message");
const { generateAIStream } = require("../services/ollamaServices");
const { classifyQuestion } = require("../services/classificationService");
const {
  resolveChatbotForChat,
  buildOutOfDomainMessage,
  buildAmbiguousMessage,
  buildConversationMessages,
  recordUsageLog
} = require("../services/chatServices");

exports.streamMessage = async (req, res) => {
  const startedAt = Date.now();
  let userMessage;
  let assistantContent = "";
  let stream;
  let chat;
  let chatbot;
  let selectedModel;
  let classificationMeta;

  const abortController = new AbortController();

  try {
    const { chatId, content } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID"
      });
    }

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content is required"
      });
    }

    const userContent = content.trim();

    if (userContent.length > 20000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 20000 characters"
      });
    }

    chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    try {
      chatbot = await resolveChatbotForChat(chat, req.user);
    } catch (domainErr) {
      return res.status(domainErr.statusCode || 400).json({
        success: false,
        message: domainErr.message
      });
    }

    selectedModel =
      chatbot.model || chat.model || process.env.OLLAMA_MODEL || "qwen2.5:3b";

    // Handle client disconnect during classification or streaming
    res.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    // Classify BEFORE starting Ollama answer stream
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

    // Save user message with classification metadata
    userMessage = await Message.create({
      chatId: chat._id,
      userId: req.user._id,
      role: "user",
      content: userContent,
      classification: classificationMeta
    });

    if (chat.title === "New Chat") {
      chat.title = userContent.slice(0, 40);
      await chat.save();
    }

    // Prepare NDJSON headers
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendEvent = (event) => {
      if (!res.destroyed && !res.writableEnded) {
        res.write(JSON.stringify(event) + "\n");
      }
    };

    sendEvent({
      type: "start",
      model: selectedModel,
      chatbotId: chatbot._id || null,
      chatbotName: chatbot.name,
      userMessageId: userMessage._id,
      classification: classificationMeta
    });

    // Structured rejection/clarification without starting AI answer stream
    if (classificationResult.classification !== "IN_DOMAIN") {
      const responseText =
        classificationResult.classification === "OUT_OF_DOMAIN"
          ? buildOutOfDomainMessage(chatbot)
          : buildAmbiguousMessage();

      const assistantMessage = await Message.create({
        chatId: chat._id,
        userId: req.user._id,
        role: "assistant",
        content: responseText,
        classification: classificationMeta,
        model: null
      });

      await Chat.updateOne(
        { _id: chat._id, userId: req.user._id },
        { $set: { updatedAt: new Date() } }
      );

      await recordUsageLog({
        userId: req.user._id,
        chatbotId: chatbot._id || null,
        chatId: chat._id,
        messageId: assistantMessage._id,
        action: "stream_message",
        classificationStatus: classificationMeta.status,
        model: selectedModel,
        responseTimeMs: Date.now() - startedAt,
        success: true
      });

      sendEvent({
        type: "done",
        assistantMessageId: assistantMessage._id,
        content: responseText,
        classification: classificationMeta,
        rejected: classificationResult.classification === "OUT_OF_DOMAIN",
        clarification: classificationResult.classification === "AMBIGUOUS"
      });

      return res.end();
    }

    // IN_DOMAIN: load chatbot system prompt + chat-scoped history
    const messages = await buildConversationMessages({
      chatId: chat._id,
      userId: req.user._id,
      chatbot
    });

    stream = await generateAIStream({
      model: selectedModel,
      messages,
      signal: abortController.signal
    });

    const reader = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    for await (const line of reader) {
      if (abortController.signal.aborted) {
        break;
      }

      if (!line.trim()) continue;

      const data = JSON.parse(line);
      const chunk = data.message?.content || "";

      if (chunk) {
        assistantContent += chunk;
        sendEvent({
          type: "chunk",
          content: chunk
        });
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.done) {
        break;
      }
    }

    // Do not save a partial answer after disconnection/cancellation
    if (abortController.signal.aborted) {
      return;
    }

    if (!assistantContent.trim()) {
      throw new Error("Ollama returned an empty response");
    }

    const assistantMessage = await Message.create({
      chatId: chat._id,
      userId: req.user._id,
      role: "assistant",
      content: assistantContent,
      classification: classificationMeta,
      model: selectedModel
    });

    await Chat.updateOne(
      { _id: chat._id, userId: req.user._id },
      { $set: { updatedAt: new Date() } }
    );

    await recordUsageLog({
      userId: req.user._id,
      chatbotId: chatbot._id || null,
      chatId: chat._id,
      messageId: assistantMessage._id,
      action: "stream_message",
      classificationStatus: "IN_DOMAIN",
      model: selectedModel,
      responseTimeMs: Date.now() - startedAt,
      success: true
    });

    sendEvent({
      type: "done",
      assistantMessageId: assistantMessage._id,
      content: assistantContent,
      classification: classificationMeta
    });

    res.end();
  } catch (error) {
    if (abortController.signal.aborted || error.name === "CanceledError") {
      return;
    }

    console.error("Streaming Error:", error.message);

    if (chat) {
      await recordUsageLog({
        userId: req.user._id,
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

    if (res.headersSent) {
      if (!res.destroyed && !res.writableEnded) {
        res.write(
          JSON.stringify({
            type: "error",
            message: "AI streaming failed"
          }) + "\n"
        );
        res.end();
      }
    } else {
      res.status(502).json({
        success: false,
        message: "Unable to connect to AI service"
      });
    }
  }
};
