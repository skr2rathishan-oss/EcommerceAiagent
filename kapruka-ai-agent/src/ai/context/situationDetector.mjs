const SITUATION_PATTERNS = {
  forgot_birthday: [
    "forgot birthday",
    "forgot my wife's birthday",
    "forgot my girlfriend birthday",
    "missed birthday",
    // Sinhala
    "අමතක වුණා උපන්දින",
    "උපන්දිනේ අමතක",
    "බර්ත්ඩේ එක අමතක",
    // Tamil
    "பிறந்தநாள் மறந்து",
    "மறந்துவிட்டேன்"
  ],

  apology: [
    "sorry",
    "apology",
    "make up",
    "forgive me",
    "broke up",
    "fight",
    // Sinhala
    "සොරි",
    "සමාවෙන්න",
    "රණ්ඩුව",
    // Tamil
    "ஸாரி",
    "மன்னிக்கவும்"
  ],

  surprise: [
    "surprise",
    "secret gift",
    "special surprise",
    // Sinhala
    "සප්‍රයිස්",
    "රහස් තෑග්ග",
    // Tamil
    "ஆச்சரியம்",
    "சர்ப்ரைஸ்"
  ],

  last_minute: [
    "today",
    "urgent",
    "asap",
    "tomorrow",
    "immediately",
    "last minute",
    // Sinhala
    "අදම",
    "අද",
    "හෙට",
    "ඉක්මනින්ම",
    "හදිසි",
    // Tamil
    "இன்று",
    "நாளை",
    "அவசரம்",
    "உடனே"
  ],

  self_purchase: [
    "for myself",
    "for me",
    "i need",
    "buying for myself",
    "personal use",
    // Sinhala
    "මටමයි",
    "මට ගන්න",
    "මගේ පාවිච්චියට",
    // Tamil
    "எனக்காக",
    "எனக்கு"
  ],

  celebration: [
    "birthday",
    "graduation",
    "promotion",
    "engagement",
    "wedding",
    // Sinhala
    "උපන්දින",
    "වෙඩින්",
    "සුභ පැතුම්",
    // Tamil
    "பிறந்தநாள்",
    "திருமணம்"
  ]
};

export function detectSituation(message = "") {
  const text = message.toLowerCase();

  let detectedSituation = "general";

  let highestScore = 0;

  Object.entries(SITUATION_PATTERNS).forEach(([situation, patterns]) => {
    let score = 0;

    patterns.forEach(pattern => {
      if (text.includes(pattern)) {
        score++;
      }
    });

    if (score > highestScore) {
      highestScore = score;
      detectedSituation = situation;
    }
  });

  let urgency = "normal";

  if (
    text.includes("today") ||
    text.includes("urgent") ||
    text.includes("asap") ||
    text.includes("immediately") ||
    text.includes("tomorrow")
  ) {
    urgency = "high";
  }

  return {
    situation: detectedSituation,
    urgency,
    confidence:
      highestScore > 0
        ? Math.min(highestScore / 3, 1)
        : 0.3
  };
}