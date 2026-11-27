const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");
const {
  createChatbot,
  getAllChatbotsAdmin,
  getChatbotByIdAdmin,
  updateChatbot,
  toggleChatbotStatus,
  deleteChatbot
} = require("../controllers/chatbotController");
const {
  getAnalytics,
  getUsersSummary
} = require("../controllers/adminController");

// Every /api/admin route requires authenticated Admin
router.use(protect, adminOnly);

// Chatbot management
router.post("/chatbots", createChatbot);
router.get("/chatbots", getAllChatbotsAdmin);
router.get("/chatbots/:id", getChatbotByIdAdmin);
router.put("/chatbots/:id", updateChatbot);
router.patch("/chatbots/:id/status", toggleChatbotStatus);
router.delete("/chatbots/:id", deleteChatbot);

// Analytics & user activity
router.get("/analytics", getAnalytics);
router.get("/users", getUsersSummary);

module.exports = router;
