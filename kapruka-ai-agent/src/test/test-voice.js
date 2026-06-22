import "../config/loadEnv.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateSpeech } from "../services/media/voiceService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVoiceTest() {
    console.log("=== ElevenLabs Voice Service Test ===");

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        console.error("❌ Error: ELEVENLABS_API_KEY is not defined in your .env file.");
        process.exit(1);
    }
    // Safeguard print of key
    const obscuredKey = apiKey.length > 8 ? `...${apiKey.slice(-6)}` : apiKey;
    console.log(`✅ ELEVENLABS_API_KEY is present (ends with ${obscuredKey})`);

    const testText = "Hello! This is a test of the Kapruka AI Agent voice integration using ElevenLabs. If you can hear this, the integration is working successfully!";
    const outputDir = __dirname;
    const defaultOutputPath = path.join(outputDir, "test-voice-rachel.mp3");
    const fallbackOutputPath = path.join(outputDir, "test-voice-antoni.mp3");

    // Test 1: Default Rachel Voice (or Antoni fallback inside voiceService.js)
    console.log("\n--- Test 1: Default Voice Generation (Rachel/Fallback) ---");
    console.log(`Text to generate: "${testText}"`);
    try {
        const audioBuffer = await generateSpeech(testText);
        if (Buffer.isBuffer(audioBuffer) && audioBuffer.length > 0) {
            fs.writeFileSync(defaultOutputPath, audioBuffer);
            console.log(`✅ Success! Audio file written to: ${defaultOutputPath}`);
            console.log(`   File size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
        } else {
            console.error("❌ Failed: Returned audio buffer is empty or not a Buffer.");
        }
    } catch (error) {
        console.error("❌ Default Voice Generation Failed:");
        console.error(error);
    }

    // Test 2: Explicit Custom/Fallback Voice (Antoni)
    console.log("\n--- Test 2: Custom Voice (Antoni) Generation ---");
    try {
        const antoniVoiceId = "ErXwobaYiN019PkySvjV"; // Antoni premade voice
        const audioBuffer = await generateSpeech(testText, { voiceId: antoniVoiceId });
        if (Buffer.isBuffer(audioBuffer) && audioBuffer.length > 0) {
            fs.writeFileSync(fallbackOutputPath, audioBuffer);
            console.log(`✅ Success! Audio file written to: ${fallbackOutputPath}`);
            console.log(`   File size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
        } else {
            console.error("❌ Failed: Returned audio buffer is empty or not a Buffer.");
        }
    } catch (error) {
        console.error("❌ Custom Voice (Antoni) Generation Failed:");
        console.error(error);
    }

    console.log("\n=== Voice Service Test Completed ===");
}

runVoiceTest();
