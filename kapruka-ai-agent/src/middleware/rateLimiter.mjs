import rateLimit from "express-rate-limit";
import logger from "../utils/logger.mjs";

const limitHandler = (req, res, next, options) => {
  logger.warn("Rate limit exceeded", {
    ip: req.ip,
    url: req.originalUrl,
    limit: options.limit,
    windowMs: options.windowMs
  });
  res.status(429).json({
    success: false,
    message: "Too many requests, please try again later."
  });
};

export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler
});

export const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler
});

export const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler
});

export const deliveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler
});
