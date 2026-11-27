const mongoose = require("mongoose");

const usageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chatbot",
      default: null,
      index: true
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      default: null,
      index: true
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "message",
      default: null
    },
    action: {
      type: String,
      enum: ["chat_message", "stream_message", "chatbot_select", "regenerate"],
      default: "chat_message"
    },
    classificationStatus: {
      type: String,
      enum: ["IN_DOMAIN", "OUT_OF_DOMAIN", "AMBIGUOUS", null],
      default: null,
      index: true
    },
    model: {
      type: String,
      default: null
    },
    responseTimeMs: {
      type: Number,
      default: 0,
      min: 0
    },
    success: {
      type: Boolean,
      default: true
    },
    errorMessage: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

usageLogSchema.index({ chatbotId: 1, createdAt: -1 });
usageLogSchema.index({ userId: 1, createdAt: -1 });
usageLogSchema.index({ classificationStatus: 1, createdAt: -1 });

module.exports = mongoose.model("UsageLog", usageLogSchema);
