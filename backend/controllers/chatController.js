const mongoose = require("mongoose");
const Chat = require("../models/chat");
const Message = require("../models/message");


exports.createChat = async (req, res) => {
    try {
        const { title, model } = req.body;

        const chat = await Chat.create({
            userId: req.user._id,
            title: title?.trim() || "New Chat",
            model: model || process.env.OLLAMA_MODEL || "qwen2.5:3b"
        });
        return res.status(201).json({
            success: true,
            message: "Chat create successfully",
            chat
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// All user chats

exports.getAllChats = async (req, res) => {
    try {
        const chats = await Chat.find({
            userId: req.user._id
        })
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
// 3 get single chat with message

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
        });

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found"
            });
        }

        const messages = await Message.find({
            chatId: chat._id,
            userId: req.user._id
        }).sort({ createdAt: 1 });

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
//4 Rename chats

exports.renameChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { title } = req.body;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({
                success: false,
                message: "Invali Chat ID"
            });
        }
        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "chat title is required"
            });
        }
        const chat = await Chat.findOneAndUpdate(
            {
                _id: chatId,
                userId: req.user._id
            },
            {
                title: title.trim()
            },
            {
                new: true,
                runValidators: true
            }
        );
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

// 5---> DELETE chat and its message

exports.deleteChat = async (req, res) => {
    try {
        const {chatId} = req.params;
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
            message: "Chat and Message deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// 6 ---> Clear Chat Messages

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

        if(!chat){
            return res.status(404).json({
                success: false,
                message: "Chat not found"
            })
        }
        await Message.deleteMany({
            chatId: chat._id,
            userId: req.user._id
        });
         return res.status(200).json({
            success: true,
            message: "Chat messages cleared successfully"
        }); 
    }catch(error){
        return res.status(500).json({
            success:false,
            message:error.message
        });
    }
};