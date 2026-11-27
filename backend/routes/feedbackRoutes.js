const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  submitFeedback,
  getFeedbackForChat
} = require("../controllers/feedbackController");

router.use(protect);

router.post("/", submitFeedback);
router.get("/chat/:chatId", getFeedbackForChat);

module.exports = router;
