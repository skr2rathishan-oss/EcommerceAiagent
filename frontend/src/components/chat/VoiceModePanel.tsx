import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Square } from "lucide-react";

type VoiceModeState = "listening" | "processing" | "speaking";

interface VoiceModePanelProps {
  isOpen: boolean;
  voiceState: VoiceModeState;
  transcript: string;
  isListening: boolean;
  onToggleListening: () => void;
  onStop: () => void;
  onClose: () => void;
}

const stateLabelMap: Record<VoiceModeState, string> = {
  listening: "Listening...",
  processing: "Thinking...",
  speaking: "Velora is speaking...",
};

const VoiceStatus: React.FC<{ voiceState: VoiceModeState }> = ({ voiceState }) => (
  <div className="rounded-[28px] border border-[#7c4dba]/10 bg-[#f9f5ff] px-4 py-3 shadow-sm sm:px-5">
    <p className="text-sm font-semibold text-[#402970]">{stateLabelMap[voiceState]}</p>
    <p className="mt-1 text-xs leading-5 text-[#7c6a9e]">Listen, speak, and watch Velora turn voice commands into chat interactions.</p>
  </div>
);

const Transcript: React.FC<{ transcript: string }> = ({ transcript }) => (
  <div className="rounded-[32px] border border-[#7c4dba]/10 bg-white px-4 py-4 text-sm leading-6 text-[#402970] shadow-[0_10px_30px_rgba(124,77,186,0.06)] sm:px-5">
    {transcript ? (
      <p className="whitespace-pre-wrap break-words">{transcript}</p>
    ) : (
      <p className="text-[#7c6a9e]">Speak naturally and Velora will capture your words here.</p>
    )}
  </div>
);

const AnimatedMicButton: React.FC<{
  voiceState: VoiceModeState;
  isListening: boolean;
  onToggleListening: () => void;
}> = ({ voiceState, isListening, onToggleListening }) => {
  const animateProps =
    voiceState === "listening"
      ? {
          scale: [1, 1.08, 1],
          boxShadow: [
            "0 0 0 0 rgba(124,77,186,0.16)",
            "0 0 0 18px rgba(124,77,186,0.08)",
            "0 0 0 0 rgba(124,77,186,0.16)",
          ],
        }
      : voiceState === "processing"
      ? {
          rotate: [0, 6, 0, -6, 0],
        }
      : {
          boxShadow: [
            "0 0 0 0 rgba(124,77,186,0)",
            "0 0 0 24px rgba(124,77,186,0.16)",
            "0 0 0 0 rgba(124,77,186,0)",
          ],
        };

  return (
    <motion.button
      type="button"
      onClick={onToggleListening}
      whileTap={{ scale: 0.96 }}
      animate={animateProps}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#7c4dba]/20 bg-gradient-to-br from-[#7c4dba] to-[#5b21b6] text-white shadow-[0_24px_60px_rgba(124,77,186,0.18)] focus:outline-none focus:ring-4 focus:ring-[#a37ff6]/25 sm:h-28 sm:w-28"
      aria-label={isListening ? "Pause listening" : "Resume listening"}
      title={isListening ? "Pause listening" : "Resume listening"}
    >
      <span className="absolute inset-0 rounded-full bg-white/10" />
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      <Mic size={28} strokeWidth={2.5} className="relative z-10 text-white" />
    </motion.button>
  );
};

const StopButton: React.FC<{ onStop: () => void }> = ({ onStop }) => (
  <button
    type="button"
    onClick={onStop}
    className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-[#7c4dba]/15 bg-white px-5 py-3 text-sm font-semibold text-[#5b21b6] shadow-sm transition hover:bg-[#f5efff] focus:outline-none"
  >
    <Square size={14} strokeWidth={2} />
    End voice mode
  </button>
);

export const VoiceModePanel: React.FC<VoiceModePanelProps> = ({
  isOpen,
  voiceState,
  transcript,
  isListening,
  onToggleListening,
  onStop,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="w-full max-w-full rounded-[32px] border border-[#7c4dba]/10 bg-[#faf8ff] px-4 py-5 shadow-[0_18px_40px_rgba(124,77,186,0.08)] sm:px-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <VoiceStatus voiceState={voiceState} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#7c4dba]/15 bg-white text-[#5b21b6] transition hover:bg-[#f5efff] focus:outline-none"
              aria-label="Close voice mode"
            >
              ×
            </button>
          </div>

          <div className="mt-4">
            <Transcript transcript={transcript} />
          </div>

          <div className="mt-5 flex flex-col items-center gap-3">
            <AnimatedMicButton
              voiceState={voiceState}
              isListening={isListening}
              onToggleListening={onToggleListening}
            />
            <StopButton onStop={onStop} />
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};
