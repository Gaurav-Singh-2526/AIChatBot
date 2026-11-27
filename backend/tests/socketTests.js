const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const User = require("../models/user");
const Chatbot = require("../models/chatbot");
const Chat = require("../models/chat");
const Message = require("../models/message");
const UsageLog = require("../models/usageLog");
const ollamaServices = require("../services/ollamaServices");
const classificationService = require("../services/classificationService");

let streamCalls = 0;

ollamaServices.generateAIStream = async () => {
  streamCalls += 1;
  const { Readable } = require("stream");
  return Readable.from([
    JSON.stringify({ message: { content: "Socket " }, done: false }) + "\n",
    JSON.stringify({ message: { content: "stream!" }, done: true }) + "\n"
  ]);
};

classificationService.classifyQuestion = async ({ question }) => {
  if (/pizza/i.test(question)) {
    return { classification: "OUT_OF_DOMAIN", reason: "Off-topic" };
  }
  return { classification: "IN_DOMAIN", reason: "On-topic" };
};

const app = require("../server");
const { initSocketServer } = require("../services/socketService");
const { io: ioClient } = require("../../frontend/node_modules/socket.io-client");

async function runSocketTests() {
  const userId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  const botId = new mongoose.Types.ObjectId();
  const chatId = new mongoose.Types.ObjectId();

  User.findById = async (id) =>
    String(id) === String(userId)
      ? {
          _id: userId,
          name: "Socket User",
          email: "socket@test.com",
          role: "user",
          isActive: true,
          selectedChatbotId: botId
        }
      : null;

  Chatbot.findById = async (id) =>
    String(id) === String(botId)
      ? {
          _id: botId,
          name: "Programming Assistant",
          systemPrompt: "SYSTEM",
          allowedTopics: ["programming"],
          restrictedTopics: ["cooking"],
          model: "qwen2.5:3b",
          isActive: true,
          isDeleted: false
        }
      : null;

  Chat.findOne = async (filter) =>
    String(filter?._id) === String(chatId) &&
    String(filter?.userId) === String(userId)
      ? {
          _id: chatId,
          userId,
          chatbotId: botId,
          title: "New Chat",
          model: "qwen2.5:3b",
          save: async () => {}
        }
      : null;

  Chat.updateOne = async () => ({ acknowledged: true });
  Message.create = async (doc) => ({
    ...doc,
    _id: new mongoose.Types.ObjectId(),
    createdAt: new Date()
  });
  Message.find = () => ({
    sort: () => ({
      limit: () => ({
        lean: async () => []
      })
    })
  });
  UsageLog.create = async () => ({});

  const httpServer = http.createServer(app);
  const ioServer = initSocketServer(httpServer);
  await new Promise((r) => httpServer.listen(0, "127.0.0.1", r));
  const port = httpServer.address().port;
  const url = `http://127.0.0.1:${port}`;

  const validToken = jwt.sign({ id: userId }, process.env.JWT_SECRET);
  const unknownUserToken = jwt.sign({ id: otherUserId }, process.env.JWT_SECRET);

  try {
    // 1. Unauthenticated socket is rejected
    await new Promise((resolve, reject) => {
      const s = ioClient(url, {
        transports: ["websocket"],
        reconnection: false
      });
      s.on("connect", () => {
        s.disconnect();
        reject(new Error("Unauthenticated socket should not connect"));
      });
      s.on("connect_error", (err) => {
        assert(err.message.includes("Authentication error"));
        s.disconnect();
        resolve();
      });
    });
    console.log("PASS: Unauthenticated Socket.IO handshake rejected");

    // 2. Inactive/unknown user JWT rejected
    await new Promise((resolve, reject) => {
      const s = ioClient(url, {
        auth: { token: unknownUserToken },
        transports: ["websocket"],
        reconnection: false
      });
      s.on("connect", () => {
        s.disconnect();
        reject(new Error("Unknown user socket should not connect"));
      });
      s.on("connect_error", (err) => {
        assert(err.message.includes("Authentication error"));
        s.disconnect();
        resolve();
      });
    });
    console.log("PASS: Unknown/inactive user JWT rejected on Socket.IO");

    // 3. Authenticated socket connects and handles OUT_OF_DOMAIN without invoking stream model
    const client = ioClient(url, {
      auth: { token: validToken },
      transports: ["websocket"],
      reconnection: false
    });
    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    const beforeCalls = streamCalls;
    const outResult = await new Promise((resolve) => {
      client.once("chat:done", resolve);
      client.emit("chat:send", {
        requestId: "req-out",
        chatId: String(chatId),
        content: "How to make pizza?"
      });
    });
    assert.strictEqual(outResult.rejected, true);
    assert.strictEqual(outResult.classification.status, "OUT_OF_DOMAIN");
    assert.strictEqual(streamCalls, beforeCalls);
    console.log("PASS: Socket OUT_OF_DOMAIN rejected without calling answer stream");

    // 4. Authenticated socket streams IN_DOMAIN chunks
    const chunks = [];
    const inResult = await new Promise((resolve) => {
      const onChunk = (p) => chunks.push(p.content);
      client.on("chat:chunk", onChunk);
      client.once("chat:done", (donePayload) => {
        client.off("chat:chunk", onChunk);
        resolve(donePayload);
      });
      client.emit("chat:send", {
        requestId: "req-in",
        chatId: String(chatId),
        content: "Explain Java inheritance"
      });
    });
    assert.strictEqual(streamCalls, beforeCalls + 1);
    assert.strictEqual(chunks.join(""), "Socket stream!");
    assert.strictEqual(inResult.content, "Socket stream!");
    console.log("PASS: Socket IN_DOMAIN emits chat:start, chat:chunk, and chat:done");

    client.disconnect();
    console.log("\nALL SOCKET.IO TESTS PASSED!");
  } finally {
    ioServer.close();
    httpServer.close();
  }
}

runSocketTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SOCKET TESTS FAILED:", err);
    process.exit(1);
  });
