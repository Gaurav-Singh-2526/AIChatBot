const mongoose = require("mongoose");
const Chatbot = require("../models/chatbot");
const User = require("../models/user");
const UsageLog = require("../models/usageLog");

const normalizeTopics = (input) => {
  if (Array.isArray(input)) {
    return input
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
};

const buildSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

// ---------------- ADMIN CONTROLLERS ----------------

// POST /api/admin/chatbots
exports.createChatbot = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      systemPrompt,
      allowedTopics,
      restrictedTopics,
      model,
      isActive
    } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chatbot name is required"
      });
    }
    if (name.trim().length > 60) {
      return res.status(400).json({
        success: false,
        message: "Chatbot name cannot exceed 60 characters"
      });
    }

    if (typeof description !== "string" || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chatbot description is required"
      });
    }
    if (description.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Chatbot description cannot exceed 500 characters"
      });
    }

    if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "System prompt is required"
      });
    }

    const parsedAllowed = normalizeTopics(allowedTopics);
    if (parsedAllowed.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one allowed topic is required"
      });
    }

    const parsedRestricted = normalizeTopics(restrictedTopics);
    const resolvedSlug = buildSlug(slug || name);
    if (!resolvedSlug) {
      return res.status(400).json({
        success: false,
        message: "A valid slug or name is required"
      });
    }

    const existingSlug = await Chatbot.findOne({ slug: resolvedSlug });
    if (existingSlug) {
      return res.status(409).json({
        success: false,
        message: "A chatbot with this slug already exists"
      });
    }

    const chatbot = await Chatbot.create({
      name: name.trim(),
      slug: resolvedSlug,
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      allowedTopics: parsedAllowed,
      restrictedTopics: parsedRestricted,
      model:
        typeof model === "string" && model.trim()
          ? model.trim()
          : process.env.OLLAMA_MODEL || "qwen2.5:3b",
      isActive: typeof isActive === "boolean" ? isActive : true,
      isDeleted: false,
      createdBy: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Chatbot created successfully",
      chatbot
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A chatbot with this slug already exists"
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /api/admin/chatbots
exports.getAllChatbotsAdmin = async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === "true";
    const filter = includeDeleted ? {} : { isDeleted: false };

    const chatbots = await Chatbot.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: chatbots.length,
      chatbots
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /api/admin/chatbots/:id
exports.getChatbotByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatbot ID"
      });
    }

    const chatbot = await Chatbot.findById(id).populate("createdBy", "name email");
    if (!chatbot) {
      return res.status(404).json({
        success: false,
        message: "Chatbot not found"
      });
    }

    return res.status(200).json({
      success: true,
      chatbot
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// PUT /api/admin/chatbots/:id
exports.updateChatbot = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatbot ID"
      });
    }

    const chatbot = await Chatbot.findOne({ _id: id, isDeleted: false });
    if (!chatbot) {
      return res.status(404).json({
        success: false,
        message: "Chatbot not found"
      });
    }

    const {
      name,
      slug,
      description,
      systemPrompt,
      allowedTopics,
      restrictedTopics,
      model,
      isActive
    } = req.body || {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 60) {
        return res.status(400).json({
          success: false,
          message: "Chatbot name must be between 1 and 60 characters"
        });
      }
      chatbot.name = name.trim();
    }

    if (slug !== undefined) {
      const resolvedSlug = buildSlug(slug);
      if (!resolvedSlug) {
        return res.status(400).json({
          success: false,
          message: "Invalid slug"
        });
      }
      const duplicate = await Chatbot.findOne({
        slug: resolvedSlug,
        _id: { $ne: chatbot._id }
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "A chatbot with this slug already exists"
        });
      }
      chatbot.slug = resolvedSlug;
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        !description.trim() ||
        description.trim().length > 500
      ) {
        return res.status(400).json({
          success: false,
          message: "Description must be between 1 and 500 characters"
        });
      }
      chatbot.description = description.trim();
    }

    if (systemPrompt !== undefined) {
      if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
        return res.status(400).json({
          success: false,
          message: "System prompt cannot be empty"
        });
      }
      chatbot.systemPrompt = systemPrompt.trim();
    }

    if (allowedTopics !== undefined) {
      const parsedAllowed = normalizeTopics(allowedTopics);
      if (parsedAllowed.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one allowed topic is required"
        });
      }
      chatbot.allowedTopics = parsedAllowed;
    }

    if (restrictedTopics !== undefined) {
      chatbot.restrictedTopics = normalizeTopics(restrictedTopics);
    }

    if (model !== undefined) {
      if (typeof model !== "string" || !model.trim()) {
        return res.status(400).json({
          success: false,
          message: "Model name cannot be empty"
        });
      }
      chatbot.model = model.trim();
    }

    if (typeof isActive === "boolean") {
      chatbot.isActive = isActive;
    }

    await chatbot.save();

    return res.status(200).json({
      success: true,
      message: "Chatbot updated successfully",
      chatbot
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A chatbot with this slug already exists"
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// PATCH /api/admin/chatbots/:id/status
exports.toggleChatbotStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatbot ID"
      });
    }

    const chatbot = await Chatbot.findOne({ _id: id, isDeleted: false });
    if (!chatbot) {
      return res.status(404).json({
        success: false,
        message: "Chatbot not found"
      });
    }

    const nextActive =
      typeof req.body?.isActive === "boolean"
        ? req.body.isActive
        : !chatbot.isActive;

    chatbot.isActive = nextActive;
    await chatbot.save();

    return res.status(200).json({
      success: true,
      message: `Chatbot ${nextActive ? "activated" : "deactivated"} successfully`,
      chatbot
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE /api/admin/chatbots/:id (Soft delete)
exports.deleteChatbot = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatbot ID"
      });
    }

    const chatbot = await Chatbot.findOne({ _id: id, isDeleted: false });
    if (!chatbot) {
      return res.status(404).json({
        success: false,
        message: "Chatbot not found"
      });
    }

    chatbot.isDeleted = true;
    chatbot.isActive = false;
    await chatbot.save();

    // Clear selectedChatbotId for users currently pointing to this deleted chatbot
    await User.updateMany(
      { selectedChatbotId: chatbot._id },
      { $set: { selectedChatbotId: null } }
    );

    return res.status(200).json({
      success: true,
      message: "Chatbot soft-deleted successfully",
      chatbot
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ---------------- USER CONTROLLERS ----------------

// GET /api/chatbots (Active, non-deleted, systemPrompt hidden)
exports.getActiveChatbots = async (req, res) => {
  try {
    const chatbots = await Chatbot.find({
      isActive: true,
      isDeleted: false
    })
      .select("-systemPrompt")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      total: chatbots.length,
      selectedChatbotId: req.user.selectedChatbotId || null,
      chatbots
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /api/chatbots/:id (Active, non-deleted, systemPrompt hidden)
exports.getActiveChatbotById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatbot ID"
      });
    }

    const chatbot = await Chatbot.findOne({
      _id: id,
      isActive: true,
      isDeleted: false
    }).select("-systemPrompt");

    if (!chatbot) {
      return res.status(404).json({
        success: false,
        message: "Chatbot not found or inactive"
      });
    }

    return res.status(200).json({
      success: true,
      chatbot
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// PUT /api/chatbots/select/:id
exports.selectChatbot = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatbot ID"
      });
    }

    const chatbot = await Chatbot.findOne({
      _id: id,
      isActive: true,
      isDeleted: false
    }).select("-systemPrompt");

    if (!chatbot) {
      return res.status(404).json({
        success: false,
        message: "Chatbot not found or inactive"
      });
    }

    await User.updateOne(
      { _id: req.user._id },
      { $set: { selectedChatbotId: chatbot._id } }
    );

    await UsageLog.create({
      userId: req.user._id,
      chatbotId: chatbot._id,
      action: "chatbot_select",
      model: chatbot.model,
      success: true
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Switched to ${chatbot.name}`,
      selectedChatbotId: chatbot._id,
      chatbot
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
