const Chatbot = require("../models/chatbot");
const Message = require("../models/message");
const UsageLog = require("../models/usageLog");

const DEFAULT_FALLBACK_DOMAIN = {
  _id: null,
  name: "General Assistant",
  description: "Helpful assistant for general questions.",
  systemPrompt:
    "You are a helpful AI assistant. Give clear, accurate and useful answers.",
  allowedTopics: ["general assistance", "questions and explanations"],
  restrictedTopics: [],
  model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
  
  isActive: true,
  isDeleted: false
};

/**
 * Resolves the effective Chatbot configuration for a chat.
 * - If chat.chatbotId exists, strictly uses that chatbot and requires it to be active & not deleted.
 * - If chat.chatbotId is null (legacy chat), falls back to user's active selectedChatbotId,
 *   then first active chatbot in DB, or built-in safe fallback if no chatbots exist yet.
 */
exports.resolveChatbotForChat = async (chat, user) => {
  if (chat.chatbotId) {
    const chatbot = await Chatbot.findById(chat.chatbotId);
    if (!chatbot || chatbot.isDeleted || !chatbot.isActive) {
      const err = new Error(
        "This assistant is inactive or no longer available. Please select an active assistant to start a new chat."
      );
      err.statusCode = 403;
      throw err;
    }
    return chatbot;
  }

  if (user?.selectedChatbotId) {
    const selected = await Chatbot.findOne({
      _id: user.selectedChatbotId,
      isActive: true,
      isDeleted: false
    });
    if (selected) return selected;
  }

  const firstActive = await Chatbot.findOne({
    isActive: true,
    isDeleted: false
  }).sort({ createdAt: 1 });

  return firstActive || DEFAULT_FALLBACK_DOMAIN;
};

exports.buildOutOfDomainMessage = (chatbot) => {
  const topics =
    Array.isArray(chatbot?.allowedTopics) && chatbot.allowedTopics.length > 0
      ? chatbot.allowedTopics.slice(0, 3).join(", ")
      : "my domain";
  return `Sorry! I am a ${chatbot?.name || "domain assistant"}. I can only help you with ${topics} and related topics. Please ask a question related to my domain.`;
};

exports.buildAmbiguousMessage = () =>
  "Could you please clarify your question so I can assist you correctly?";

/**
 * Loads recent conversation history strictly scoped to a single chat & user.
 * Excludes prior OUT_OF_DOMAIN refusals so rejected turns don't pollute LLM context.
 */
exports.buildConversationMessages = async ({ chatId, userId, chatbot }) => {
  const history = await Message.find({
    chatId,
    userId
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(20)
    .lean();

  history.reverse();

  const filteredHistory = history.filter(
    (msg) => msg.classification?.status !== "OUT_OF_DOMAIN"
  );

  return [
    {
      role: "system",
      content: chatbot.systemPrompt
    },
    ...filteredHistory.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))
  ];
};

exports.recordUsageLog = async ({
  userId,
  chatbotId = null,
  chatId = null,
  messageId = null,
  action = "chat_message",
  classificationStatus = null,
  model = null,
  responseTimeMs = 0,
  success = true,
  errorMessage = null
}) => {
  try {
    await UsageLog.create({
      userId,
      chatbotId,
      chatId,
      messageId,
      action,
      classificationStatus,
      model,
      responseTimeMs: Math.max(0, Math.round(responseTimeMs)),
      success,
      errorMessage
    });
  } catch (err) {
    console.error("Failed to record UsageLog:", err.message);
  }
};
