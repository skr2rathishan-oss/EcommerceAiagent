import React from 'react';
import { Mic } from 'lucide-react';
import { motion } from 'motion/react';

interface VoiceButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onClick,
  disabled = false,
  title = "Activate voice mode",
}) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center transition-all"
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: hovered && !disabled ? 'rgba(124, 77, 186, 0.1)' : 'transparent',
        color: disabled ? '#9ca3af' : '#7c4dba',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.15s, color 0.15s',
      }}
      aria-label={title}
      title={title}
    >
      <Mic size={18} strokeWidth={2.5} />
    </motion.button>
  );
};
