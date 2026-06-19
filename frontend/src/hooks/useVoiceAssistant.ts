import { useState, useEffect, useCallback, useRef } from "react";

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const useVoiceAssistant = () => {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isStartingRef = useRef(false);
  const onAutoSubmitRef = useRef<((text: string) => void) | null>(null);
  const onRestartListeningRef = useRef<(() => void) | null>(null);
  const transcriptRef = useRef("");  // Keep latest transcript for onend callback

  useEffect(() => {
    const win = window as IWindow;

    const SpeechRecognition =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech Recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();

    // Turn-taking mode: disable continuous listening
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      isStartingRef.current = false;
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }

      setTranscript(finalTranscript);
      transcriptRef.current = finalTranscript;  // Keep ref in sync
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);

      switch (event.error) {
        case "not-allowed":
        case "permission-denied":
          setError(
            "Microphone permission denied. Please allow microphone access."
          );
          break;

        case "no-speech":
          setError("No speech detected.");
          break;

        case "audio-capture":
          setError("No microphone found.");
          break;

        case "network":
          setError("Network error occurred.");
          break;

        default:
          setError(`Speech recognition error: ${event.error}`);
      }

      setIsListening(false);
      isStartingRef.current = false;
    };

    // Auto-submit on recognition end
    recognition.onend = () => {
      setIsListening(false);
      isStartingRef.current = false;

      // Get current transcript from ref (not state - avoids stale closure)
      const handler = onAutoSubmitRef.current;
      if (handler) {
        handler(transcriptRef.current);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    setTranscript("");
    transcriptRef.current = "";  // Reset ref

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.warn("Recognition already started.");
      isStartingRef.current = false;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  const openVoiceMode = useCallback(() => {
    setIsVoiceMode(true);
    setError(null);
    setTranscript("");
  }, []);

  const closeVoiceMode = useCallback(() => {
    stopListening();
    setIsVoiceMode(false);
  }, [stopListening]);

  // Register callback for auto-submission when recognition ends
  const setOnAutoSubmit = useCallback((callback: (text: string) => void) => {
    onAutoSubmitRef.current = callback;
  }, []);

  // Register callback for restarting listening
  const setOnRestartListening = useCallback((callback: () => void) => {
    onRestartListeningRef.current = callback;
  }, []);

  return {
    transcript,

    isListening,
    isVoiceMode,

    error,

    startListening,
    stopListening,

    openVoiceMode,
    closeVoiceMode,

    setOnAutoSubmit,
    setOnRestartListening,
  };
};