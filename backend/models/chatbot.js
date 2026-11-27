
const mongoose = require("mongoose");

const chatbotSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            maxlength: 500
        },

        systemPrompt: {
            type: String,
            required: true
        },

        allowedTopics: {
            type: [String],
            required: true,
            validate: {
                validator: topics => topics.length > 0,
                message: "At least one allowed topic is required"
            }
        },

        restrictedTopics: {
            type: [String],
            default: []
        },

        model: {
            type: String,
            default: "qwen2.5:3b"
        },

        isActive: {
            type: Boolean,
            default: true
        },

        isDeleted: {
            type: Boolean,
            default: false
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

chatbotSchema.index({ isActive: 1, isDeleted: 1 });

module.exports = mongoose.model("Chatbot", chatbotSchema);
