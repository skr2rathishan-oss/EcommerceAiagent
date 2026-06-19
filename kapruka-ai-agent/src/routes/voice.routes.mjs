import express from "express";
import { generateSpeech, transcribeAudio } from "../services/media/voiceService.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

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

// STT Route
router.post("/transcribe", upload.single("audio"), async (req, res) => {
    try {
        let audioBuffer;
        let mimetype = "audio/webm";

        if (req.file) {
            audioBuffer = req.file.buffer;
            mimetype = req.file.mimetype;
        } else if (req.body.audioBase64) {
            audioBuffer = Buffer.from(req.body.audioBase64, "base64");
            if (req.body.mimetype) mimetype = req.body.mimetype;
        } else {
            return res.status(400).json({ success: false, message: "No audio file or base64 provided." });
        }

        const transcription = await transcribeAudio(audioBuffer, mimetype);
        return res.json({ success: true, text: transcription });
    } catch (err) {
        console.error("Route error in /api/voice/transcribe:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to transcribe audio." });
    }
});

export default router;
