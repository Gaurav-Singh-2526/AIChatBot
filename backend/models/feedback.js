const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true
    },
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chatbot",
      default: null,
      index: true
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "message",
      required: true
    },
    rating: {
      type: String,
      enum: ["positive", "negative"],
      required: true
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

feedbackSchema.index({ userId: 1, messageId: 1 }, { unique: true });
feedbackSchema.index({ chatbotId: 1, rating: 1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
