import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Mic, Volume2 } from 'lucide-react';

interface VoiceIndicatorProps {
  isListening: boolean;
  isSpeaking: boolean;
  error?: string | null;
  transcript?: string;
  position?: 'top' | 'bottom' | 'inline';
  onDismissError?: () => void;
}

/**
 * VoiceIndicator Component
 * Shows visual feedback for voice states: listening, speaking, or errors.
 * Can be positioned at top, bottom, or inline with other content.
 */
export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
  isListening,
  isSpeaking,
  error,
  transcript,
  position = 'top',
  onDismissError,
}) => {
  if (!isListening && !isSpeaking && !error) {
    return null;
  }

  const content = (
    <>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200"
          style={{
            background: 'rgba(254, 242, 242, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
          <span className="text-sm" style={{ color: '#b91c1c' }}>
            {error}
          </span>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="ml-auto text-sm hover:underline"
              style={{ color: '#b91c1c' }}
            >
              Dismiss
            </button>
          )}
        </motion.div>
      )}

      {isListening && !error && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            <Mic size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          </motion.div>
          <div className="flex-1">
            <span className="text-sm font-medium" style={{ color: '#dc2626' }}>
              Listening...
            </span>
            {transcript && (
              <p className="text-xs mt-1 italic" style={{ color: '#991b1b' }}>
                Heard: "{transcript.substring(0, 50)}{transcript.length > 50 ? '...' : ''}"
              </p>
            )}
          </div>
        </motion.div>
      )}

      {isSpeaking && !error && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{
            background: 'rgba(124, 77, 186, 0.08)',
            border: '1px solid rgba(124, 77, 186, 0.2)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
          >
            <Volume2 size={18} style={{ color: '#7c4dba', flexShrink: 0 }} />
          </motion.div>
          <span className="text-sm font-medium" style={{ color: '#5b21b6' }}>
            Speaking...
          </span>
        </motion.div>
      )}
    </>
  );

  if (position === 'inline') {
    return (
      <AnimatePresence mode="wait">
        {content}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed z-50 left-1/2 -translate-x-1/2"
        style={{
          [position === 'top' ? 'top' : 'bottom']: 20,
          pointerEvents: 'auto',
          maxWidth: '90vw',
          width: 'auto',
        }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
};

export default VoiceIndicator;
