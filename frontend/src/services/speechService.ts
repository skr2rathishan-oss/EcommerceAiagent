/**
 * Service to handle text-to-speech using browser-native window.speechSynthesis.
 */

class SpeechService {
  private isSupported: boolean;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Speaks the given text using the browser's SpeechSynthesis API.
   * Cancels any currently playing speech.
   */
  speak(text: string): void {
    if (!this.isSupported) {
      console.warn("SpeechSynthesis is not supported in this browser.");
      return;
    }

    if (!text || text.trim() === '') {
      return;
    }

    // Cancel any ongoing speech to prevent overlapping
    this.stopSpeaking();

    // Small delay ensures previous cancellation is fully processed by the browser
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Optional: Set default voice, pitch, and rate here
      // utterance.rate = 1.0;
      // utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
    }, 50);
  }

  /**
   * Stops the current speech completely.
   */
  stopSpeaking(): void {
    if (this.isSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Pauses the current speech.
   */
  pauseSpeaking(): void {
    if (this.isSupported && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  }

  /**
   * Resumes paused speech.
   */
  resumeSpeaking(): void {
    if (this.isSupported && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }
}

export const speechService = new SpeechService();
