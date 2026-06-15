import dns from "dns";
import mongoose from "mongoose";
import logger from "../utils/logger.mjs";

// Override DNS servers to bypass local/ISP DNS blocks for MongoDB Atlas SRV records
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  logger.warn("Warning: Could not override default DNS servers: " + err.message);
}

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    logger.error("Error: MONGODB_URI is not defined in the environment variables.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info("MongoDB Connected");
}