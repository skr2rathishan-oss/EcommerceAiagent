export interface AnalyticsEvent {
  event: string;
  timestamp: string;
  metadata: any;
}

export const trackEvent = (event: string, metadata: any = {}) => {
  const newEvent: AnalyticsEvent = {
    event,
    timestamp: new Date().toISOString(),
    metadata,
  };

  try {
    const existing = localStorage.getItem("velora_analytics");
    const events: AnalyticsEvent[] = existing ? JSON.parse(existing) : [];
    events.push(newEvent);
    localStorage.setItem("velora_analytics", JSON.stringify(events));
  } catch (err) {
    console.error("Failed to persist analytics event to localStorage", err);
  }
};
