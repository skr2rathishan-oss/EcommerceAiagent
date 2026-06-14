import React, { useState } from "react";
import { motion } from "motion/react";
import { Paperclip, Mic, ArrowUp } from "lucide-react";

interface ChatInputBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  canSend: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const ChatInputBox: React.FC<ChatInputBoxProps> = ({
  value,
  onChange,
  onSend,
  onKeyDown,
  canSend,
  textareaRef,
  fileInputRef,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: 9999,
        border: `1.5px solid ${focused ? "rgba(64,41,112,0.55)" : "rgba(64,41,112,0.15)"}`,
        boxShadow: "none",
        transition: "border-color 0.18s",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <input ref={fileInputRef} type="file" multiple className="hidden" aria-label="Upload file" />
        <IconBtn onClick={() => fileInputRef.current?.click()} title="Attach file">
          <Paperclip size={18} strokeWidth={2} />
        </IconBtn>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Message…"
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground"
          style={{
            lineHeight: 1.4,
            minHeight: 28,
            maxHeight: 120,
            fontFamily: "'Nunito',sans-serif",
            fontSize: 14,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        />
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          <IconBtn title="Voice message">
            <Mic size={17} strokeWidth={2} />
          </IconBtn>
          <motion.button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            whileTap={canSend ? { scale: 0.9 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              flexShrink: 0,
              border: "none",
              cursor: canSend ? "pointer" : "default",
              background: canSend ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.1)",
              color: canSend ? "#fff" : "#b8aed0",
              transition: "background 0.18s,color 0.18s",
            }}
          >
            <ArrowUp size={17} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
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
