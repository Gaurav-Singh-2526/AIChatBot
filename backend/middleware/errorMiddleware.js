const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  let message = err.message || "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((item) => item.message)
      .join(", ");
  } else if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyPattern || {});
    message = fields.length
      ? `Duplicate value for ${fields.join(", ")}`
      : "Duplicate resource";
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource identifier";
  }

  if (res.headersSent) {
    return;
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && statusCode === 500
      ? { stack: err.stack }
      : {})
  });
};

module.exports = { notFound, errorHandler };
