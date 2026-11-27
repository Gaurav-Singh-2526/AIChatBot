
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
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

        title: {
            type: String,
            trim: true,
            default: "New Chat",
            maxlength: 100
        },

        model: {
            type: String,
            default: "qwen2.5:3b"
        },

        isArchived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

chatSchema.index({ userId: 1, updatedAt: -1 });

chatSchema.index({
    userId: 1,
    chatbotId: 1,
    updatedAt: -1
});

module.exports = mongoose.model("Chat", chatSchema);
