import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

export const DEFAULT_SUGGESTIONS = [
  "👞 Best Leather Shoes",
  "📱 iPhone vs Samsung",
  "💻 Gaming Laptops",
  "🎧 Wireless Earbuds",
  "⌚ Smart Watches"
];

const getSuggestionSubtitle = (p: string) => {
  const lower = p.toLowerCase();
  if (lower.includes("shoes")) return "Explore footwear";
  if (lower.includes("iphone") || lower.includes("samsung")) return "Compare specs";
  if (lower.includes("laptops") || lower.includes("laptop")) return "Discover laptops";
  if (lower.includes("earbuds") || lower.includes("buds")) return "Premium audio";
  if (lower.includes("watches") || lower.includes("watch")) return "Track health";
  return "Ask Velora AI";
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
        emoji = "💻 ";
      } else if (queryLower.includes("shirt") || queryLower.includes("clothing") || queryLower.includes("casual") || queryLower.includes("men")) {
        emoji = "👕 ";
      } else if (queryLower.includes("phone") || queryLower.includes("iphone") || queryLower.includes("samsung") || queryLower.includes("compare")) {
        emoji = "📱 ";
      } else if (queryLower.includes("gift") || queryLower.includes("friend") || queryLower.includes("idea") || queryLower.includes("present")) {
        emoji = "🎁 ";
      } else if (queryLower.includes("earbuds") || queryLower.includes("buds") || queryLower.includes("audio")) {
        emoji = "🎧 ";
      } else if (queryLower.includes("watch") || queryLower.includes("smartwatch") || queryLower.includes("wearable")) {
        emoji = "⌚ ";
      } else if (queryLower.includes("shoe") || queryLower.includes("sneaker") || queryLower.includes("footwear")) {
        emoji = "👞 ";
      }

      prompts.unshift(`${emoji}${trimmed}`);
    }

    // Keep up to 5 items
    prompts = prompts.slice(0, 5);
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
        setPrompts(loaded.slice(0, 5));
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
          setPrompts(loaded.slice(0, 5));
        } catch {
          setPrompts(DEFAULT_SUGGESTIONS);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <div className="w-full mt-7 text-left select-none">
      <h3 style={{ color: "#1a1025", fontSize: 14, fontWeight: 800, letterSpacing: "0.03em", marginBottom: 12, textTransform: "uppercase", paddingLeft: 4 }}>
        💡 Suggested Searches
      </h3>
      <div 
        className="w-full grid grid-cols-2 sm:grid-cols-5 gap-3"
      >
        <style>{`
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
            
            // Extract Emoji
            const emojiMatch = prompt.match(/^(?:[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF])/);
            const emoji = emojiMatch ? emojiMatch[0] : "💬";
            const isSelected = selectedPrompt === prompt;
            const subtitle = getSuggestionSubtitle(cleanText);

            return (
              <motion.div
                key={prompt}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
                whileHover={isSelected ? {} : { 
                  y: -3,
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderColor: "rgba(124, 77, 186, 0.35)",
                  boxShadow: "0 6px 16px rgba(64, 41, 112, 0.06)"
                }}
                whileTap={isSelected ? {} : { scale: 0.98 }}
                onClick={() => {
                  setSelectedPrompt(prompt);
                  onSelect(cleanText);
                }}
                className={`group relative flex flex-col justify-between border cursor-pointer transition-all duration-200 ${
                  isSelected ? "animate-gradient" : ""
                }`}
                style={{
                  minHeight: 84,
                  background: isSelected 
                    ? "linear-gradient(135deg, #7c4dba, #9b59d0, #402970)" 
                    : "rgba(255, 255, 255, 0.65)",
                  backdropFilter: "blur(8px)",
                  borderColor: isSelected ? "transparent" : "rgba(64, 41, 112, 0.12)",
                  borderRadius: 14,
                  padding: 12,
                  boxShadow: isSelected ? "0 6px 20px rgba(124, 77, 186, 0.3)" : "none"
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4, display: "flex", justifycontent: "flex-start" }}>
                  {emoji}
                </div>
                <div>
                  <h4 
                    style={{ 
                      color: isSelected ? "#ffffff" : "#1a1025", 
                      fontSize: 12.5, 
                      fontWeight: 750, 
                      margin: 0,
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {cleanText}
                  </h4>
                  <p 
                    style={{ 
                      color: isSelected ? "rgba(255, 255, 255, 0.75)" : "#7c6a9e", 
                      fontSize: 10, 
                      fontWeight: 500, 
                      margin: "2px 0 0 0",
                      lineHeight: 1.25
                    }}
                  >
                    {subtitle}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
