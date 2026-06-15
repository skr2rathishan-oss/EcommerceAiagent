import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { ProductShowcase } from "./ProductShowcase";
import { type Product } from "./products";
import { InteractiveOrderSummary, type DeliveryInfo } from "./InteractiveOrderSummary";
import { ProductDetailsCard } from "./ProductDetailsCard";
import { OrderConfirmationCard } from "./OrderConfirmationCard";
import { OrderTrackingCard } from "./OrderTrackingCard";
import { AgentActivityBar } from "./AgentActivityBar";
import { type Message } from "../contexts/AppContext";
import { GuidedWorkflowPanel } from "./GuidedWorkflowPanel";
import { playVoice } from "../services/voiceServices";

interface MessageAreaProps {
  messages: Message[];
  selectedIds: Record<number, string | null>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Record<number, string | null>>>;
  onAddToCart: (p: Product) => void;
  onBuyNow: (p: Product, variants?: Record<string, string>) => void;
  onWishlist: (p: Product) => void;
  onPlaceInlineOrder: (index: number, info: DeliveryInfo) => void;
  isTyping: boolean;
  onViewDetails: (id: string) => void;
  onContinueShopping: () => void;
  onTrackOrder?: (orderNumber: string) => void;
  onSelectProduct?: (p: Product) => void;
  onAddToCartFromDetails?: (p: Product) => void;
  onBuyNowFromDetails?: (p: Product, variants?: Record<string, string>) => void;
  onWishlistFromDetails?: (p: Product) => void;
  activity: any;
  onRetry: () => void;
  activityExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export const MessageArea: React.FC<MessageAreaProps> = ({
  messages,
  onAddToCart,
  onBuyNow,
  onWishlist,
  onPlaceInlineOrder,
  isTyping,
  onViewDetails,
  onContinueShopping,
  onTrackOrder,
  onSelectProduct,
  onAddToCartFromDetails,
  onBuyNowFromDetails,
  onWishlistFromDetails,
  selectedIds,
  setSelectedIds,
  activity,
  onRetry,
  activityExpanded,
  onExpandedChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [voiceStates, setVoiceStates] = useState<Record<number, 'idle' | 'generating' | 'playing' | 'error'>>({});
  const [voiceErrors, setVoiceErrors] = useState<Record<number, string>>({});
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  const handleListen = async (index: number, text: string) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }

    setVoiceStates(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        const idx = Number(key);
        if (updated[idx] === 'playing' || updated[idx] === 'generating') {
          updated[idx] = 'idle';
        }
      });
      updated[index] = 'generating';
      return updated;
    });
    setVoiceErrors(prev => ({ ...prev, [index]: "" }));

    try {
      const cleanText = text
        .replace(/[*#_~`>]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();

      const audio = await playVoice(cleanText);
      activeAudioRef.current = audio;
      setVoiceStates(prev => ({ ...prev, [index]: 'playing' }));

      audio.onended = () => {
        setVoiceStates(prev => ({ ...prev, [index]: 'idle' }));
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
      };

      audio.onpause = () => {
        setVoiceStates(prev => ({ ...prev, [index]: 'idle' }));
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
      };
    } catch (err: any) {
      console.error("Voice playback failed:", err);
      setVoiceStates(prev => ({ ...prev, [index]: 'error' }));
      setVoiceErrors(prev => ({ ...prev, [index]: err.message || "Failed to play voice." }));

      setTimeout(() => {
        setVoiceStates(prev => prev[index] === 'error' ? { ...prev, [index]: 'idle' } : prev);
      }, 4000);
    }
  };

  const handleStop = (index: number) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setVoiceStates(prev => ({ ...prev, [index]: 'idle' }));
  };

  useEffect(() => {
    const activeProductId = Object.values(selectedIds).find(id => id !== null && id !== undefined);

    if (activeProductId) {
      const t = setTimeout(() => {
        const productEl = document.getElementById(`product-slot-${activeProductId}`);
        if (productEl) {
          productEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return () => clearTimeout(t);
    } else {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, selectedIds]);

  return (
    <div
      ref={scrollRef}
      className="w-full h-full overflow-y-auto px-4 py-6"
      style={{ scrollbarWidth: "none", overscrollBehavior: "contain", paddingBottom: 128, minHeight: 0 }}
    >
      <div className="flex flex-col gap-5 mx-auto" style={{ maxWidth: 760 }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "11px 16px",
                    borderRadius: msg.role === "user" ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                    background: msg.role === "user" ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(255,255,255,0.88)",
                    color: msg.role === "user" ? "#fff" : "#1a1025",
                    fontSize: 14,
                    lineHeight: 1.65,
                    fontFamily: "'Nunito',sans-serif",
                    boxShadow: msg.role === "user" ? "0 4px 14px rgba(64,41,112,0.28)" : "0 2px 10px rgba(64,41,112,0.08)",
                    backdropFilter: msg.role === "ai" ? "blur(8px)" : undefined,
                    border: msg.role === "ai" ? "1px solid rgba(64,41,112,0.1)" : "none",
                  }}
                >
                  {msg.role === "ai" ? (
                    <AIMessageRenderer text={msg.text} />
                  ) : (
                    msg.text
                  )}
                </div>
                {msg.role === "ai" && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => {
                        const state = voiceStates[i] || "idle";
                        if (state === "playing" || state === "generating") {
                          handleStop(i);
                        } else {
                          handleListen(i, msg.text);
                        }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#7c4dba",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        borderRadius: "14px",
                        backgroundColor: "rgba(124, 77, 186, 0.08)",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(124, 77, 186, 0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(124, 77, 186, 0.08)";
                      }}
                    >
                      {voiceStates[i] === "generating" && (
                        <>
                          <span className="voice-spinner">⏳</span>
                          Generating voice...
                        </>
                      )}
                      {voiceStates[i] === "playing" && (
                        <>
                          <span>⏸️</span>
                          Playing audio...
                        </>
                      )}
                      {(voiceStates[i] === "idle" || !voiceStates[i]) && (
                        <>
                          <span>🔊</span>
                          Listen
                        </>
                      )}
                      {voiceStates[i] === "error" && (
                        <>
                          <span>⚠️</span>
                          Retry
                        </>
                      )}
                    </button>
                    {voiceErrors[i] && (
                      <span style={{ fontSize: "11px", color: "#d93838", fontFamily: "'Nunito',sans-serif" }}>
                        {voiceErrors[i]}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {msg.role === "ai" && msg.products && msg.products.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}
                  style={{ marginTop: 12 }}
                >
                  <ProductShowcase
                    products={msg.products}
                    selectedId={selectedIds[i] ?? null}
                    onSelect={p => setSelectedIds(prev => ({ ...prev, [i]: p ? p.id : null }))}
                    onAddToCart={onAddToCart}
                    onBuyNow={onBuyNow}
                    onWishlist={onWishlist}
                    onViewDetails={onViewDetails}
                    onSelectProduct={onSelectProduct}
                  />
                </motion.div>
              )}

              {msg.role === "ai" && msg.type === "product_details" && msg.productDetails && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  style={{ marginTop: 12 }}
                >
                  <ProductDetailsCard
                    content={msg.productDetails.content}
                    product={msg.productDetails.product}
                    onAddToCart={onAddToCartFromDetails ?? onAddToCart}
                    onBuyNow={onBuyNowFromDetails ?? onBuyNow}
                    onWishlist={onWishlistFromDetails ?? onWishlist}
                  />
                </motion.div>
              )}

              {msg.role === "ai" && msg.orderSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}
                  style={{ marginTop: 12 }}
                >
                  <InteractiveOrderSummary
                    product={msg.orderSummary.product}
                    variants={msg.orderSummary.variants}
                    deliveryInfo={msg.orderSummary.deliveryInfo}
                    sellerInfo={msg.orderSummary.sellerInfo}
                    status={msg.orderSummary.status}
                    onPlaceOrder={(updatedDelivery) => onPlaceInlineOrder(i, updatedDelivery)}
                  />
                </motion.div>
              )}

              {msg.role === "ai" && msg.type === "order_confirmation" && msg.order && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  style={{ marginTop: 12 }}
                >
                  <OrderConfirmationCard
                    order={msg.order}
                    onContinueShopping={onContinueShopping}
                    onTrackOrder={onTrackOrder}
                  />
                </motion.div>
              )}

              {msg.role === "ai" && msg.type === "order_tracking" && msg.tracking && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  style={{ marginTop: 12 }}
                >
                  <OrderTrackingCard
                    orderNumber={msg.tracking.orderNumber}
                    initialTracking={msg.tracking}
                    onContinueShopping={onContinueShopping}
                  />
                </motion.div>
              )}

              {msg.role === "ai" && msg.type === "order_tracking_error" && msg.orderNumber && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  style={{ marginTop: 12 }}
                >
                  <OrderTrackingCard
                    orderNumber={msg.orderNumber}
                    onContinueShopping={onContinueShopping}
                  />
                </motion.div>
              )}
              {msg.role === "ai" && msg.type === "guided_workflow" && msg.workflow && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  style={{ marginTop: 12 }}
                >
                  <GuidedWorkflowPanel
                    messageIndex={i}
                    workflow={msg.workflow}
                  />
                </motion.div>
              )}
            </motion.div>
          ))}
          {isTyping && activity && (
            <AgentActivityBar
              currentStep={activity.currentStep}
              currentMessage={activity.currentMessage}
              logs={activity.logs}
              error={activity.error}
              onRetry={onRetry}
              expandedState={activityExpanded}
              onExpandedChange={onExpandedChange}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const AIMessageRenderer: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="ai-markdown-content">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .voice-spinner {
          display: inline-block;
          animation: spin 1.5s linear infinite;
        }
        .ai-markdown-content h1 {
          font-size: 1.35rem;
          font-weight: 800;
          margin-top: 14px;
          margin-bottom: 8px;
          color: #1a1025;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content h2 {
          font-size: 1.20rem;
          font-weight: 750;
          margin-top: 12px;
          margin-bottom: 6px;
          color: #1a1025;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content h3 {
          font-size: 1.05rem;
          font-weight: 700;
          margin-top: 10px;
          margin-bottom: 6px;
          color: #1a1025;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content p {
          margin: 0 0 10px 0;
          line-height: 1.65;
          white-space: pre-wrap;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content ul {
          margin: 6px 0 10px 0;
          padding-left: 20px !important;
          list-style-type: disc !important;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content ol {
          margin: 6px 0 10px 0;
          padding-left: 20px !important;
          list-style-type: decimal !important;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content li {
          margin-bottom: 4px;
          line-height: 1.5;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content strong {
          font-weight: 800;
          color: #402970;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content em {
          font-style: italic;
          font-family: 'Nunito', sans-serif;
        }
        .ai-markdown-content a {
          color: #7c4dba;
          text-decoration: underline;
          font-weight: 600;
        }
        .ai-markdown-content code {
          background-color: rgba(64, 41, 112, 0.08);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }
        .ai-markdown-content > :last-child {
          margin-bottom: 0 !important;
        }
        .ai-markdown-content > :first-child {
          margin-top: 0 !important;
        }
      `}} />
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
};
