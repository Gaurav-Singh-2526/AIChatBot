const mongoose = require("mongoose");

const validateObjectIdParam = (paramName = "id") => (req, res, next) => {
  const value = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${paramName}`
    });
  }
  next();
};

const requireFields = (fields = []) => (req, res, next) => {
  const body = req.body || {};
  const missing = fields.filter((field) => {
    const val = body[field];
    if (val === undefined || val === null) return true;
    if (typeof val === "string" && !val.trim()) return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required field(s): ${missing.join(", ")}`
    });
  }

  next();
};

module.exports = {
  validateObjectIdParam,
  requireFields
};
