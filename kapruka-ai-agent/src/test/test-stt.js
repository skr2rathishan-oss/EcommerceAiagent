import fs from "fs";
import path from "path";
import { transcribeAudio } from "../services/media/voiceService.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
    console.log("Starting STT test...");

    // Create a mock audio buffer if you don't have a real audio file handy
    // Note: For a real test, you'd need an actual audio file, but we're testing the initialization here
    try {
        const dummyBuffer = Buffer.from("dummy-audio-content-for-initialization-test");
        console.log("Calling transcribeAudio with dummy data (Expect this to fail transcription but reach Google API)...");
        await transcribeAudio(dummyBuffer, "audio/webm");
    } catch (err) {
        console.log("Test threw an error (Expected if audio is invalid):", err.message);
        if (err.message.includes("Could not decode") || err.message.includes("invalid") || err.message.includes("does not contain valid")) {
            console.log("✅ API was reached successfully but audio was invalid (as expected for dummy data). STT is configured properly!");
        } else if (err.message.includes("Application Default Credentials")) {
            console.log("❌ Authentication failed. GOOGLE_APPLICATION_CREDENTIALS might be missing or invalid.");
        } else {
            console.log("❓ Unknown error occurred:", err);
        }
    }
}

runTest();
