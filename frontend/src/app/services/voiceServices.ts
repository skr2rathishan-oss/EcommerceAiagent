/**
 * Service to handle text-to-speech requests and audio playback.
 */

import { apiFetch } from "./api";

/**
 * Calls the backend voice API, retrieves the audio blob, and plays it.
 * @param {string} text - The text to convert to speech.
 * @returns {Promise<HTMLAudioElement>} - Resolves when audio begins playing.
 */
export const playVoice = async (text: string): Promise<HTMLAudioElement> => {
  if (!text || text.trim() === "") {
    throw new Error("Text content is required for voice generation.");
  }

  const response = await apiFetch("/api/voice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to generate voice";
    try {
      const errData = await response.json();
      if (errData && errData.message) {
        errorMessage = errData.message;
      }
    } catch {
      // Ignore json parsing error
    }
    throw new Error(errorMessage);
  }

  const audioBlob = await response.blob();
  if (audioBlob.size === 0) {
    throw new Error("Received empty audio response from server.");
  }

  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  return new Promise((resolve, reject) => {
    // Play when audio is sufficiently loaded
    audio.oncanplaythrough = () => {
      audio.play()
        .then(() => resolve(audio))
        .catch((err) => {
          console.error("Playback error:", err);
          reject(new Error("Playback failed. Please ensure autoplay is allowed."));
        });
    };

    audio.onerror = (err) => {
      console.error("Audio loading error:", err);
      reject(new Error("Failed to load generated audio."));
    };
  });
};
