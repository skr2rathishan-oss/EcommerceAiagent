import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Cpu, CheckCircle2, XCircle, Loader2, RefreshCw,
  Zap, Globe, Code2, ChevronRight, AlertTriangle
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ModelInfo {
  displayName: string;
  provider: string;
  model: string;
}

interface AIModeConfig {
  current: { mode: string; label: string; badge: string; source: string };
  models: {
    generalChat:      ModelInfo;
    recommendations:  ModelInfo;
    intentDetect:     ModelInfo;
    deliveryRecovery: ModelInfo;
    checkout:         ModelInfo;
    summary:          ModelInfo;
  };
  availableModes: Array<{ key: string; label: string; badge: string; active: boolean }>;
  logging: { verbose: boolean; promptDebug: boolean; toolLogs: boolean; tokenLogs: boolean; consoleTrace: boolean };
}

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, apiJson } from "../services/api";

const API_BASE = "/api/admin";

const MODE_COLORS: Record<string, { bg: string; border: string; badge: string; glow: string }> = {
  development: {
    bg:     "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    border: "rgba(251,191,36,0.5)",
    badge:  "#b45309",
    glow:   "0 0 20px rgba(251,191,36,0.25)",
  },
  staging: {
    bg:     "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
    border: "rgba(14,165,233,0.4)",
    badge:  "#0369a1",
    glow:   "0 0 20px rgba(14,165,233,0.2)",
  },
  production: {
    bg:     "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)",
    border: "rgba(236,72,153,0.4)",
    badge:  "#9d174d",
    glow:   "0 0 20px rgba(236,72,153,0.2)",
  },
};

const PROVIDER_COLORS: Record<string, string> = {
  nvidia: "#76b900",
  gemini: "#4285f4",
};

const ROLE_LABELS: Record<string, string> = {
  generalChat:      "General Chat",
  recommendations:  "Recommendations",
  intentDetect:     "Intent Detection",
  deliveryRecovery: "Delivery Recovery",
  checkout:         "Checkout Assist",
  summary:          "Summarisation",
};

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

const ProviderBadge: React.FC<{ provider: string }> = ({ provider }) => (
  <span
    style={{
      display:      "inline-flex",
      alignItems:   "center",
      gap:          3,
      padding:      "2px 7px",
      borderRadius: 9999,
      fontSize:     9,
      fontWeight:   800,
      textTransform:"uppercase",
      letterSpacing:"0.06em",
      color:        "#fff",
      background:   PROVIDER_COLORS[provider] || "#6b7280",
      fontFamily:   "'Nunito', sans-serif",
    }}
  >
    {provider === "nvidia" ? "NVIDIA" : provider === "gemini" ? "Gemini" : provider}
  </span>
);

const ModelRow: React.FC<{ role: string; info: ModelInfo }> = ({ role, info }) => (
  <div
    style={{
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      padding:        "9px 0",
      borderBottom:   "1px solid rgba(124,77,186,0.07)",
    }}
  >
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#7c6a9e", fontFamily: "'Nunito',sans-serif" }}>
        {ROLE_LABELS[role] || role}
      </p>
      <p
        style={{
          margin: "2px 0 0",
          fontSize: 12,
          fontWeight: 600,
          color: "#1a1025",
          fontFamily: "'Nunito',sans-serif",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 200,
        }}
      >
        {info.displayName}
      </p>
    </div>
    <ProviderBadge provider={info.provider} />
  </div>
);

const LoggingRow: React.FC<{ label: string; enabled: boolean }> = ({ label, enabled }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
    <span style={{ fontSize: 11, color: "#7c6a9e", fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>{label}</span>
    {enabled
      ? <CheckCircle2 size={14} color="#22c55e" />
      : <XCircle     size={14} color="#d1d5db" />
    }
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main AdminPanel
// ─────────────────────────────────────────────────────────────────────────────

export const AdminPanel: React.FC<AdminPanelProps> = ({ open, onClose }) => {
  const [config,    setConfig]    = useState<AIModeConfig | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [flash,     setFlash]     = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson(`${API_BASE}/ai-mode`);
      if (data?.success) setConfig(data);
      else setError(data?.message || "Failed to load configuration.");
    } catch {
      setError("Cannot reach server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchConfig();
  }, [open, fetchConfig]);

  const handleSwitch = async (mode: string) => {
    if (mode === config?.current.mode) return;
    setSwitching(mode);
    setError(null);
    try {
      const res  = await apiFetch(`${API_BASE}/ai-mode`, {
        method:  "POST",
        body:    JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.success) {
        setFlash(`✓ Switched to ${data.label} ${data.badge}`);
        setTimeout(() => setFlash(null), 3000);
        await fetchConfig();
      } else {
        setError(data.message || "Switch failed.");
      }
    } catch {
      setError("Network error — could not switch mode.");
    } finally {
      setSwitching(null);
    }
  };

  const currentMode  = config?.current.mode || "development";
  const modeStyle    = MODE_COLORS[currentMode] || MODE_COLORS.development;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="admin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position:   "fixed",
              inset:      0,
              background: "rgba(10,6,20,0.45)",
              backdropFilter: "blur(4px)",
              zIndex:     1000,
            }}
          />

          {/* Panel */}
          <motion.div
            key="admin-panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            style={{
              position:   "fixed",
              right:      0,
              top:        0,
              bottom:     0,
              width:      420,
              maxWidth:   "100vw",
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px)",
              borderLeft: "1.5px solid rgba(124,77,186,0.18)",
              boxShadow:  "-12px 0 48px rgba(64,41,112,0.18)",
              zIndex:     1001,
              display:    "flex",
              flexDirection: "column",
              fontFamily: "'Nunito', sans-serif",
              overflow:   "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding:    "20px 24px 16px",
                borderBottom: "1.5px solid rgba(124,77,186,0.1)",
                background: "linear-gradient(135deg, rgba(124,77,186,0.06) 0%, rgba(64,41,112,0.04) 100%)",
                display:    "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "linear-gradient(135deg, #7c4dba, #402970)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(124,77,186,0.3)",
                  }}
                >
                  <Cpu size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1a1025" }}>
                    AI Environment
                  </h2>
                  <p style={{ margin: 0, fontSize: 11, color: "#7c6a9e", fontWeight: 600 }}>
                    Model routing & mode management
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={fetchConfig}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: "1.5px solid rgba(124,77,186,0.18)",
                    background: "rgba(124,77,186,0.05)", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", color: "#7c4dba",
                  }}
                  title="Refresh"
                >
                  <RefreshCw size={13} strokeWidth={2.5} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: "1.5px solid rgba(124,77,186,0.18)",
                    background: "rgba(124,77,186,0.05)", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", color: "#7c4dba",
                  }}
                >
                  <X size={14} strokeWidth={2.5} />
                </motion.button>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

              {/* Flash message */}
              <AnimatePresence>
                {flash && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    style={{
                      padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                      background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
                      border: "1.5px solid rgba(34,197,94,0.3)",
                      color: "#065f46", fontSize: 12, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <CheckCircle2 size={14} /> {flash}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error message */}
              {error && (
                <div
                  style={{
                    padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                    background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
                    border: "1.5px solid rgba(239,68,68,0.3)",
                    color: "#991b1b", fontSize: 12, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              {loading && !config ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 10 }}>
                  <Loader2 size={18} color="#7c4dba" style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ color: "#7c6a9e", fontSize: 13, fontWeight: 600 }}>Loading configuration…</span>
                </div>
              ) : config ? (
                <>
                  {/* Current Mode Card */}
                  <div
                    style={{
                      padding:      "16px",
                      borderRadius: 14,
                      background:   modeStyle.bg,
                      border:       `1.5px solid ${modeStyle.border}`,
                      boxShadow:    modeStyle.glow,
                      marginBottom: 20,
                    }}
                  >
                    <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: modeStyle.badge }}>
                      Active Mode
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <h3 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 900, color: "#1a1025" }}>
                          {config.current.label}
                        </h3>
                        <span
                          style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 6,
                            background: modeStyle.badge, color: "#fff",
                            fontSize: 10, fontWeight: 800, letterSpacing: "0.05em",
                          }}
                        >
                          {config.current.badge}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: 10, color: modeStyle.badge, fontWeight: 700 }}>
                          {config.current.source === "persisted" ? "🔒 Persisted" : "📄 Env Var"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Switch Mode Buttons */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7c6a9e" }}>
                      Switch Environment
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {config.availableModes.map((m) => {
                        const ms = MODE_COLORS[m.key] || MODE_COLORS.development;
                        const isActive  = m.active;
                        const isLoading = switching === m.key;
                        return (
                          <motion.button
                            key={m.key}
                            whileHover={!isActive ? { scale: 1.01 } : {}}
                            whileTap={!isActive ? { scale: 0.98 } : {}}
                            onClick={() => !isActive && handleSwitch(m.key)}
                            style={{
                              display:     "flex",
                              alignItems:  "center",
                              justifyContent: "space-between",
                              padding:     "12px 14px",
                              borderRadius: 10,
                              border:      `1.5px solid ${isActive ? ms.border : "rgba(124,77,186,0.12)"}`,
                              background:  isActive ? ms.bg : "rgba(255,255,255,0.7)",
                              cursor:      isActive ? "default" : "pointer",
                              opacity:     isLoading ? 0.7 : 1,
                              transition:  "all 0.18s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  width: 8, height: 8, borderRadius: "50%",
                                  background: isActive ? ms.badge : "rgba(124,77,186,0.25)",
                                  boxShadow:  isActive ? `0 0 6px ${ms.badge}` : "none",
                                }}
                              />
                              <div style={{ textAlign: "left" }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: isActive ? "#1a1025" : "#402970" }}>
                                  {m.label}
                                </p>
                                <p style={{ margin: 0, fontSize: 10, color: "#7c6a9e", fontWeight: 600 }}>
                                  {m.badge}
                                </p>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isActive  && <span style={{ fontSize: 10, fontWeight: 800, color: ms.badge, background: ms.border, padding: "2px 6px", borderRadius: 5 }}>ACTIVE</span>}
                              {isLoading && <Loader2 size={14} color="#7c4dba" style={{ animation: "spin 1s linear infinite" }} />}
                              {!isActive && !isLoading && <ChevronRight size={14} color="#7c6a9e" />}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Model Assignments */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7c6a9e", display: "flex", alignItems: "center", gap: 5 }}>
                      <Zap size={12} color="#7c4dba" /> Model Assignments
                    </p>
                    <div
                      style={{
                        background: "rgba(124,77,186,0.03)",
                        border: "1.5px solid rgba(124,77,186,0.1)",
                        borderRadius: 12,
                        padding: "4px 14px",
                      }}
                    >
                      {Object.entries(config.models).map(([role, info]) => (
                        <ModelRow key={role} role={role} info={info} />
                      ))}
                    </div>
                  </div>

                  {/* Logging Settings */}
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7c6a9e", display: "flex", alignItems: "center", gap: 5 }}>
                      <Code2 size={12} color="#7c4dba" /> Logging & Debug
                    </p>
                    <div
                      style={{
                        background: "rgba(124,77,186,0.03)",
                        border: "1.5px solid rgba(124,77,186,0.1)",
                        borderRadius: 12,
                        padding: "6px 14px",
                      }}
                    >
                      <LoggingRow label="Verbose Logs"      enabled={config.logging.verbose} />
                      <LoggingRow label="Prompt Debug"      enabled={config.logging.promptDebug} />
                      <LoggingRow label="Tool Execution Logs" enabled={config.logging.toolLogs} />
                      <LoggingRow label="Token Usage Logs"  enabled={config.logging.tokenLogs} />
                      <LoggingRow label="Console Tracing"   enabled={config.logging.consoleTrace} />
                    </div>
                  </div>

                  {/* Provider Info */}
                  <div
                    style={{
                      marginTop: 16,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(124,77,186,0.04)",
                      border: "1.5px solid rgba(124,77,186,0.1)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Globe size={14} color="#7c4dba" />
                    <p style={{ margin: 0, fontSize: 11, color: "#7c6a9e", fontWeight: 600 }}>
                      Mode changes take effect <strong style={{ color: "#402970" }}>immediately</strong> — no server restart required. Settings are persisted to MongoDB.
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>

          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
};
