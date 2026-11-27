const mongoose = require("mongoose");
const Chat = require("../models/chat");
const Chatbot = require("../models/chatbot");
const Message = require("../models/message");

exports.createChat = async (req, res) => {
  try {
    const { title, model, chatbotId } = req.body || {};

    let resolvedChatbot = null;

    if (chatbotId !== undefined && chatbotId !== null && chatbotId !== "") {
      if (!mongoose.Types.ObjectId.isValid(chatbotId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid chatbot ID"
        });
      }
      resolvedChatbot = await Chatbot.findOne({
        _id: chatbotId,
        isActive: true,
        isDeleted: false
      }).select("-systemPrompt");

      if (!resolvedChatbot) {
        return res.status(400).json({
          success: false,
          message: "Selected chatbot is inactive, deleted, or does not exist"
        });
      }
    } else if (req.user.selectedChatbotId) {
      resolvedChatbot = await Chatbot.findOne({
        _id: req.user.selectedChatbotId,
        isActive: true,
        isDeleted: false
      }).select("-systemPrompt");

      if (!resolvedChatbot) {
        return res.status(400).json({
          success: false,
          message:
            "Your selected chatbot is inactive or unavailable. Please select an active chatbot."
        });
      }
    } else {
      // Backward-compatible fallback: use first active chatbot if one exists
      resolvedChatbot = await Chatbot.findOne({
        isActive: true,
        isDeleted: false
      })
        .select("-systemPrompt")
        .sort({ createdAt: 1 });
    }

    const chat = await Chat.create({
      userId: req.user._id,
      chatbotId: resolvedChatbot ? resolvedChatbot._id : null,
      title: typeof title === "string" && title.trim() ? title.trim() : "New Chat",
      model:
        (typeof model === "string" && model.trim()) ||
        resolvedChatbot?.model ||
        process.env.OLLAMA_MODEL ||
        "qwen2.5:3b"
    });

    await chat.populate("chatbotId", "name slug description isActive isDeleted model");

    return res.status(201).json({
      success: true,
      message: "Chat created successfully",
      chat
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// All user chats (optionally scoped by ?chatbotId=<id|legacy>)
exports.getAllChats = async (req, res) => {
  try {
    const { chatbotId } = req.query;
    const filter = { userId: req.user._id };

    if (chatbotId === "legacy" || chatbotId === "null") {
      filter.chatbotId = null;
    } else if (chatbotId) {
      if (!mongoose.Types.ObjectId.isValid(chatbotId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid chatbotId query parameter"
        });
      }
      filter.chatbotId = chatbotId;
    }

    const chats = await Chat.find(filter)
      .populate("chatbotId", "name slug isActive isDeleted model")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      total: chats.length,
      chats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single chat with messages
exports.getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID"
      });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    }).populate("chatbotId", "name slug description allowedTopics restrictedTopics isActive isDeleted model");

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    const messages = await Message.find({
      chatId: chat._id,
      userId: req.user._id
    }).sort({ createdAt: 1, _id: 1 });

    return res.status(200).json({
      success: true,
      chat,
      messages
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Rename chat
exports.renameChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID"
      });
    }
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat title is required"
      });
    }
    const chat = await Chat.findOneAndUpdate(
      {
        _id: chatId,
        userId: req.user._id
      },
      {
        title: title.trim().slice(0, 100)
      },
      {
        new: true,
        runValidators: true
      }
    ).populate("chatbotId", "name slug isActive isDeleted model");

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }
    return res.status(200).json({
      success: true,
      message: "Chat renamed successfully",
      chat
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete chat and its messages
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID"
      });
    }

    const chat = await Chat.findOneAndDelete({
      _id: chatId,
      userId: req.user._id
    });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    await Message.deleteMany({
      chatId: chat._id,
      userId: req.user._id
    });
    return res.status(200).json({
      success: true,
      message: "Chat and messages deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Clear Chat Messages
exports.clearChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID"
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
    await Message.deleteMany({
      chatId: chat._id,
      userId: req.user._id
    });
    return res.status(200).json({
      success: true,
      message: "Chat messages cleared successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
