const express = require("express");
const router = express.Router();

const {
  getActiveChatbots,
  getActiveChatbotById,
  selectChatbot
} = require("../controllers/chatbotController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getActiveChatbots);
router.put("/select/:id", selectChatbot);
router.get("/:id", getActiveChatbotById);

module.exports = router;
