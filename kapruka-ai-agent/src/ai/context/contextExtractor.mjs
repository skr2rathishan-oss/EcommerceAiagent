import { detectEmotion } from "./emotionDetector.mjs";
import { detectSituation } from "./situationDetector.mjs";

export function extractContext(message) {
  const emotionResult = detectEmotion(message);
  const situationResult = detectSituation(message);

  return {
    emotion: emotionResult.emotion,
    emotionConfidence: emotionResult.confidence,

    situation: situationResult.situation,
    urgency: situationResult.urgency,
    situationConfidence: situationResult.confidence
  };
}