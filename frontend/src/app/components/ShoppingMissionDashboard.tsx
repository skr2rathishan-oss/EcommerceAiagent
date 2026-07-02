import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Clock3, CircleDot, Sparkles, ArrowRight, DollarSign } from "lucide-react";
import { formatUIPrice } from "../services/mapping";

export interface MissionItemStatus {
  id: string;
  category: string;
  brand?: string | null;
  status: string;
  selectedProduct: any | null;
  budget: number | null;
}

export interface ShoppingMissionPresentation {
  progressPercentage: number;
  selectedCount: number;
  totalCount: number;
  completedItems: number;
  remainingItems: number;
  remainingBudget: number;
  estimatedSpent: number;
  currentCategory: string | null;
  currentProduct: any | null;
  currentItemIndex: number;
  nextAction: string;
  statusLabel: string;
  activeStatus: string;
  showDashboard: boolean;
  isCompleted: boolean;
  completionTimestamp: string | null;
  itemStatusMap: MissionItemStatus[];
}

interface Props {
  mission: {
    id?: string;
    occasion?: string | null;
    recipient?: string | null;
    budget?: number | null;
    currency?: string;
    status?: string;
    presentation: ShoppingMissionPresentation;
  };
  showCompletionBanner?: boolean;
}

const statusMeta = {
  COMPLETED: { label: "Completed", icon: CheckCircle2, color: "#10b981" },
  SELECTED: { label: "Selected", icon: CheckCircle2, color: "#10b981" },
  SEARCHING: { label: "Searching", icon: Clock3, color: "#7c4dba" },
  AWAITING_SELECTION: { label: "Awaiting Selection", icon: CircleDot, color: "#f59e0b" },
  PENDING: { label: "Pending", icon: CircleDot, color: "#94a3b8" },
  OUT_OF_STOCK: { label: "Out of Stock", icon: CircleDot, color: "#ec4899" },
  RESELECT_REQUIRED: { label: "Reselect", icon: CircleDot, color: "#f97316" }
};

function getItemStatusMeta(status: string) {
  return statusMeta[status as keyof typeof statusMeta] || statusMeta.PENDING;
}

export function ShoppingMissionDashboard({ mission, showCompletionBanner = false }: Props) {
  const presentation = mission.presentation;
  const missionItems = presentation.itemStatusMap;
  const currentCategory = presentation.currentCategory || "Your next item";
  const currentHint = presentation.currentProduct?.name || presentation.nextAction;

  return (
    <div
      className="w-full"
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(18px)",
        border: "1.5px solid rgba(124, 77, 186, 0.16)",
        borderRadius: 22,
        padding: "18px",
        boxShadow: "0 18px 40px rgba(64, 41, 112, 0.12)",
        color: "#1a1025"
      }}
    >
      <AnimatePresence>
        {showCompletionBanner && (
          <motion.div
            key="mission-complete-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "linear-gradient(90deg, #7c4dba, #a855f7)",
              color: "#ffffff",
              borderRadius: 16,
              padding: "12px 14px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 13 }}>
                <Sparkles className="w-4 h-4" />
                <span>🎉 Mission Complete</span>
              </div>
              <p style={{ margin: 0, marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
                Great work! Your shopping mission is ready and can now move to checkout.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7c4dba" }}>
              🎁 Shopping Mission
            </p>
            <h3 style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>
              {mission.occasion ? `${mission.occasion}` : "Gift mission"}
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6d597a" }}>
              {mission.recipient ? `for ${mission.recipient}` : "for your customer"}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#7c4dba", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {presentation.statusLabel}
            </span>
            <span style={{ display: "block", marginTop: 6, fontSize: 10.5, fontWeight: 800, color: "#1f1236" }}>
              {presentation.selectedCount}/{presentation.totalCount} items
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ height: 8, background: "#ede4ff", borderRadius: 999, overflow: "hidden" }}>
                <motion.div
                  initial={false}
                  animate={{ width: `${Math.max(0, Math.min(100, presentation.progressPercentage))}%` }}
                  transition={{ type: "spring", stiffness: 140, damping: 20 }}
                  style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #7c4dba, #a855f7)" }}
                />
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#4b367c" }}> {presentation.progressPercentage}% </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#f8f2ff", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#7c4dba", fontWeight: 800, textTransform: "uppercase" }}>Budget</p>
              <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 900, color: "#1f1236" }}>
                {formatUIPrice(mission.budget ?? 0, mission.currency)}
              </p>
            </div>
            <div style={{ background: "#f8f2ff", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#7c4dba", fontWeight: 800, textTransform: "uppercase" }}>Remaining</p>
              <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 900, color: presentation.remainingBudget < 0 ? "#ec4899" : "#1f1236" }}>
                {formatUIPrice(presentation.remainingBudget, mission.currency)}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(124,77,186,0.12)", borderRadius: 16, padding: "12px 14px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#7c4dba", textTransform: "uppercase" }}>Selected</p>
            <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 800, color: "#1a1025" }}>{presentation.selectedCount}</p>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid rgba(124,77,186,0.12)", borderRadius: 16, padding: "12px 14px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#7c4dba", textTransform: "uppercase" }}>Remaining</p>
            <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 800, color: "#1a1025" }}>{presentation.remainingItems}</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#7c4dba", textTransform: "uppercase" }}>Mission items</p>
          <div style={{ display: "grid", gap: 10 }}>
            {missionItems.map(item => {
              const meta = getItemStatusMeta(item.status);
              const isActive = item.category === presentation.currentCategory && item.status !== "COMPLETED";
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 16,
                    border: `1px solid ${isActive ? "rgba(124,77,186,0.28)" : "rgba(229,231,235,0.9)"}`,
                    background: isActive ? "rgba(252,241,255,0.82)" : "#ffffff"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <meta.icon size={16} color={meta.color} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1a1025", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.brand ? `${item.brand} ` : ""}{item.category}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6d597a" }}>
                        {item.selectedProduct?.name ? item.selectedProduct.name : meta.label}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: meta.color }}>
                      {meta.label}
                    </p>
                    {item.budget != null && (
                      <p style={{ margin: "4px 0 0", fontSize: 10, color: "#7c4dba" }}>
                        {formatUIPrice(item.budget, mission.currency)}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", paddingTop: 4 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#7c4dba", textTransform: "uppercase" }}>Current</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 800, color: "#1a1025", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentCategory}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6d597a" }}>{currentHint}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 999, background: "rgba(124,77,186,0.12)", color: "#7c4dba" }}>
            <ArrowRight size={18} />
          </div>
        </div>
      </div>
    </div>
  );
}
