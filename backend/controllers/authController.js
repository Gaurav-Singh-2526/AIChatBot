const User = require("../models/user");
const Chatbot = require("../models/chatbot");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const { ensureDefaultChatbots } = require("../utils/seedChatbots");

//Register user

exports.registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }
        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }
        const existingUser = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }
        const user = await User.create({
            name,
            email,
            password
        });

        const chatbotCount = await Chatbot.countDocuments({ isDeleted: false });
        if (chatbotCount === 0) {
            await ensureDefaultChatbots(user._id).catch(() => {});
        }

        const token = await generateToken(user._id);
        return res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                selectedChatbotId: user.selectedChatbotId || null
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already Registered"
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email and password "
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                success:false,
                message:"Account is inactive"

            });
        }
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );
        if(!isMatch){
            return res.status(401).json({
                success:false,
                message:"Email and password is invalid"
            });
        }
        const token = generateToken(user._id);
        return res.status(200).json({
            success:true,
            message:"Login suceess",
            token,
            user:{
                id:user._id,
                name:user.name,
                email:user.email,
                role:user.role,
                selectedChatbotId: user.selectedChatbotId || null
            }
        });
    }catch(error){
        return res.status(500).json({
            success:false,
            message:error.message
        });
    }

};