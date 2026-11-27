/**
 * Simple in-memory fixed-window rate limiter keyed by authenticated user ID or client IP.
 */
const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  message = "Too many requests, please try again later."
} = {}) => {
  const hits = new Map();

  // Periodic cleanup to avoid unbounded memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, Math.max(windowMs, 60 * 1000));
  if (cleanupInterval.unref) cleanupInterval.unref();

  return (req, res, next) => {
    const now = Date.now();
    const identity = req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`;
    const existing = hits.get(identity);

    if (!existing || existing.resetAt <= now) {
      hits.set(identity, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - 1)));
      return next();
    }

    existing.count += 1;
    const remaining = Math.max(0, max - existing.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (existing.count > max) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message
      });
    }

    next();
  };
};

module.exports = { createRateLimiter };
