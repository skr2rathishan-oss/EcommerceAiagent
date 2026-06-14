import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createClient } from "redis";
import OpenAI from "openai";

// Set global DNS override to handle local DNS/ISP issues for MongoDB Atlas
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.warn("⚠️ DNS override warning:", err.message);
}

// Load environment variables from .env
dotenv.config();

console.log("\n==================================================");
console.log("       ENVIRONMENT & CONNECTIVITY DIAGNOSTICS      ");
console.log("==================================================\n");

async function runDiagnostics() {
  let hasFailed = false;

  // 1. JWT Configuration Check
  console.log("1. Checking JWT Secret Configuration...");
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("   ❌ FAIL: JWT_SECRET is not defined in your .env file.");
    hasFailed = true;
  } else if (jwtSecret.length < 10) {
    console.warn("   ⚠️ WARNING: JWT_SECRET is very short. For production, use a longer secure string.");
  } else {
    console.log("   ✅ PASS: JWT_SECRET is configured properly.");
  }

  // 2. MongoDB Connectivity Check
  console.log("\n2. Checking MongoDB Connection...");
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("   ❌ FAIL: MONGODB_URI is not defined in your .env file.");
    hasFailed = true;
  } else {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      const admin = mongoose.connection.db.admin();
      const ping = await admin.ping();
      console.log("   ✅ PASS: MongoDB successfully connected & pinged!");
      console.log("      Ping response:", JSON.stringify(ping));
      await mongoose.connection.close();
    } catch (err) {
      console.error("   ❌ FAIL: MongoDB connection failed:", err.message);
      hasFailed = true;
    }
  }

  // 3. Redis Connectivity Check
  console.log("\n3. Checking Redis Connection...");
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  console.log(`   Attempting connection to: ${redisUrl}`);
  try {
    const redisClient = createClient({
      url: redisUrl,
      socket: { connectTimeout: 5000 }
    });
    
    redisClient.on("error", (err) => {
      // Catch connection errors gracefully
    });

    await redisClient.connect();
    const pong = await redisClient.ping();
    console.log(`   ✅ PASS: Redis connection successful! PING -> ${pong}`);
    await redisClient.disconnect();
  } catch (err) {
    console.error("   ❌ FAIL: Redis connection failed:", err.message);
    console.log("      (Make sure Redis server is running locally or the container is active)");
    hasFailed = true;
  }

  // 4. Nvidia API Key & Model Routing Check
  console.log("\n4. Checking NVIDIA API Connection...");
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const nvidiaModel = process.env.NVIDIA_MODEL || "qwen/qwen3-next-80b-a3b-instruct";
  
  if (!nvidiaKey) {
    console.error("   ❌ FAIL: NVIDIA_API_KEY is not defined in your .env file.");
    hasFailed = true;
  } else {
    try {
      const openai = new OpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: nvidiaKey,
      });

      console.log(`   Sending diagnostic request to Nvidia API using model: ${nvidiaModel}...`);
      const start = Date.now();
      const completion = await openai.chat.completions.create({
        model: nvidiaModel,
        messages: [{ role: "user", content: "Say ok" }],
        max_tokens: 5,
        temperature: 0.1,
      });
      const latency = Date.now() - start;
      const responseText = completion.choices[0].message.content.trim();
      
      console.log(`   ✅ PASS: NVIDIA API responded successfully in ${latency}ms!`);
      console.log(`      Response: "${responseText}"`);
    } catch (err) {
      console.error("   ❌ FAIL: NVIDIA API call failed:", err.message);
      console.log("      (Check if your NVIDIA_API_KEY is valid or expired)");
      hasFailed = true;
    }
  }

  console.log("\n==================================================");
  if (hasFailed) {
    console.log("❌ DIAGNOSTICS COMPLETED WITH ERRORS.");
    console.log("Please fix the failed items in your VM's .env configuration.");
    console.log("==================================================\n");
    process.exit(1);
  } else {
    console.log("🎉 ALL SYSTEMS ARE OPERATIONAL & CONNECTED CORRECTLY!");
    console.log("==================================================\n");
    process.exit(0);
  }
}

runDiagnostics();
