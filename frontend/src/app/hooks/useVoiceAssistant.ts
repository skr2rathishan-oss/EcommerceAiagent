import { useState, useCallback, useEffect, useRef } from 'react';

interface UseVoiceAssistantOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export const useVoiceAssistant = (options: UseVoiceAssistantOptions = {}) => {
  const {
    lang = 'en-US',
    continuous = false,
    interimResults = true,
  } = options;

  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const interimTranscriptRef = useRef('');

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech Recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
      interimTranscriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          setTranscript(prev => (prev + transcript).trim());
        } else {
          interim += transcript;
        }
      }
      
      interimTranscriptRef.current = interim;
    };

    recognition.onerror = (event: any) => {
      let errorMsg = 'An error occurred';
      
      switch (event.error) {
        case 'no-speech':
          errorMsg = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMsg = 'No microphone found. Ensure permissions are granted.';
          break;
        case 'network':
          errorMsg = 'Network error. Please check your connection.';
          break;
        case 'permission-denied':
          errorMsg = 'Microphone permission denied. Please allow access in browser settings.';
          break;
        case 'not-allowed':
          errorMsg = 'Speech recognition not allowed. Please check permissions.';
          break;
        default:
          errorMsg = `Error: ${event.error}`;
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
      // Cancel any ongoing speech
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [continuous, interimResults, lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      setError('Speech Recognition not supported');
      return;
    }

    try {
      setError(null);
      setTranscript('');
      interimTranscriptRef.current = '';
      recognitionRef.current.start();
    } catch (err) {
      console.error('Error starting recognition:', err);
      setError('Failed to start speech recognition');
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      setIsListening(false);
      setError(null);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!text || text.trim() === '') {
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      setError(`Speech error: ${event.error}`);
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    interimTranscriptRef.current = '';
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    transcript,
    isListening,
    isSpeaking,
    error,
    isSupported,
    interimTranscript: interimTranscriptRef.current,

    // Controls
    startListening,
    stopListening,
    abortListening,
    speak,
    stopSpeaking,
    clearTranscript,
    clearError,
  };
};

export default useVoiceAssistant;
