/**
 * SmartInputPanel — Barrel re-export.
 *
 * The component logic has been split into focused modules under ./smart-panels/:
 *   - SmartInputPanelShell  → shell/router (~90 lines)
 *   - RecommendationForm    → gift recommendation wizard
 *   - DeliveryForm          → delivery availability checker
 *   - TrackOrderForm        → order tracking form
 *   - CheckoutForm          → checkout & order placement form
 *   - DeliveryRecoveryPanel → recovery option buttons
 *   - NearbyAddressPanel    → alternate address form
 *   - AlternativeDatePanel  → alternative date picker
 *
 * Consumers that import `SmartInputPanel` from this path are unaffected.
 */
export { SmartInputPanelShell as SmartInputPanel } from "./smart-panels/SmartInputPanelShell";

// Named re-exports for any file that imports individual panels directly
export { RecommendationForm } from "./smart-panels/RecommendationForm";
export { DeliveryForm } from "./smart-panels/DeliveryForm";
export { TrackOrderForm } from "./smart-panels/TrackOrderForm";
export { CheckoutForm } from "./smart-panels/CheckoutForm";
export { DeliveryRecoveryPanel } from "./smart-panels/DeliveryRecoveryPanel";
export { NearbyAddressPanel } from "./smart-panels/NearbyAddressPanel";
export { AlternativeDatePanel } from "./smart-panels/AlternativeDatePanel";
