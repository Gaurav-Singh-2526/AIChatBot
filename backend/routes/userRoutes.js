const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getUserSettings,
  updateUserSettings
} = require("../controllers/userController");

router.use(protect);

router.get("/settings", getUserSettings);
router.put("/settings", updateUserSettings);

module.exports = router;
