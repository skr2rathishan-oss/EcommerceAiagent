const EMOTION_PATTERNS = {
  romantic: [
    "girlfriend",
    "boyfriend",
    "wife",
    "husband",
    "love",
    "anniversary",
    "valentine",
    "romantic",
    "partner",
    "naughty",
    // Sinhala
    "ආදරෙ",
    "ආදරේ",
    "වැලන්ටයින්",
    "නෝනා",
    "මහත්තයා",
    // Tamil
    "காதல்",
    "மனைவி",
    "கணவன்",
    "வැලன்டைன்"
  ],

  apologetic: [
    "sorry",
    "apologize",
    "apology",
    "forgive",
    "broke up",
    "fight",
    "argument",
    "forgot birthday",
    "forgot anniversary",
    "make up",
    // Sinhala
    "සොරි",
    "සමාවෙන්න",
    "කණගාටුයි",
    "තරහා",
    // Tamil
    "ஸாரி",
    "மன்னிக்கவும்",
    "வருந்துகிறேன்",
    "கோபம்"
  ],

  caring: [
    "hospital",
    "sick",
    "unwell",
    "recovery",
    "get well",
    "health",
    "mother sick",
    "father sick",
    // Sinhala
    "හොස්පිට්ල්",
    "රෝහල",
    "සනීප නැතුව",
    "සනීප නැති",
    "අසනීප",
    "සුවවෙන්න",
    "සුවය",
    "අමාරු",
    // Tamil
    "ஹோஸ்பிட்டல்",
    "ஆஸ்பத்திரி",
    "உடம்பு சரியில்லை",
    "உடல்நிலை",
    "சுகம்",
    "குணமாக",
    "நோயாளி"
  ],

  celebration: [
    "birthday",
    "graduation",
    "promotion",
    "engagement",
    "wedding",
    "celebrate",
    "achievement",
    "new job",
    // Sinhala
    "උපන් දින",
    "උපන්දින",
    "බර්ත්ඩේ",
    "ග්‍රැඩුවේෂන්",
    "වෙඩින්",
    "සුභ පැතුම්",
    // Tamil
    "பிறந்தநாள்",
    "பிறந்த நாள்",
    "கல்யாணம்",
    "திருமணம்",
    "வாழ்த்துக்கள்"
  ],

  professional: [
    "boss",
    "manager",
    "client",
    "office",
    "corporate",
    "employee",
    "colleague",
    // Sinhala
    "බොස්",
    "කාර්යාලය",
    "සමාගම",
    // Tamil
    "பாஸ்",
    "அலுவலகம்"
  ],

  sympathy: [
    "funeral",
    "passed away",
    "loss",
    "condolence",
    "death",
    // Sinhala
    "මළගෙදර",
    "මියගිය",
    "නැතිවුණා",
    "නිවන් සුව",
    "කණගාටුව",
    // Tamil
    "இறப்பு",
    "மரணம்",
    "அஞ்சலி",
    "ஆழ்ந்த இரங்கல்"
  ]
};

export function detectEmotion(message = "") {
  const text = message.toLowerCase();

  const scores = {};

  Object.keys(EMOTION_PATTERNS).forEach(emotion => {
    scores[emotion] = 0;

    EMOTION_PATTERNS[emotion].forEach(keyword => {
      if (text.includes(keyword)) {
        scores[emotion] += 1;
      }
    });
  });

  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);

  const [emotion, score] = sorted[0];

  return {
    emotion: score > 0 ? emotion : "neutral",
    confidence: score > 0
      ? Math.min(score / 3, 1)
      : 0.2
  };
}