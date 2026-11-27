const mongoose = require("mongoose");
const Feedback = require("../models/feedback");
const Message = require("../models/message");
const Chat = require("../models/chat");

// POST /api/feedback
exports.submitFeedback = async (req, res) => {
  try {
    const { messageId, rating, comment } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID"
      });
    }

    if (!["positive", "negative"].includes(rating)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be 'positive' or 'negative'"
      });
    }

    const message = await Message.findOne({
      _id: messageId,
      userId: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.role !== "assistant") {
      return res.status(400).json({
        success: false,
        message: "Feedback can only be submitted for assistant responses"
      });
    }

    const chat = await Chat.findOne({
      _id: message.chatId,
      userId: req.user._id
    });

    const feedback = await Feedback.findOneAndUpdate(
      { userId: req.user._id, messageId: message._id },
      {
        userId: req.user._id,
        chatId: message.chatId,
        chatbotId: chat?.chatbotId || null,
        messageId: message._id,
        rating,
        comment: typeof comment === "string" ? comment.trim().slice(0, 500) : ""
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Feedback saved",
      feedback
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /api/feedback/chat/:chatId
exports.getFeedbackForChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat ID"
      });
    }

    const entries = await Feedback.find({
      chatId,
      userId: req.user._id
    }).lean();

    return res.status(200).json({
      success: true,
      feedback: entries
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
