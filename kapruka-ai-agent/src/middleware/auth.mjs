import jwt from "jsonwebtoken";
import logger from "../utils/logger.mjs";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_123_abc_xyz";

/**
 * Authenticates requests containing a Bearer token.
 * Populates req.user if valid.
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn("Optional JWT auth token verification failed", { error: err.message });
    req.user = null;
    next();
  }
};

/**
 * Strictly requires authentication.
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Access denied: missing authorization header", { url: req.originalUrl });
    return res.status(401).json({
      success: false,
      message: "Authorization token required."
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn("Access denied: invalid token", { url: req.originalUrl, error: err.message });
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authorization token."
    });
  }
};

/**
 * Helper to generate JWT token for a session/user
 */
export const generateToken = (payload, expiresIn = "24h") => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Helper to refresh a token
 */
export const refreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    // Generate new token with refreshed expiry
    const { exp, iat, ...payload } = decoded;
    return generateToken(payload);
  } catch (err) {
    logger.error("Token refresh failed", { error: err.message });
    return null;
  }
};
