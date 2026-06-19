import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Square } from 'lucide-react';
import { speechService } from '../../services/speechService';

interface SpeakingIndicatorProps {
  // Can be controlled externally, or self-manage using window.speechSynthesis
  isSpeakingOverride?: boolean; 
}

export const SpeakingIndicator: React.FC<SpeakingIndicatorProps> = ({ isSpeakingOverride }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (typeof isSpeakingOverride === 'boolean') {
      setIsSpeaking(isSpeakingOverride);
      return;
    }

    // Polling mechanism if self-managing (since speechSynthesis events are fired per utterance,
    // and sometimes buggy on certain browsers, a simple poll works best for a global indicator)
    const checkSpeaking = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        setIsSpeaking(window.speechSynthesis.speaking);
      }
    };

    const interval = setInterval(checkSpeaking, 200);
    return () => clearInterval(interval);
  }, [isSpeakingOverride]);

  const handleStop = () => {
    speechService.stopSpeaking();
    setIsSpeaking(false);
  };

  return (
    <AnimatePresence>
      {isSpeaking && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full shadow-md border"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderColor: 'rgba(124, 77, 186, 0.2)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Volume2 size={18} style={{ color: '#7c4dba' }} />
          </motion.div>
          
          <span className="text-sm font-medium" style={{ color: '#402970', fontFamily: "'Nunito',sans-serif" }}>
            Velora is speaking...
          </span>

          <button
            onClick={handleStop}
            className="flex items-center justify-center ml-2 rounded-full hover:bg-gray-100 transition-colors"
            style={{
              width: 28,
              height: 28,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#ef4444'
            }}
            title="Stop speaking"
          >
            <Square size={14} fill="currentColor" strokeWidth={0} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
