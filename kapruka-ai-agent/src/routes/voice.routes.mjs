import express from "express";
import { generateSpeech } from "../services/voiceService.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== "string" || text.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Text content is required and must be a valid string."
            });
        }

        // Generate speech buffer
        const audioBuffer = await generateSpeech(text);

        // Set response headers for audio stream
        res.set({
            "Content-Type": "audio/mpeg",
            "Content-Length": audioBuffer.length
        });

        // Send binary buffer
        return res.send(audioBuffer);
    } catch (err) {
        console.error("Route error in /api/voice:", err);

        const statusCode = err.statusCode || 500;
        let errorMessage = "An error occurred during voice generation.";

        if (err.statusCode === 401) {
            errorMessage = "Unauthorized. ElevenLabs API key is missing or invalid.";
        } else if (err.statusCode === 402) {
            errorMessage = "Payment Required. ElevenLabs character quota exceeded or billing issue.";
        } else if (err.message) {
            errorMessage = err.message;
        }

        return res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
});

export default router;
