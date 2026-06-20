import React, { useState, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Paperclip, Mic, ArrowUp, Square, AudioLines, Sparkles } from "lucide-react";

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
  onOpenVoiceChat?: () => void;
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
  onOpenVoiceChat,
}) => {
  const [focused, setFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-resize textarea height dynamically based on content (uses useLayoutEffect to prevent visual jumping)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 120);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
  }, [value, textareaRef]);


  const handleVoiceClick = () => {
    if (isListening) return;
    setIsListening(true);

    const mockQueries = [
      "Gaming laptops",
      "Casual shirts",
      "iPhone vs Samsung",
      "Gift ideas for friend",
      "Best leather shoes"
    ];
    const randomQuery = mockQueries[Math.floor(Math.random() * mockQueries.length)];

    let counter = 0;
    let currentText = "";

    const interval = setInterval(() => {
      if (counter < randomQuery.length) {
        currentText += randomQuery[counter];
        onChange(currentText);
        counter++;
      } else {
        clearInterval(interval);
        setIsListening(false);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    }, 50);
  };

  return (
    <>
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
            placeholder={isListening ? "Listening..." : isMobile ? "Ask Velora..." : "Ask for products, comparisons, or shopping advice..."}
            disabled={isListening}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground"
            style={{
              lineHeight: 1.4,
              minHeight: 32,
              maxHeight: 120,
              fontFamily: "'Nunito',sans-serif",
              fontSize: 13.5,
              paddingTop: 6,
              paddingBottom: 6,
              border: "none",
            }}
          />
          <div className="flex items-center gap-1.5 flex-none" style={{ flexShrink: 0 }}>
            {/* Recording / Voice Message Button (visible next to the main button when empty) */}
            {!isTyping && !canSend && (
              <motion.button
                type="button"
                onClick={handleVoiceClick}
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
                title="Voice recording"
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
                onClick={() => onOpenVoiceChat && onOpenVoiceChat()}
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
                <AudioLines size={17} strokeWidth={2} />
              </motion.button>
            )}
          </div>
        </div>
      </div>
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
