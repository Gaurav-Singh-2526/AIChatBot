const UserSetting = require("../models/userSetting");

// GET /api/users/settings
exports.getUserSettings = async (req, res) => {
  try {
    let settings = await UserSetting.findOne({ userId: req.user._id });
    if (!settings) {
      settings = await UserSetting.create({ userId: req.user._id });
    }
    return res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// PUT /api/users/settings
exports.updateUserSettings = async (req, res) => {
  try {
    const { theme, defaultModel, streamResponses } = req.body || {};
    const updates = {};

    if (theme !== undefined) {
      if (!["light", "dark", "system"].includes(theme)) {
        return res.status(400).json({
          success: false,
          message: "Theme must be light, dark, or system"
        });
      }
      updates.theme = theme;
    }

    if (defaultModel !== undefined) {
      if (typeof defaultModel !== "string" || !defaultModel.trim()) {
        return res.status(400).json({
          success: false,
          message: "Invalid default model"
        });
      }
      updates.defaultModel = defaultModel.trim();
    }

    if (typeof streamResponses === "boolean") {
      updates.streamResponses = streamResponses;
    }

    const settings = await UserSetting.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Settings updated",
      settings
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
