
const express = require("express");
const router = express.Router();

const { streamMessage } = require("../controllers/streamController");
const { protect } = require("../middleware/authMiddleware");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const streamRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: "Too many streaming requests. Please slow down."
});

router.post("/", protect, streamRateLimiter, streamMessage);

module.exports = router;
