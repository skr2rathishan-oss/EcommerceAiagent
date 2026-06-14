import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

export const DEFAULT_SUGGESTIONS = [
  "🛍️ Gaming laptops",
  "👕 Casual shirts",
  "📱 iPhone vs Samsung"
];

// Helper to limit the word count within the box
export const limitWords = (text: string, maxWords: number = 3) => {
  try {
    const emojiMatch = text.match(/^(?:[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF])\s*/);
    const emoji = emojiMatch ? emojiMatch[0] : "";
    const rest = text.substring(emoji.length).trim();
    
    const words = rest.split(/\s+/);
    if (words.length <= maxWords) return text;
    return emoji + words.slice(0, maxWords).join(" ") + "...";
  } catch {
    return text;
  }
};

export const trackQueryUsage = (query: string) => {
  try {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3) return;

    // Load existing list or use defaults
    const saved = localStorage.getItem("velora_suggested_prompts");
    let prompts: string[] = saved ? JSON.parse(saved) : [...DEFAULT_SUGGESTIONS];

    // Check if the query matches an existing suggestion (ignoring leading emoji/case)
    const cleanQuery = trimmed.toLowerCase();

    const getCleanPromptText = (p: string) => {
      return p
        .replace(/^(?:[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF])\s*/, "")
        .trim()
        .toLowerCase();
    };

    const existingIndex = prompts.findIndex(p => getCleanPromptText(p) === cleanQuery);

    if (existingIndex !== -1) {
      // Move existing to the front
      const existing = prompts[existingIndex];
      prompts.splice(existingIndex, 1);
      prompts.unshift(existing);
    } else {
      // Determine appropriate emoji based on keywords
      let emoji = "💬 ";
      const queryLower = trimmed.toLowerCase();
      if (queryLower.includes("laptop") || queryLower.includes("computer") || queryLower.includes("gaming") || queryLower.includes("pc")) {
        emoji = "🛍️ ";
      } else if (queryLower.includes("shirt") || queryLower.includes("clothing") || queryLower.includes("casual") || queryLower.includes("men")) {
        emoji = "👕 ";
      } else if (queryLower.includes("phone") || queryLower.includes("iphone") || queryLower.includes("samsung") || queryLower.includes("compare")) {
        emoji = "📱 ";
      } else if (queryLower.includes("gift") || queryLower.includes("friend") || queryLower.includes("idea") || queryLower.includes("present")) {
        emoji = "🎁 ";
      }

      prompts.unshift(`${emoji}${trimmed}`);
    }

    // Keep up to 3 items
    prompts = prompts.slice(0, 3);
    localStorage.setItem("velora_suggested_prompts", JSON.stringify(prompts));
  } catch (e) {
    console.warn("Failed to track query in localStorage:", e);
  }
};

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelect }) => {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("velora_suggested_prompts");
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        setPrompts(loaded.slice(0, 3));
      } catch {
        setPrompts(DEFAULT_SUGGESTIONS);
      }
    } else {
      setPrompts(DEFAULT_SUGGESTIONS);
    }

    // Sync state if localStorage changes in other components or hooks
    const handleStorage = () => {
      const currentSaved = localStorage.getItem("velora_suggested_prompts");
      if (currentSaved) {
        try {
          const loaded = JSON.parse(currentSaved);
          setPrompts(loaded.slice(0, 3));
        } catch {
          setPrompts(DEFAULT_SUGGESTIONS);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <div 
      className="w-full flex items-center justify-center gap-1.5 mt-3 px-2 overflow-x-auto no-scrollbar"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradientShift 1.2s ease infinite;
        }
      `}</style>
      <AnimatePresence mode="popLayout">
        {prompts.map((prompt) => {
          // Remove emoji prefix for actual query submission
          const cleanText = prompt.replace(/^(?:[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF])\s*/, "");
          const isSelected = selectedPrompt === prompt;

          return (
            <motion.div
              key={prompt}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
              whileHover={isSelected ? {} : { 
                backgroundColor: "rgba(124, 77, 186, 0.08)",
                borderColor: "rgba(124, 77, 186, 0.3)",
                boxShadow: "0 2px 8px rgba(64, 41, 112, 0.05)"
              }}
              onClick={() => {
                setSelectedPrompt(prompt);
                onSelect(cleanText);
              }}
              className={`group relative flex items-center px-3 py-1.5 rounded-full border cursor-pointer select-none transition-all duration-150 ${
                isSelected ? "animate-gradient" : ""
              }`}
              style={{
                background: isSelected 
                  ? "linear-gradient(135deg, #7c4dba, #9b59d0, #402970)" 
                  : "rgba(255, 255, 255, 0.65)",
                backdropFilter: "blur(6px)",
                borderColor: isSelected ? "transparent" : "rgba(64, 41, 112, 0.12)",
                color: isSelected ? "#ffffff" : "#402970",
                fontSize: "12px",
                fontWeight: 600,
                fontFamily: "'Nunito', sans-serif",
                whiteSpace: "nowrap",
                maxWidth: "210px",
              }}
            >
              <span className="truncate">{prompt}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
