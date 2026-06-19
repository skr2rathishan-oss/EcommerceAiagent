import { ElevenLabsClient } from "elevenlabs";
import speech from "@google-cloud/speech";

const speechClient = new speech.SpeechClient();

/**
 * Initialize ElevenLabs client using the API key from environment variables.
 * @returns {ElevenLabsClient}
 */
const getElevenLabsClient = () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        throw new Error("Missing ELEVENLABS_API_KEY in environment variables.");
    }
    return new ElevenLabsClient({ apiKey });
};

/**
 * Generates speech buffer from input text.
 * @param {string} text - The text to convert to speech.
 * @param {Object} [options] - Optional settings.
 * @param {string} [options.voiceId] - ElevenLabs voice ID.
 * @param {string} [options.modelId] - ElevenLabs model ID.
 * @returns {Promise<Buffer>} - Generated audio buffer.
 */
export async function generateSpeech(text, options = {}) {
    if (!text || text.trim() === "") {
        throw new Error("Text content is required for voice generation.");
    }

    const client = getElevenLabsClient();
    const voiceId = options.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Rachel
    const modelId = options.modelId || "eleven_multilingual_v2";

    console.log("[VOICE]");
    console.log("Request Started");
    console.log("[VOICE]");
    console.log(`Characters: ${text.length}`);
    console.log("[VOICE]");
    console.log("Provider: ElevenLabs");
    console.log("[VOICE]");
    console.log(`Model: ${modelId}`);

    try {
        const audio = await client.textToSpeech.convert(voiceId, {
            text: text,
            model_id: modelId,
        });

        const chunks = [];
        for await (const chunk of audio) {
            chunks.push(chunk);
        }

        console.log("[VOICE SUCCESS]");
        console.log("Audio Generated");
        return Buffer.concat(chunks);
    } catch (err) {
        console.error("[VOICE ERROR]");
        console.error("Voice Generation Failed");

        // Fallback check: If the default Rachel voice failed because of the free tier restriction (402)
        if (voiceId === "21m00Tcm4TlvDq8ikWAM" && err.statusCode === 402) {
            console.warn("[VOICE WARNING] Rachel voice failed due to Free Tier restriction (402). Retrying with Antoni fallback...");
            try {
                const fallbackVoiceId = "ErXwobaYiN019PkySvjV"; // Antoni (premade voice working on free tier)
                const fallbackAudio = await client.textToSpeech.convert(fallbackVoiceId, {
                    text: text,
                    model_id: modelId,
                });

                const chunks = [];
                for await (const chunk of fallbackAudio) {
                    chunks.push(chunk);
                }

                console.log("[VOICE SUCCESS]");
                console.log("Audio Generated (Fallback Voice: Antoni)");
                return Buffer.concat(chunks);
            } catch (fallbackErr) {
                console.error("[VOICE ERROR] Fallback Voice Generation Failed");
                throw fallbackErr;
            }
        }

        throw err;
    }
}

/**
 * Transcribes audio buffer to text using Google Cloud Speech-to-Text.
 * @param {Buffer} audioBuffer - The audio file buffer.
 * @param {string} mimetype - The mimetype of the audio file.
 * @returns {Promise<string>} - Transcribed text.
 */
export async function transcribeAudio(audioBuffer, mimetype) {
    if (!audioBuffer) {
        throw new Error("Audio buffer is required for transcription.");
    }

    // Default to WEBM_OPUS if from Chrome MediaRecorder
    let encoding = "WEBM_OPUS";
    if (mimetype && mimetype.includes("mp4")) encoding = "MP4";
    else if (mimetype && mimetype.includes("mp3")) encoding = "MP3";
    else if (mimetype && mimetype.includes("wav")) encoding = "LINEAR16";

    // Set sample rate depending on typical formats. For webm, 48000 is common.
    // If not matching perfectly, Google Cloud STT can often infer or handle it gracefully
    // when using webm/opus or mp3 formats natively.

    const request = {
        audio: {
            content: audioBuffer.toString("base64"),
        },
        config: {
            encoding: encoding,
            // sampleRateHertz: 48000,
            languageCode: "en-US",
            enableAutomaticPunctuation: true,
        },
    };

    console.log("[STT] Transcription Request Started...");
    try {
        const [response] = await speechClient.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join("\\n");
        console.log(`[STT SUCCESS] Transcribed: "${transcription}"`);
        return transcription;
    } catch (err) {
        console.error("[STT ERROR] Transcription failed:", err);
        throw err;
    }
}
