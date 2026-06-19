import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Paperclip, Mic, ArrowUp, Square, Headphones, Sparkles } from "lucide-react";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { VoiceIndicator } from "./ui/VoiceIndicator";

interface ChatInputBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  canSend: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isTyping?: boolean;
  onStop?: () => void;
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
  variant = "bottom",
}) => {
  const [focused, setFocused] = useState(false);
  const [voiceChatOpen, setVoiceChatOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  // Initialize voice assistant hook
  const {
    transcript,
    isListening,
    isSpeaking,
    error,
    isSupported: isVoiceSupported,
    startListening,
    stopListening,
    clearTranscript,
    clearError,
  } = useVoiceAssistant({
    lang: 'en-US',
    continuous: false,
    interimResults: true,
  });

  // Update input field when transcript changes
  useEffect(() => {
    if (transcript && transcript.trim()) {
      onChange(transcript);
    }
  }, [transcript, onChange]);

  // Simulated Voice Call Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (voiceChatOpen) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [voiceChatOpen]);

  // Stop listening when user starts typing manually
  useEffect(() => {
    if (value && isListening) {
      stopListening();
    }
  }, [value, isListening, stopListening]);

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

  const handleVoiceClick = () => {
    if (isListening) {
      stopListening();
    } else {
      clearTranscript();
      clearError();
      startListening();
    }
  };

  const handleVoiceStop = () => {
    stopListening();
    // Focus input after stopping
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <>
      <VoiceIndicator 
        isListening={isListening}
        isSpeaking={isSpeaking}
        error={error}
        transcript={transcript}
        position="top"
        onDismissError={clearError}
      />
      
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
            placeholder={isListening ? "Listening..." : "Ask for products, comparisons, or shopping advice..."}
            disabled={isListening}
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
            {/* Voice Button - visible when field is empty and not typing */}
            {!isTyping && !canSend && isVoiceSupported && (
              <motion.button
                type="button"
                onClick={handleVoiceClick}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (isListening) handleVoiceStop();
                }}
                whileTap={{ scale: 0.92 }}
                animate={isListening ? { scale: [1, 1.15, 1] } : {}}
                transition={isListening ? { repeat: Infinity, duration: 1.2 } : {}}
                className="flex items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  border: "none",
                  cursor: "pointer",
                  background: isListening ? "rgba(239, 68, 68, 0.12)" : "transparent",
                  color: isListening ? "#ef4444" : "#9e8dc0",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={e => {
                  if (!isListening) {
                    e.currentTarget.style.background = "rgba(64,41,112,0.08)";
                    e.currentTarget.style.color = "#402970";
                  }
                }}
                onMouseLeave={e => {
                  if (!isListening) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#9e8dc0";
                  }
                }}
                title={isListening ? "Stop listening (right-click)" : "Start voice input"}
              >
                <Mic size={17} strokeWidth={2} />
              </motion.button>
            )}

            {/* Main Action Button (in the send button slot) */}
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
            ) : (
              <motion.button
                type="button"
                onClick={() => setVoiceChatOpen(true)}
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
                  background: "#7c4dba",
                  color: "#fff",
                  transition: "background 0.18s",
                }}
                title="Voice Chat"
              >
                <Headphones size={17} strokeWidth={2} />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Voice Chat Overlay */}
      <AnimatePresence>
        {voiceChatOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{
              background: "rgba(26, 16, 37, 0.88)",
              backdropFilter: "blur(20px)",
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex flex-col items-center gap-6 text-white text-center p-8 max-w-sm"
            >
              <h3 className="text-xl font-bold font-['Nunito'] tracking-wide">Velora Voice Chat</h3>
              <p className="text-sm text-purple-300 font-semibold tracking-wider">{formatDuration(callDuration)}</p>
              
              {/* Pulsing Audio Waveform visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-16 my-4">
                {[1.5, 2.5, 4, 5.5, 6, 5.5, 4, 2.5, 1.5].map((val, idx) => (
                  <motion.div 
                    key={idx}
                    className="bg-purple-400 rounded-full"
                    style={{ width: 4.5, height: 16 }}
                    animate={{ height: [16, val * 9, 16] }}
                    transition={{ repeat: Infinity, duration: 0.9, delay: idx * 0.07 }}
                  />
                ))}
              </div>
              
              <p className="text-sm text-purple-200">Listening to your voice...</p>
              
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setVoiceChatOpen(false)}
                className="mt-6 flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 9999,
                  border: "none",
                  cursor: "pointer",
                  color: "#fff",
                  boxShadow: "0 6px 20px rgba(239, 68, 68, 0.4)"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /><line x1="23" y1="1" x2="1" y2="23" /></svg>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
