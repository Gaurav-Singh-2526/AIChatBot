const express = require("express");

const router = express.Router();

const {
    sendMessage,
    getMessages
} = require("../controllers/messageController");

const { protect } = require("../midddleware/authMiddleWare");

// All mesasge APIs require Login 
router.use(protect);

// send msg and receive AI response  
router.post("/send",sendMessage);

//Get msg of a particular chat
router.get("/:chatId",getMessages);

module.exports = router;