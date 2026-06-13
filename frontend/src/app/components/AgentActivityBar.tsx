import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface LogItem {
  id: string;
  title: string;
  status: "pending" | "active" | "completed" | "error";
  details?: string[];
}

interface AgentActivityBarProps {
  currentStep: string;
  currentMessage: string;
  logs: LogItem[];
  error?: boolean;
  onRetry?: () => void;
  expandedState?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function AgentActivityBar({
  currentStep,
  currentMessage,
  logs,
  error,
  onRetry,
  expandedState,
  onExpandedChange
}: AgentActivityBarProps) {
  const [visualStage, setVisualStage] = useState(0);
  const [stage4MinDurationPassed, setStage4MinDurationPassed] = useState(false);
  const [nonSearchTimeoutPassed, setNonSearchTimeoutPassed] = useState(false);

  const isSearchFlow = logs.some(log => log.id === "SEARCHING");

  // State Machine Timers & Triggers
  useEffect(() => {
    if (error) return;

    if (isSearchFlow) {
      if (visualStage === 0) {
        const timer = setTimeout(() => {
          setVisualStage(1);
        }, 1500);
        return () => clearTimeout(timer);
      } else if (visualStage === 3) {
        const timer = setTimeout(() => {
          setVisualStage(4);
        }, 800);
        return () => clearTimeout(timer);
      } else if (visualStage === 4) {
        setStage4MinDurationPassed(false);
        const timer = setTimeout(() => {
          setStage4MinDurationPassed(true);
        }, 800);
        return () => clearTimeout(timer);
      } else if (visualStage === 5) {
        const timer = setTimeout(() => {
          setVisualStage(6);
        }, 800);
        return () => clearTimeout(timer);
      }
    } else {
      // Non-search flow (compact details/tracking/delivery)
      if (visualStage === 0) {
        const timer = setTimeout(() => {
          setNonSearchTimeoutPassed(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [visualStage, isSearchFlow, error]);

  // Monitor logs to advance stages in search flow
  useEffect(() => {
    if (error || !isSearchFlow) return;

    const isSearchingActiveOrDone = logs.some(log => log.id === "SEARCHING" && (log.status === "active" || log.status === "completed"));
    const isSearchingCompleted = logs.some(log => log.id === "SEARCHING" && log.status === "completed");
    const isRankingActiveOrDone = logs.some(log => log.id === "RANKING" && (log.status === "active" || log.status === "completed")) || logs.some(log => log.id === "READY" && (log.status === "active" || log.status === "completed"));

    if (visualStage === 1 && isSearchingActiveOrDone) {
      setVisualStage(2);
    } else if (visualStage === 2 && isSearchingCompleted) {
      setVisualStage(3);
    } else if (visualStage === 4 && stage4MinDurationPassed && isRankingActiveOrDone) {
      setVisualStage(5);
    }
  }, [logs, visualStage, stage4MinDurationPassed, isSearchFlow, error]);

  // Determine visual configuration based on current stage
  let uiLoader: "spinner" | "dots" | "error" = "spinner";
  let uiText = "";
  let showText = false;

  if (error) {
    uiLoader = "error";
    uiText = "Search failed";
    showText = true;
  } else if (isSearchFlow) {
    switch (visualStage) {
      case 0:
        uiLoader = "spinner";
        uiText = "";
        showText = false;
        break;
      case 1:
        uiLoader = "spinner";
        uiText = "Understanding your request";
        showText = true;
        break;
      case 2:
        uiLoader = "spinner";
        uiText = "Searching products";
        showText = true;
        break;
      case 3:
        uiLoader = "dots";
        uiText = "";
        showText = false;
        break;
      case 4:
        uiLoader = "spinner";
        uiText = "Ranking best matches";
        showText = true;
        break;
      case 5:
        uiLoader = "dots";
        uiText = "";
        showText = false;
        break;
      case 6:
      default:
        uiLoader = "spinner";
        uiText = "Preparing recommendations";
        showText = true;
        break;
    }
  } else {
    // Non-search flow logic
    if (visualStage === 0 && !nonSearchTimeoutPassed) {
      uiLoader = "spinner";
      uiText = "";
      showText = false;
    } else {
      uiLoader = "spinner";
      showText = true;
      const msg = currentMessage.toLowerCase();
      if (msg.includes("details")) {
        uiText = "Fetching product details";
      } else if (msg.includes("tracking") || msg.includes("status")) {
        uiText = "Retrieving order status";
      } else if (msg.includes("delivery")) {
        uiText = "Checking delivery availability";
      } else {
        uiText = currentMessage.replace(/\.\.\.$/, "");
      }
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      style={{
        width: "fit-content",
        height: 40,
        margin: "0 0 12px 0",
        alignSelf: "flex-start",
        display: "flex",
        alignItems: "center",
        gap: showText && uiText ? 10 : 0,
        padding: showText && uiText ? "0 16px" : "0 14px",
        background: "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(8px)",
        border: error ? "1px solid rgba(212, 24, 61, 0.35)" : "1px solid rgba(64, 41, 112, 0.1)",
        borderRadius: "18px 18px 18px 6px",
        boxShadow: "0 2px 10px rgba(64, 41, 112, 0.08)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Dynamic Loader Icon Container */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, flexShrink: 0, transform: "translateY(1.5px)" }}>
        <AnimatePresence mode="wait">
          {uiLoader === "spinner" && (
            <motion.span
              key="spinner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              style={{ display: "inline-block", width: 18, height: 18 }}
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 18,
                  border: "2.5px solid rgba(124, 77, 186, 0.2)",
                  borderTopColor: "#7c4dba",
                  borderRadius: "50%",
                  boxSizing: "border-box",
                }}
              />
            </motion.span>
          )}

          {uiLoader === "dots" && (
            <motion.span
              key="dots"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "inline-flex", gap: 3, alignItems: "center" }}
            >
              <motion.span
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#7c4dba", display: "inline-block" }}
              />
              <motion.span
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#7c4dba", display: "inline-block" }}
              />
              <motion.span
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#7c4dba", display: "inline-block" }}
              />
            </motion.span>
          )}

          {uiLoader === "error" && (
            <motion.span
              key="error"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="15" height="15" viewBox="0 0 12 12" fill="none" stroke="#d4183d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2l8 8M10 2L2 10" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Dynamic Text Message Container */}
      <AnimatePresence mode="wait">
        {showText && uiText && (
          <motion.span
            key={uiText}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{
              color: error ? "#d4183d" : "#1a1025",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Nunito', sans-serif",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {uiText}
            {error && onRetry && (
              <button
                onClick={onRetry}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#7c4dba",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "underline",
                  marginLeft: 8,
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                Retry
              </button>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
