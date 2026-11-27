const mongoose = require("mongoose");

const Chat = require("../models/chat");
const Message = require("../models/message");
const { generateAIResponse } = require("../services/ollamaServices");
const { classifyQuestion } = require("../services/classificationService");
const {
  resolveChatbotForChat,
  buildOutOfDomainMessage,
  buildAmbiguousMessage,
  buildConversationMessages,
  recordUsageLog
} = require("../services/chatServices");

// 1. Send message and get domain-classified AI response
exports.sendMessage = async (req, res) => {
  const startedAt = Date.now();
  let chat = null;
  let chatbot = null;
  let userMessage = null;

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

    const selectedModel =
      chatbot.model || chat.model || process.env.OLLAMA_MODEL || "qwen2.5:3b";

    // Classify question BEFORE generating an answer
    let classificationResult;
    try {
      classificationResult = await classifyQuestion({
        chatbot,
        question: userContent
      });
    } catch (classifyErr) {
      console.error(
        "Classification Ollama Error:",
        classifyErr.response?.data || classifyErr.message
      );
      await recordUsageLog({
        userId: req.user._id,
        chatbotId: chatbot._id || null,
        chatId: chat._id,
        action: "chat_message",
        model: selectedModel,
        responseTimeMs: Date.now() - startedAt,
        success: false,
        errorMessage: classifyErr.message
      });
      return res.status(502).json({
        success: false,
        message: "AI service is unavailable. Please check Ollama and try again."
      });
    }

    const classificationMeta = {
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

    // Handle OUT_OF_DOMAIN or AMBIGUOUS without invoking answer generation
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
        action: "chat_message",
        classificationStatus: classificationMeta.status,
        model: selectedModel,
        responseTimeMs: Date.now() - startedAt,
        success: true
      });

      return res.status(201).json({
        success: true,
        message: "Question classified and handled",
        classification: classificationMeta,
        model: selectedModel,
        userMessage,
        assistantMessage
      });
    }

    // IN_DOMAIN: load domain systemPrompt + chat-scoped history and generate answer
    const messages = await buildConversationMessages({
      chatId: chat._id,
      userId: req.user._id,
      chatbot
    });

    let aiContent;
    try {
      aiContent = await generateAIResponse({
        model: selectedModel,
        messages
      });
    } catch (ollamaError) {
      console.error(
        "Ollama Error:",
        ollamaError.response?.data || ollamaError.message
      );
      await recordUsageLog({
        userId: req.user._id,
        chatbotId: chatbot._id || null,
        chatId: chat._id,
        action: "chat_message",
        classificationStatus: "IN_DOMAIN",
        model: selectedModel,
        responseTimeMs: Date.now() - startedAt,
        success: false,
        errorMessage: ollamaError.message
      });
      return res.status(502).json({
        success: false,
        message: "AI service is unavailable. Please check Ollama and try again.",
        userMessageId: userMessage._id
      });
    }

    const assistantMessage = await Message.create({
      chatId: chat._id,
      userId: req.user._id,
      role: "assistant",
      content: aiContent,
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
      action: "chat_message",
      classificationStatus: "IN_DOMAIN",
      model: selectedModel,
      responseTimeMs: Date.now() - startedAt,
      success: true
    });

    return res.status(201).json({
      success: true,
      message: "AI response generated successfully",
      classification: classificationMeta,
      model: selectedModel,
      userMessage,
      assistantMessage
    });
  } catch (error) {
    console.error("Send Message Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process message"
    });
  }
};

// 2. Get all messages of a chat
exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID"
      });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 50)
    );
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({
        chatId: chat._id,
        userId: req.user._id
      })
        .sort({ createdAt: 1, _id: 1 })
        .skip(skip)
        .limit(limit),

      Message.countDocuments({
        chatId: chat._id,
        userId: req.user._id
      })
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      messages
    });
  } catch (error) {
    console.error("Get message Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages"
    });
  }
};

// 3. Regenerate the latest assistant response in a chat
exports.regenerateMessage = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { chatId } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID"
      });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    let chatbot;
    try {
      chatbot = await resolveChatbotForChat(chat, req.user);
    } catch (domainErr) {
      return res.status(domainErr.statusCode || 400).json({
        success: false,
        message: domainErr.message
      });
    }

    const lastUserMessage = await Message.findOne({
      chatId: chat._id,
      userId: req.user._id,
      role: "user"
    }).sort({ createdAt: -1, _id: -1 });

    if (!lastUserMessage) {
      return res.status(400).json({
        success: false,
        message: "No user message found to regenerate"
      });
    }

    // Remove trailing assistant messages after the last user message
    await Message.deleteMany({
      chatId: chat._id,
      userId: req.user._id,
      role: "assistant",
      createdAt: { $gte: lastUserMessage.createdAt }
    });

    const selectedModel =
      chatbot.model || chat.model || process.env.OLLAMA_MODEL || "qwen2.5:3b";

    const classificationResult = await classifyQuestion({
      chatbot,
      question: lastUserMessage.content
    });

    const classificationMeta = {
      status: classificationResult.classification,
      reason: classificationResult.reason
    };

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

      await recordUsageLog({
        userId: req.user._id,
        chatbotId: chatbot._id || null,
        chatId: chat._id,
        messageId: assistantMessage._id,
        action: "regenerate",
        classificationStatus: classificationMeta.status,
        model: selectedModel,
        responseTimeMs: Date.now() - startedAt,
        success: true
      });

      return res.status(200).json({
        success: true,
        classification: classificationMeta,
        assistantMessage
      });
    }

    const messages = await buildConversationMessages({
      chatId: chat._id,
      userId: req.user._id,
      chatbot
    });

    const aiContent = await generateAIResponse({
      model: selectedModel,
      messages
    });

    const assistantMessage = await Message.create({
      chatId: chat._id,
      userId: req.user._id,
      role: "assistant",
      content: aiContent,
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
      action: "regenerate",
      classificationStatus: "IN_DOMAIN",
      model: selectedModel,
      responseTimeMs: Date.now() - startedAt,
      success: true
    });

    return res.status(200).json({
      success: true,
      classification: classificationMeta,
      model: selectedModel,
      assistantMessage
    });
  } catch (error) {
    console.error("Regenerate Error:", error.message);
    return res.status(502).json({
      success: false,
      message: "Failed to regenerate response"
    });
  }
};
