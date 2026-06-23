/**
 * useChat — composer hook.
 *
 * Logic has been split into focused sub-hooks:
 *   - useProductActions → product select / action popup / product details
 *   - useDeliveryCheck  → free-text address input delivery validation
 *   - useSearch         → performSearch / handleRetry / handleStop
 *
 * This hook wires them together and provides the unified `handleSend` entry point
 * that decides which flow to trigger based on message content.
 */
import React from "react";
import { useApp } from "../contexts/AppContext";
import { useProductActions } from "./useProductActions";
import { useDeliveryCheck } from "./useDeliveryCheck";
import { useSearch } from "./useSearch";
import { trackQueryUsage } from "../components/SuggestedPrompts";

export const useChat = () => {
  const {
    phase, setPhase,
    value, setValue,
    setMessages,
    waitingForAddressInput,
    setActiveSmartPanel,
    voiceDashboardOpen,
  } = useApp();

  const { handleProductSelect, handleProductAction, handleRequestProductDetails } = useProductActions();
  const { handleAddressInput } = useDeliveryCheck();
  const { performSearch, handleRetry, handleStop } = useSearch();

  const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";

  const handleSend = async (textOverride?: string, customCommerceState?: any) => {
    const trimmed = typeof textOverride === "string" ? textOverride.trim() : value.trim();
    if (!trimmed) return;

    trackQueryUsage(trimmed);

    if (phase === "centered") setPhase("bottom");
    setMessages(prev => [...prev, { role: "user", text: trimmed }]);
    setValue("");

    // ── Address input flow ─────────────────────────────────────────────────
    if (waitingForAddressInput && !textOverride) {
      await handleAddressInput(trimmed);
      return;
    }

    const lowerText = trimmed.toLowerCase();

    // ── Smart panel keyword shortcuts (Only if not in voice assistant mode) ──
    if (!voiceDashboardOpen) {
      const recKeywords = ["gift", "birthday gift", "recommend", "present", "surprise", "anniversary gift", "gift idea", "find gift", "shopping recommendation"];
      if (recKeywords.some(kw => lowerText.includes(kw))) {
        setActiveSmartPanel("recommendation");
        return;
      }

      const delKeywords = ["check delivery", "can this be delivered", "delivery cost"];
      if (delKeywords.some(kw => lowerText.includes(kw))) {
        setActiveSmartPanel("delivery");
        return;
      }

      if (lowerText.includes("track order")) {
        setActiveSmartPanel("track_order");
        return;
      }
    }

    // ── Default: AI search ────────────────────────────────────────────────
    performSearch(trimmed, customCommerceState);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return {
    // product actions
    handleProductSelect,
    handleProductAction,
    handleRequestProductDetails,
    // search
    performSearch,
    handleRetry,
    handleStop,
    // chat entry point
    handleSend,
    handleKeyDown,
    // util
    getSessionId,
  };
};
