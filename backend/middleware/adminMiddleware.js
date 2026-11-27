const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Please login."
    });
  }

  // Never trust any role header/body from frontend; rely strictly on DB-loaded req.user.role
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required."
    });
  }

  next();
};

module.exports = { adminOnly };
