import React, { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useApp } from "../contexts/AppContext";
import { ShoppingMissionDashboard } from "./ShoppingMissionDashboard";

export function ShoppingMissionContainer() {
  const { shoppingMission } = useApp();
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shoppingMission || !shoppingMission.presentation) {
      setVisible(false);
      return;
    }

    const presentation = shoppingMission.presentation;
    if (presentation.showDashboard) {
      setVisible(true);
    } else {
      setVisible(false);
    }

    if (presentation.isCompleted) {
      setShowCompletionBanner(true);
      const timer = window.setTimeout(() => {
        setShowCompletionBanner(false);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [shoppingMission]);

  return (
    <AnimatePresence>
      {visible && shoppingMission && shoppingMission.presentation && (
        <div style={{ width: "100%", marginBottom: 16 }}>
          <ShoppingMissionDashboard
            mission={shoppingMission}
            showCompletionBanner={showCompletionBanner}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
