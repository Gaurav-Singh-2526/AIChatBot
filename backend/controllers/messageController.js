const mongoose = require("mongoose");

const Chat = require("../models/chat");
const Message = require("../models/message");

const {
    generateAIResponse
} = require("../services/ollamaServices");
// const message = require("../models/message");


// 1. send msg and get response

exports.sendMessage = async (req, res) => {
    try {
        const { chatId, content } = req.body;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                sucess: false,
                message: "Invalid chat ID"
            });
        }
        // validate msg
        if (typeof content !== "string" || !content.trim()) {
            return res.status(400).json({
                sucess: false,
                message: "Message content is required"
            });
        }

        const userContent = content.trim();

        if (userContent.length > 20000) {
            return res.status(400).json({
                sucess: false,
                message: "Message cannot exceed 20000 characters"
            });
        }

        //verify chat ownership 
        const chat = await Chat.findOne({
            _id: chatId,
            userId: req.user._id
        });
        if (!chat) {
            return res.status(404).json({
                sucess: false,
                message: "Chat not found"
            });
        }

        // save user msg
        const userMessage = await Message.create({
            chatId: chat._id,
            userId: req.user._id,
            role: "user",
            content: userContent
        });
        if (chat.title === "New Chat") {
            chat.title = userContent.slice(0, 40);
            await chat.save();
        }

        //Get recent conversation history 
        const history = await Message.find({
            chatId: chat._id,
            userId: req.user._id
        }).sort({ createAt: -1, id: -1 })
            .limit(20)
            .lean();
        history.reverse();

        // prepare msg for ollama
        const messages = [
            {
                role: "system",
                constent: "You are a helpful AI assistant. Give clear, accurate ad useful answer."
            },
            ...history.map((message) => ({
                role: message.role,
                content: message.content
            }))
        ];

        //Select model

        const selectedModel = process.env.OLLAMA_MODEL || "qwen2.5:3b";
        let aiContent;
        try {
            aiContent = await generateAIResponse({
                model: selectedModel,
                messages
            });

        } catch (ollamaError) {
            console.error(
                "ollama Error:",
                ollamaError.response?.data || ollamaError.message
            );
            return res.status(502).json({
                success: false,
                message: "AI services is unavailable.please check ollama and try again.",
                userMessageId: userMessage._id
            });
        }
        //save assistant response

        const assistantMessage = await Message.create({
            chatId: chat._id,
            userId: req.user._id,
            role: "assistant",
            content: aiContent,
            model: selectedModel
        });

        ///update chats Latest activity
        await Chat.updateOne(
            {
                _id: chat._id,
                userId: req.user._id
            },
            {
                $set: {
                    updatedAt: new Date()
                }
            }
        );
        return res.status(201).json({
            success: true,
            message: "AI response generate successfully",
            model: selectedModel,
            userMessage,
            assistantMessage
        });
    } catch (error) {
        console.error("Send Message Error:", error);
        return res.status(500).json({
            success: false,
            message: "failed to process message"
        });
    }
};

// 2. Get all msg of a chat
exports.getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid chat ID"
            });
        }

        // check ownership
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

        //pagination 

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(
            100,
            Math.max(1, parseInt(req.query.limit, 10) || 30)
        );
        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
            Message.find({
                chatId: chat._id,
                userId: req.user._id
            })
                .sort({ createAt: 1, _id: 1 })
                .skip(skip)
                .limit(limit),

            Message.countDocuments({
                chatId: chat._id,
                userId: req.user._id
            })
        ]);
        return res.status(200).json({
            sucess: true,
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