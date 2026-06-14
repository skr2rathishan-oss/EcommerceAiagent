import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";

// Override DNS servers to bypass local/ISP DNS blocks for MongoDB Atlas SRV records
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Load environment variables from .env
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

console.log("\n=== TESTING MONGODB CONNECTION ===\n");
console.log(`Using MONGODB_URI: ${MONGODB_URI ? "Defined (masked for security)" : "UNDEFINED"}`);

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not defined in the environment variables (.env file).");
  process.exit(1);
}

async function testConnection() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds instead of 30 seconds
    });
    
    const state = mongoose.connection.readyState;
    // States: 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    const stateNames = {
      0: "Disconnected",
      1: "Connected",
      2: "Connecting",
      3: "Disconnecting"
    };
    
    console.log(`Connection State: ${stateNames[state]} (${state})`);
    
    if (state === 1) {
      console.log("✅ Successfully connected to MongoDB!");
      // Run admin command to ping the DB
      const admin = mongoose.connection.db.admin();
      const pingResult = await admin.ping();
      console.log("Ping result:", pingResult);
      console.log("✅ MongoDB ping successful!");
    } else {
      console.error("❌ Connection state is not 'Connected'");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      console.log("Closing MongoDB connection...");
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }
  }
}

testConnection();
