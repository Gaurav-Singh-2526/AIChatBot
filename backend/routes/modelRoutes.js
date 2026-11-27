const express = require("express");
const router = express.Router();

const { getModels } = require("../controllers/modelController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getModels);

module.exports = router;
