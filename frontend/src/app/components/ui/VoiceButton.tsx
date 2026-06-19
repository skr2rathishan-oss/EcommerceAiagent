import React from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onClick: () => void;
  onStop?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * VoiceButton Component
 * Renders a microphone button with visual feedback for listening state.
 * Used in chat input for starting/stopping speech recognition.
 */
export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isListening,
  isSupported,
  onClick,
  onStop,
  disabled = false,
  title = 'Voice input',
  className = '',
  style = {},
}) => {
  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    if (isListening && onStop) {
      onStop();
    } else {
      onClick();
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      whileTap={{ scale: 0.92 }}
      animate={isListening ? { scale: [1, 1.15, 1] } : {}}
      transition={isListening ? { repeat: Infinity, duration: 1.2 } : {}}
      className={`flex items-center justify-center transition-all duration-150 ${className}`}
      style={{
        width: 32,
        height: 32,
        borderRadius: 9999,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: isListening ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
        color: isListening ? '#ef4444' : '#9e8dc0',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isListening && !disabled) {
          e.currentTarget.style.background = 'rgba(64,41,112,0.08)';
          e.currentTarget.style.color = '#402970';
        }
      }}
      onMouseLeave={(e) => {
        if (!isListening && !disabled) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#9e8dc0';
        }
      }}
      title={title}
    >
      {isListening ? (
        <Mic size={17} strokeWidth={2} style={{ animation: 'pulse 1s infinite' }} />
      ) : (
        <Mic size={17} strokeWidth={2} />
      )}
    </motion.button>
  );
};

export default VoiceButton;
