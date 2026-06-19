import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Paperclip, ArrowUp, Square, Sparkles, Mic } from "lucide-react";
import { useVoiceAssistant } from "../../hooks/useVoiceAssistant";
import { VoiceButton } from "../../components/chat/VoiceButton";
import { VoiceModePanel } from "../../components/chat/VoiceModePanel";
import { speechService } from "../../services/speechService";

type VoiceModeState = "listening" | "processing" | "speaking";

interface ChatInputBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSend: (textOverride?: string) => void;  // Allow optional text override
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  canSend: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isTyping?: boolean;
  onStop?: () => void;
  onOpenChat?: () => void;
  variant?: "centered" | "bottom";
}

export const ChatInputBox: React.FC<ChatInputBoxProps> = ({
  value,
  onChange,
  onSend,
  onKeyDown,
  canSend,
  textareaRef,
  fileInputRef,
  isTyping,
  onStop,
  onOpenChat,
  variant = "bottom",
}) => {
  const [focused, setFocused] = useState(false);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceModeState>("listening");
  const [isVoiceSubmitted, setIsVoiceSubmitted] = useState(false);
  const voiceSubmittedRef = useRef(false);

  const {
    transcript,
    isListening,
    error,
    startListening,
    stopListening,
    setOnAutoSubmit,
    setOnRestartListening,
  } = useVoiceAssistant();

  // Track TTS state to restart listening after speech finishes
  useEffect(() => {
    const onTTSEnd = () => {
      if (
        voiceState === "speaking" &&
        voiceSubmittedRef.current &&
        voiceModeOpen
      ) {
        // TTS finished and we're still in voice mode - restart listening
        setVoiceState("listening");
        setIsVoiceSubmitted(false);
        voiceSubmittedRef.current = false;
        startListening();
      }
    };

    speechService.setOnSpeechEnd(onTTSEnd);

    return () => {
      speechService.clearOnSpeechEnd();
    };
  }, [voiceState, voiceModeOpen, startListening]);

  // Handle automatic submission when recognition ends
  useEffect(() => {
    setOnAutoSubmit((text: string) => {
      if (
        voiceModeOpen &&
        text.trim() &&
        !voiceSubmittedRef.current
      ) {
        voiceSubmittedRef.current = true;
        setIsVoiceSubmitted(true);
        setVoiceState("processing");
        // Use setTimeout to allow state updates to process
        setTimeout(() => {
          onSend(text);  // Pass text directly to handleSend as override
          setVoiceState("speaking");
        }, 0);
      }
    });
  }, [voiceModeOpen, onSend, setOnAutoSubmit, onChange]);

  // Update transcript in input value
  useEffect(() => {
    if (transcript && !isVoiceSubmitted) {
      onChange(transcript);
    }
  }, [transcript, onChange, isVoiceSubmitted]);

  // Stop listening if voice mode closes
  useEffect(() => {
    if (!voiceModeOpen && isListening) {
      stopListening();
    }
  }, [voiceModeOpen, isListening, stopListening]);

  const openVoiceMode = () => {
    onOpenChat?.();
    setVoiceModeOpen(true);
    setVoiceState("listening");
    setIsVoiceSubmitted(false);
    voiceSubmittedRef.current = false;
    onChange(""); // Clear any existing text
    startListening();
  };

  const closeVoiceMode = () => {
    setVoiceModeOpen(false);
    stopListening();
    speechService.stopSpeaking();
    setIsVoiceSubmitted(false);
    voiceSubmittedRef.current = false;
    // Restore focus to textarea after a brief delay for smooth UX
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
  };

  // Manual toggle is disabled during processing
  const toggleListening = () => {
    if (voiceState === "processing" || voiceState === "speaking") {
      return; // Prevent manual toggle during processing/speaking
    }

    if (isListening) {
      stopListening();
      setVoiceState("processing");
    } else {
      startListening();
      setVoiceState("listening");
    }
  };

  // Auto-resize textarea height dynamically based on content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 120);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
  }, [value, textareaRef]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {voiceModeOpen ? (
          <motion.div
            key="voice-panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <VoiceModePanel
              isOpen={voiceModeOpen}
              voiceState={voiceState}
              transcript={transcript}
              isListening={isListening}
              onToggleListening={toggleListening}
              onStop={closeVoiceMode}
              onClose={closeVoiceMode}
            />
          </motion.div>
        ) : (
          <motion.div
            key="text-input"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div
              style={{
                background: variant === "centered" ? "var(--card-bg, #ffffff)" : "rgba(255,255,255,0.92)",
                backdropFilter: "blur(12px)",
                borderRadius: 9999,
                border: variant === "centered"
                  ? `1.5px solid ${focused ? "rgba(124, 77, 186, 0.45)" : "var(--card-border, rgba(124, 77, 186, 0.18))"}`
                  : `1.5px solid ${focused ? "rgba(64,41,112,0.55)" : "rgba(64,41,112,0.15)"}`,
                boxShadow: variant === "centered" ? "0 8px 30px rgba(64, 41, 112, 0.06)" : "none",
                transition: "border-color 0.18s, box-shadow 0.18s",
              }}
            >
              <div className="flex items-center gap-2 px-4 py-2">
                {variant === "centered" ? (
                  <div style={{ display: "flex", alignItems: "center", color: "#7c4dba", paddingLeft: 6 }} className="flex-none">
                    <Sparkles size={16} strokeWidth={2.5} />
                  </div>
                ) : (
                  <>
                    <input ref={fileInputRef} type="file" multiple className="hidden" aria-label="Upload file" />
                    <IconBtn onClick={() => fileInputRef.current?.click()} title="Attach file" className="flex-none">
                      <Paperclip size={18} strokeWidth={2} />
                    </IconBtn>
                  </>
                )}

                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  onKeyDown={onKeyDown}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Ask for products, comparisons, or shopping advice..."
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground"
                  style={{
                    lineHeight: 1.4,
                    minHeight: 28,
                    maxHeight: 120,
                    fontFamily: "'Nunito',sans-serif",
                    fontSize: 13.5,
                    paddingTop: 4,
                    paddingBottom: 4,
                    border: "none",
                  }}
                />
                <div className="flex items-center gap-1.5 flex-none" style={{ flexShrink: 0 }}>
                  <VoiceButton
                    onClick={openVoiceMode}
                    disabled={isTyping}
                    title="Activate voice mode"
                  />

                  {isTyping ? (
                    <motion.button
                      type="button"
                      onClick={onStop}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="flex items-center justify-center animate-pulse"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9999,
                        flexShrink: 0,
                        border: "none",
                        cursor: "pointer",
                        background: "#e11d48",
                        color: "#fff",
                        transition: "background 0.18s",
                      }}
                      title="Stop responding"
                    >
                      <Square size={12} fill="#fff" strokeWidth={0} />
                    </motion.button>
                  ) : canSend ? (
                    <motion.button
                      type="button"
                      onClick={onSend}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="flex items-center justify-center"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9999,
                        flexShrink: 0,
                        border: "none",
                        cursor: "pointer",
                        background: "linear-gradient(135deg,#7c4dba,#402970)",
                        color: "#fff",
                        transition: "background 0.18s",
                      }}
                      title="Send message"
                    >
                      <ArrowUp size={17} strokeWidth={2.5} />
                    </motion.button>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface IconBtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}

const IconBtn: React.FC<IconBtnProps> = ({ children, onClick, title }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center"
      style={{
        width: 32,
        height: 32,
        borderRadius: 9999,
        border: "none",
        cursor: "pointer",
        background: hovered ? "rgba(64,41,112,0.08)" : "transparent",
        color: hovered ? "#402970" : "#9e8dc0",
        transition: "background 0.15s,color 0.15s",
      }}
    >
      {children}
    </button>
  );
};
