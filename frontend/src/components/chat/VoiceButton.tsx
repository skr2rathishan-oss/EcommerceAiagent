import React from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceButtonProps {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  error?: string | null;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isListening,
  onStart,
  onStop,
  disabled = false,
  error,
}) => {
  const handleClick = () => {
    if (isListening) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        animate={isListening ? { scale: [1, 1.15, 1] } : {}}
        transition={isListening ? { repeat: Infinity, duration: 1.2 } : {}}
        className="flex items-center justify-center transition-colors"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: isListening ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
          color: isListening ? '#ef4444' : disabled ? '#9ca3af' : '#7c4dba',
          opacity: disabled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isListening && !disabled) {
            e.currentTarget.style.background = 'rgba(124, 77, 186, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isListening && !disabled) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
        title={isListening ? "Stop listening" : "Start voice input"}
      >
        <AnimatePresence mode="wait">
          {isListening ? (
            <motion.div
              key="listening"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
            >
              <Mic size={18} strokeWidth={2} />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
            >
              <Mic size={18} strokeWidth={2} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Tooltip for error state */}
      {error && (
        <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-red-100 text-red-700 text-xs rounded-md shadow-sm opacity-0 hover:opacity-100 transition-opacity">
          {error}
        </div>
      )}
    </div>
  );
};
