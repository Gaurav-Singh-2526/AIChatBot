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
const Feedback = require("../models/feedback");
const ollamaServices = require("../services/ollamaServices");
const classificationService = require("../services/classificationService");

// Stub Ollama services BEFORE loading app/controllers
let answerModelCalls = 0;
let streamModelCalls = 0;

ollamaServices.generateAIResponse = async ({ format }) => {
  if (format === "json") {
    return JSON.stringify({
      classification: "IN_DOMAIN",
      reason: "Stubbed JSON classification"
    });
  }
  answerModelCalls += 1;
  return "Mocked domain answer.";
};

ollamaServices.generateAIStream = async () => {
  streamModelCalls += 1;
  const { Readable } = require("stream");
  return Readable.from([
    JSON.stringify({ message: { content: "Hello " }, done: false }) + "\n",
    JSON.stringify({ message: { content: "world!" }, done: true }) + "\n"
  ]);
};

classificationService.classifyQuestion = async ({ question }) => {
  if (/pizza|capital/i.test(question)) {
    return {
      classification: "OUT_OF_DOMAIN",
      reason: "Unrelated topic"
    };
  }
  if (/help me/i.test(question)) {
    return {
      classification: "AMBIGUOUS",
      reason: "Too vague"
    };
  }
  return {
    classification: "IN_DOMAIN",
    reason: "Matches domain"
  };
};

const app = require("../server");

function jsonRequest(server, method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, raw, json: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, raw, json: null });
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runControllerTests() {
  const userId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const progBotId = new mongoose.Types.ObjectId();
  const inactiveBotId = new mongoose.Types.ObjectId();
  const progChatId = new mongoose.Types.ObjectId();
  const legacyChatId = new mongoose.Types.ObjectId();

  const normalUser = {
    _id: userId,
    name: "Normal User",
    email: "user@test.com",
    role: "user",
    isActive: true,
    selectedChatbotId: progBotId
  };

  const adminUser = {
    _id: adminId,
    name: "Admin User",
    email: "admin@test.com",
    role: "admin",
    isActive: true,
    selectedChatbotId: progBotId
  };

  const progBot = {
    _id: progBotId,
    name: "Programming Assistant",
    slug: "programming-assistant",
    description: "Helps with programming",
    systemPrompt: "SECRET_SYSTEM_PROMPT",
    allowedTopics: ["python", "javascript"],
    restrictedTopics: ["cooking"],
    model: "qwen2.5:3b",
    isActive: true,
    isDeleted: false
  };

  const inactiveBot = {
    _id: inactiveBotId,
    name: "Retired Bot",
    slug: "retired-bot",
    description: "Inactive",
    systemPrompt: "SECRET",
    allowedTopics: ["other"],
    restrictedTopics: [],
    model: "qwen2.5:3b",
    isActive: false,
    isDeleted: false
  };

  const progChat = {
    _id: progChatId,
    userId,
    chatbotId: progBotId,
    title: "New Chat",
    model: "qwen2.5:3b",
    save: async () => progChat,
    populate: async () => progChat
  };

  const legacyChat = {
    _id: legacyChatId,
    userId,
    chatbotId: null,
    title: "Legacy Chat",
    model: "qwen2.5:3b",
    save: async () => legacyChat,
    populate: async () => legacyChat
  };

  // Patch Mongoose static methods for deterministic in-memory HTTP testing
  User.findById = async (id) => {
    if (String(id) === String(userId)) return normalUser;
    if (String(id) === String(adminId)) return adminUser;
    return null;
  };
  User.updateOne = async () => ({ acknowledged: true });
  User.updateMany = async () => ({ acknowledged: true });

  Chatbot.find = (filter) => {
    const bots =
      filter?.isActive === true ? [progBot] : [progBot, inactiveBot];
    return {
      select(fields) {
        const sanitized =
          fields === "-systemPrompt"
            ? bots.map(({ systemPrompt: _s, ...rest }) => rest)
            : bots;
        return {
          sort: async () => sanitized
        };
      },
      populate() {
        return {
          sort: async () => bots
        };
      }
    };
  };

  Chatbot.findOne = (filter) => {
    let match = null;
    if (filter?.slug === "programming-assistant") match = progBot;
    else if (
      String(filter?._id) === String(progBotId) &&
      filter?.isActive !== false &&
      filter?.isDeleted !== true
    ) {
      match = progBot;
    }
    return {
      select(fields) {
        if (!match) return Promise.resolve(null);
        if (fields === "-systemPrompt") {
          const { systemPrompt: _s, ...rest } = match;
          return Promise.resolve(rest);
        }
        return Promise.resolve(match);
      },
      then(resolve, reject) {
        return Promise.resolve(match).then(resolve, reject);
      }
    };
  };

  Chatbot.findById = async (id) => {
    if (String(id) === String(progBotId)) return progBot;
    if (String(id) === String(inactiveBotId)) return inactiveBot;
    return null;
  };

  Chat.findOne = (filter) => {
    let found = null;
    if (
      String(filter?._id) === String(progChatId) &&
      String(filter?.userId) === String(userId)
    ) {
      found = progChat;
    } else if (
      String(filter?._id) === String(legacyChatId) &&
      String(filter?.userId) === String(userId)
    ) {
      found = legacyChat;
    }
    return {
      populate: async () => found,
      then(resolve, reject) {
        return Promise.resolve(found).then(resolve, reject);
      }
    };
  };
  Chat.updateOne = async () => ({ acknowledged: true });
  Chat.create = async (doc) => ({
    ...doc,
    _id: new mongoose.Types.ObjectId(),
    populate: async () => doc
  });

  const savedMessages = [];
  Message.create = async (doc) => {
    const m = { ...doc, _id: new mongoose.Types.ObjectId(), createdAt: new Date() };
    savedMessages.push(m);
    return m;
  };
  Message.find = () => ({
    sort() {
      return {
        limit() {
          return {
            lean: async () => []
          };
        }
      };
    }
  });
  UsageLog.create = async () => ({});
  Feedback.findOneAndUpdate = async (_q, doc) => doc;

  const userToken = jwt.sign({ id: userId }, process.env.JWT_SECRET);
  const adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET);

  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));

  try {
    // 1. Normal user cannot access /api/admin/chatbots
    const r1 = await jsonRequest(server, "GET", "/api/admin/chatbots", {
      token: userToken
    });
    assert.strictEqual(r1.status, 403);
    console.log("PASS: Normal user gets 403 on /api/admin/chatbots");

    // 2. Admin can access /api/admin/chatbots
    const r2 = await jsonRequest(server, "GET", "/api/admin/chatbots", {
      token: adminToken
    });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.chatbots.length, 2);
    console.log("PASS: Admin gets 200 on /api/admin/chatbots");

    // 3. Normal user /api/chatbots hides systemPrompt and returns only active chatbots
    const r3 = await jsonRequest(server, "GET", "/api/chatbots", {
      token: userToken
    });
    assert.strictEqual(r3.status, 200);
    assert.strictEqual(r3.json.chatbots.length, 1);
    assert.strictEqual(r3.json.chatbots[0].systemPrompt, undefined);
    console.log("PASS: /api/chatbots omits systemPrompt and inactive bots");

    // 4. Duplicate slug rejected with 409 by Admin create
    const r4 = await jsonRequest(server, "POST", "/api/admin/chatbots", {
      token: adminToken,
      body: {
        name: "Programming Assistant",
        slug: "programming-assistant",
        description: "Desc",
        systemPrompt: "Prompt",
        allowedTopics: ["python"]
      }
    });
    assert.strictEqual(r4.status, 409);
    console.log("PASS: Duplicate slug rejected with 409");

    // 5. Inactive chatbot cannot be selected for new chats
    const r5 = await jsonRequest(server, "POST", "/api/chats", {
      token: userToken,
      body: { chatbotId: String(inactiveBotId) }
    });
    assert.strictEqual(r5.status, 400);
    console.log("PASS: Inactive chatbot rejected on POST /api/chats");

    // 6. User cannot access another user's chat
    const r6 = await jsonRequest(server, "GET", `/api/chats/${progChatId}`, {
      token: adminToken
    });
    assert.strictEqual(r6.status, 404);
    console.log("PASS: Another user's chat returns 404");

    // 7. OUT_OF_DOMAIN question does NOT invoke answer model (normal + stream)
    const beforeAnswerCalls = answerModelCalls;
    const beforeStreamCalls = streamModelCalls;

    const r7 = await jsonRequest(server, "POST", "/api/messages/send", {
      token: userToken,
      body: { chatId: String(progChatId), content: "How to make pizza?" }
    });
    assert.strictEqual(r7.status, 201);
    assert.strictEqual(r7.json.classification.status, "OUT_OF_DOMAIN");
    assert.strictEqual(answerModelCalls, beforeAnswerCalls);
    console.log("PASS: OUT_OF_DOMAIN on /api/messages/send skips answer model");

    const r8 = await jsonRequest(server, "POST", "/api/messages/stream", {
      token: userToken,
      body: { chatId: String(progChatId), content: "How to make pizza?" }
    });
    assert.strictEqual(r8.status, 200);
    assert.strictEqual(streamModelCalls, beforeStreamCalls);
    assert(r8.raw.includes('"rejected":true'));
    console.log("PASS: OUT_OF_DOMAIN on /api/messages/stream returns structured rejection without streaming answer");

    // 8. AMBIGUOUS returns clarification without invoking answer model
    const r9 = await jsonRequest(server, "POST", "/api/messages/send", {
      token: userToken,
      body: { chatId: String(progChatId), content: "Help me" }
    });
    assert.strictEqual(r9.status, 201);
    assert.strictEqual(r9.json.classification.status, "AMBIGUOUS");
    assert.strictEqual(answerModelCalls, beforeAnswerCalls);
    console.log("PASS: AMBIGUOUS returns clarification without invoking answer model");

    // 9. IN_DOMAIN calls answer model & stream model + legacy chat works!
    const r10 = await jsonRequest(server, "POST", "/api/messages/send", {
      token: userToken,
      body: { chatId: String(legacyChatId), content: "What is Python?" }
    });
    assert.strictEqual(r10.status, 201);
    assert.strictEqual(r10.json.classification.status, "IN_DOMAIN");
    assert.strictEqual(answerModelCalls, beforeAnswerCalls + 1);
    console.log("PASS: Legacy chat without chatbotId works through classification & answer generation");

    const r11 = await jsonRequest(server, "POST", "/api/messages/stream", {
      token: userToken,
      body: { chatId: String(progChatId), content: "Explain Java inheritance" }
    });
    assert.strictEqual(r11.status, 200);
    assert.strictEqual(streamModelCalls, beforeStreamCalls + 1);
    assert(r11.raw.includes('"type":"chunk"'));
    assert(r11.raw.includes('"type":"done"'));
    console.log("PASS: IN_DOMAIN NDJSON streaming emits start/chunk/done events");

    console.log("\nALL CONTROLLER & ROUTE TESTS PASSED!");
  } finally {
    server.close();
  }
}

runControllerTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("CONTROLLER TESTS FAILED:", err);
    process.exit(1);
  });
