const express = require("express");

const router = express.Router();

const {
    sendMessage,
    getMessages,
    regenerateMessage
} = require("../controllers/messageController");

const { protect } = require("../middleware/authMiddleware");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const messageRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 40,
    message: "Too many messages sent. Please slow down."
});

// All message APIs require Login
router.use(protect);

// send msg and receive AI response
router.post("/send", messageRateLimiter, sendMessage);

// regenerate last assistant response
router.post("/regenerate", messageRateLimiter, regenerateMessage);

//Get msg of a particular chat
router.get("/:chatId", getMessages);

module.exports = router;