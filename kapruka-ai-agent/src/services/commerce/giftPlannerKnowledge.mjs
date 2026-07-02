export const STOP_WORDS = new Set([
  "the",
  "and",
  "a",
  "of",
  "with",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "an",
  "is",
  "it",
  "from",
  "this",
  "that"
]);

export const GREETINGS_BLACKLIST = new Set([
  "hi",
  "hello",
  "hey",
  "hola",
  "namaste",
  "vanakkam",
  "greetings",
  "good",
  "morning",
  "evening",
  "afternoon",
  "arey",
  "ney",
  "machan",
  "mams",
  "please",
  "help",
  "yes",
  "no",
  "ok",
  "okay"
]);

export const BRAND_ALIASES = Object.freeze([
  "samsung",
  "apple",
  "nike",
  "gflock",
  "sony",
  "kapruka",
  "office",
  "leather"
]);

export const CATEGORY_ALIASES = Object.freeze({
  "silk dress": "Silk Dress",
  "dress": "Silk Dress",
  phone: "Phone",
  mobile: "Phone",
  smartphone: "Phone",
  cellphone: "Phone",
  watch: "Watch",
  watches: "Watch",
  shirt: "Shirt",
  shirts: "Shirt",
  shoe: "Shoes",
  shoes: "Shoes",
  flower: "Flowers",
  flowers: "Flowers",
  bouquet: "Flowers",
  blossom: "Flowers",
  perfume: "Perfume",
  fragrances: "Perfume",
  cake: "Cake",
  cakes: "Cake",
  jewellery: "Jewellery",
  jewelry: "Jewellery",
  necklace: "Jewellery",
  pendants: "Jewellery",
  chocolate: "Chocolate",
  chocolates: "Chocolate",
  "personal care": "Personal Care",
  earbuds: "Personal Care",
  buds: "Personal Care"
});

export const OCCASION_ALIASES = Object.freeze({
  birthday: "Birthday",
  wedding: "Wedding",
  anniversary: "Anniversary",
  graduation: "Graduation",
  mothers_day: "Mother's Day",
  fathers_day: "Father's Day",
  "mother's day": "Mother's Day",
  "father's day": "Father's Day",
  christmas: "Christmas",
  valentine: "Valentine's Day",
  valentines: "Valentine's Day",
  "valentine's": "Valentine's Day"
});

export const RECIPIENT_ALIASES = Object.freeze({
  father: "Father",
  dad: "Father",
  mother: "Mother",
  mom: "Mother",
  mummy: "Mother",
  brother: "Brother",
  sister: "Sister",
  friend: "Friend",
  girlfriend: "Girlfriend",
  gf: "Girlfriend",
  boyfriend: "Boyfriend",
  bf: "Boyfriend",
  wife: "Wife",
  husband: "Husband",
  child: "Child",
  son: "Child",
  daughter: "Child"
});

export const CURRENCY_ALIASES = Object.freeze({
  lkr: "LKR",
  rs: "LKR",
  usd: "USD",
  dollars: "USD",
  dollar: "USD",
  "$": "USD"
});

export const CATEGORY_PATTERNS = Object.freeze([
  { pattern: /phone|mobile|smartphone|cellphone/, category: "Phone" },
  { pattern: /watch|watches/, category: "Watch" },
  { pattern: /shirt|shirts/, category: "Shirt" },
  { pattern: /shoe|shoes|footwear/, category: "Shoes" },
  { pattern: /flower|flowers|bouquet|blossom/, category: "Flowers" },
  { pattern: /perfume|fragrance|cologne/, category: "Perfume" },
  { pattern: /cake|cakes|gateau/, category: "Cake" },
  { pattern: /jewel|jewelry|jewellery|necklace|pendant|gold/, category: "Jewellery" },
  { pattern: /chocolate|chocolates|cadbury|toblerone/, category: "Chocolate" },
  { pattern: /silk\s+dress|dress|gown/, category: "Silk Dress" },
  { pattern: /earbud|buds|personal\s+care/, category: "Personal Care" }
]);

/**
 * SUPPORTED_CATEGORIES — Single source of truth for all valid shopping categories.
 * Derived from the unique normalized values in CATEGORY_ALIASES.
 * Every module must validate against this set; no duplicated category lists.
 */
export const SUPPORTED_CATEGORIES = Object.freeze(
  new Set(Object.values(CATEGORY_ALIASES))
);
