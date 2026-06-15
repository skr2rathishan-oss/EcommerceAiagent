import { ElevenLabsClient } from "elevenlabs";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend root directory
dotenv.config({ path: resolve(__dirname, "../../.env") });

const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
});

async function test() {
    try {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (apiKey) {
            console.log(`API Key loaded: ${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)} (length: ${apiKey.length})`);
        } else {
            console.log("API Key loaded: undefined");
        }

        let selectedVoiceId = null;
        let selectedVoiceName = null;

        console.log("Fetching available voices from your account...");
        try {
            const response = typeof client.voices.getAll === 'function'
                ? await client.voices.getAll()
                : await client.voices.search();
            
            const voices = response.voices || response;
            if (voices && voices.length > 0) {
                console.log("\nFound available voices:");
                voices.slice(0, 5).forEach(v => {
                    console.log(`- Name: ${v.name}, ID: ${v.voice_id}, Category: ${v.category}`);
                });
                selectedVoiceId = voices[0].voice_id;
                selectedVoiceName = voices[0].name;
            }
        } catch (voiceErr) {
            console.warn("\n⚠️ Could not fetch voices from API. This is likely because your API key lacks 'voices_read' permission.");
            if (voiceErr.body && typeof voiceErr.body === 'object') {
                console.warn("Reason:", voiceErr.body.detail?.message || JSON.stringify(voiceErr.body));
            } else {
                console.warn("Reason:", voiceErr.message || voiceErr);
            }
            console.log("Falling back to standard ElevenLabs default voices...");
        }

        const fallbackVoices = [
            { name: "Antoni", id: "ErXwobaYiN019PkySvjV" },
            { name: "Rachel", id: "21m00Tcm4TlvDq8ikWAM" },
            { name: "Adam", id: "pNInz6obpgqjVW7R73Im" },
            { name: "Bella", id: "EXAVITQu4vr4xnSDxMaL" },
            { name: "Domi", id: "AZnzlk1XvdvUeBnXmlld" },
            { name: "Elli", id: "MF3mGyEYCl7XYWbV9VbO" },
            { name: "Josh", id: "TxGEqn7nUaZCYmJzpGbX" },
            { name: "Arnold", id: "VR6A4Ytd72gdbeTKgpja" },
            { name: "Clyde", id: "2zOBBDZkUxBrZ218sa5H" },
            { name: "Nicole", id: "piTKgcLEGmPEeHQYBIxs" }
        ];

        if (selectedVoiceId) {
            console.log(`\nUsing voice: "${selectedVoiceName}" (ID: ${selectedVoiceId})`);
            await generateSpeech(selectedVoiceId);
        } else {
            console.log("\nAttempting text-to-speech with standard default voices...");
            let success = false;
            for (const voice of fallbackVoices) {
                console.log(`Trying voice: "${voice.name}" (ID: ${voice.id})...`);
                try {
                    await generateSpeech(voice.id);
                    console.log(`✅ Success with voice "${voice.name}"!`);
                    success = true;
                    break;
                } catch (ttsErr) {
                    console.log(`❌ Failed with voice "${voice.name}".`);
                    if (ttsErr.statusCode) {
                        console.log(`   Status: ${ttsErr.statusCode}`);
                    }
                    if (ttsErr.body) {
                        if (typeof ttsErr.body === 'object') {
                            console.log(`   Detail: ${ttsErr.body.detail?.message || JSON.stringify(ttsErr.body)}`);
                        } else {
                            try {
                                const responseText = await new Response(ttsErr.body).text();
                                console.log(`   Detail: ${responseText}`);
                            } catch (readErr) {
                                console.log(`   Detail: ${ttsErr.body}`);
                            }
                        }
                    }
                }
            }
            if (!success) {
                throw new Error("All standard default voices failed. Please verify your ElevenLabs API key has text-to-speech permission and active credits.");
            }
        }
    } catch (err) {
        console.error("\n❌ Test execution failed:");
        console.error(err.message || err);
    }
}

async function generateSpeech(voiceId) {
    const audio = await client.textToSpeech.convert(
        voiceId,
        {
            text: "வணக்கம், வெலோரா AI ஷாப்பிங் அசிஸ்டண்டிற்கு உங்களை வரவேற்கிறோம்.",
            model_id: "eleven_multilingual_v2",
        }
    );

    const chunks = [];
    for await (const chunk of audio) {
        chunks.push(chunk);
    }

    fs.writeFileSync(
        "test.mp3",
        Buffer.concat(chunks)
    );
    console.log("Tamil voice generated successfully and saved to test.mp3");
}

test();