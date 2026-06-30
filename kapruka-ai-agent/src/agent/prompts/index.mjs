// Core Prompts
import { IDENTITY_PROMPT } from "./core/01_identity.prompt.mjs";
import { MISSION_PROMPT } from "./core/02_mission.prompt.mjs";
import { PERSONALITY_PROMPT } from "./core/03_personality.prompt.mjs";
import { SAFETY_PROMPT } from "./core/04_safety.prompt.mjs";
import { LOCALIZATION_PROMPT } from "./core/05_localization.prompt.mjs";

// Commerce Prompts
import { SHOPPING_PROMPT } from "./commerce/11_shopping.prompt.mjs";
import { DELIVERY_PROMPT } from "./commerce/12_delivery.prompt.mjs";
import { CHECKOUT_PROMPT } from "./commerce/13_checkout.prompt.mjs";
import { ORDERS_PROMPT } from "./commerce/14_orders.prompt.mjs";
import { TRACKING_PROMPT } from "./commerce/15_tracking.prompt.mjs";

// Communication Prompts
import { WRITING_STYLE_PROMPT } from "./communication/16_writingStyle.prompt.mjs";
import { VOICE_PROMPT } from "./communication/17_voice.prompt.mjs";
import { CLARIFICATION_PROMPT } from "./communication/18_clarification.prompt.mjs";
import { RECOVERY_PROMPT } from "./communication/19_recovery.prompt.mjs";

// Intelligence Prompts
import { COMMERCE_PROMPT } from "./intelligence/06_commerce.prompt.mjs";
import { CUSTOMER_PSYCHOLOGY_PROMPT } from "./intelligence/07_customerPsychology.prompt.mjs";
import { CONVERSATION_STRATEGY_PROMPT } from "./intelligence/08_conversationStrategy.prompt.mjs";
import { RECOMMENDATION_STRATEGY_PROMPT } from "./intelligence/09_recommendationStrategy.prompt.mjs";
import { RESPONSE_LIBRARY_PROMPT } from "./intelligence/10_responseLibrary.prompt.mjs";
import { REFERENCE_PROMPT } from "./intelligence/10b_reference.prompt.mjs";

export const Core = {
  identity: IDENTITY_PROMPT,
  mission: MISSION_PROMPT,
  personality: PERSONALITY_PROMPT,
  safety: SAFETY_PROMPT,
  localization: LOCALIZATION_PROMPT
};

export const Commerce = {
  shopping: SHOPPING_PROMPT,
  delivery: DELIVERY_PROMPT,
  checkout: CHECKOUT_PROMPT,
  orders: ORDERS_PROMPT,
  tracking: TRACKING_PROMPT
};

export const Communication = {
  writingStyle: WRITING_STYLE_PROMPT,
  voice: VOICE_PROMPT,
  clarification: CLARIFICATION_PROMPT,
  recovery: RECOVERY_PROMPT
};

export const Intelligence = {
  commerce: COMMERCE_PROMPT,
  customerPsychology: CUSTOMER_PSYCHOLOGY_PROMPT,
  conversationStrategy: CONVERSATION_STRATEGY_PROMPT,
  recommendationStrategy: RECOMMENDATION_STRATEGY_PROMPT,
  responseLibrary: RESPONSE_LIBRARY_PROMPT,
  reference: REFERENCE_PROMPT
};
