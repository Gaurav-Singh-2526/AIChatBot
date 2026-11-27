const mongoose = require("mongoose");

const userSettingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system"
    },
    defaultModel: {
      type: String,
      default: "qwen2.5:3b"
    },
    streamResponses: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("UserSetting", userSettingSchema);
