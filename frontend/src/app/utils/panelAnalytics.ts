/**
 * Panel analytics helper — tracks open/submit events in localStorage.
 * Extracted from SmartInputPanel.tsx for reuse across all panel components.
 */
export const logPanelEvent = (panel: string, event: "opened" | "submitted") => {
  const label = event === "opened" ? "Opened" : "Submitted";
  console.log(`[PANEL] ${panel.charAt(0).toUpperCase() + panel.slice(1)} Panel ${label}`);

  try {
    const key = "velora_panel_analytics";
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {
      recommendation: { opened: 0, completed: 0 },
      delivery: { opened: 0, completed: 0 },
      track_order: { opened: 0, completed: 0 },
      checkout: { opened: 0, completed: 0 }
    };

    if (data[panel]) {
      if (event === "opened") {
        data[panel].opened += 1;
      } else {
        data[panel].completed += 1;
      }
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (err) {
    console.error("Failed to write panel analytics:", err);
  }
};
