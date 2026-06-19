import { useState, useEffect, useCallback, useRef } from 'react';

// Define standard window properties for SpeechRecognition
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const useVoiceAssistant = () => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const win = window as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Speech Recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event: any) => {
      let errorMsg = 'An unknown error occurred.';
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          errorMsg = 'Microphone access denied. Please allow microphone permissions.';
          break;
        case 'no-speech':
          errorMsg = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMsg = 'No microphone was found.';
          break;
        case 'network':
          errorMsg = 'Network error occurred during speech recognition.';
          break;
        default:
          errorMsg = `Speech recognition error: ${event.error}`;
      }
      setError(errorMsg);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        // If it's already started, it might throw an error.
        console.warn('Speech recognition is already running.', err);
      }
    } else {
      setError('Speech Recognition is not initialized or supported.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return {
    transcript,
    isListening,
    error,
    startListening,
    stopListening,
  };
};
