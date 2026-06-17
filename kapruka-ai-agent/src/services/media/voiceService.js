import { ElevenLabsClient } from "elevenlabs";

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
