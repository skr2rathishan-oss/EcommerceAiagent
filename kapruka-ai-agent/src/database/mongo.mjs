import dns from "dns";
import mongoose from "mongoose";

// Override DNS servers to bypass local/ISP DNS blocks for MongoDB Atlas SRV records
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.warn("Warning: Could not override default DNS servers:", err.message);
}

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.error("Error: MONGODB_URI is not defined in the environment variables.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB Connected");
}