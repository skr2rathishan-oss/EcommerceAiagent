/**
 * Address Intelligence Module V1
 * Standalone address parsing, normalization, and validation service.
 */

export function expandAddressAbbreviations(text) {
  if (!text) return "";
  const ABBREVIATIONS = {
    no: "No",
    rd: "Road",
    st: "Street",
    ave: "Avenue",
    ln: "Lane",
    mw: "Mawatha",
    apt: "Apartment",
    bldg: "Building",
    flr: "Floor",
    jn: "Junction",
    dr: "Drive"
  };

  let expanded = text;
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    expanded = expanded.replace(regex, full);
  }
  return expanded;
}

export function normalizeSriLankanCityAliases(text) {
  if (!text) return "";
  const CITY_ALIASES = {
    colombo6: "Colombo 06",
    "colombo 6": "Colombo 06",
    colombo3: "Colombo 03",
    "colombo 3": "Colombo 03",
    col: "Colombo",
    cmb: "Colombo",
    kolombo: "Colombo",
    jafna: "Jaffna",
    jaffnaa: "Jaffna",
    kandyy: "Kandy",
    wellawatta: "Wellawatte"
  };

  let normalized = text;
  const sortedKeys = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const escaped = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    normalized = normalized.replace(regex, CITY_ALIASES[key]);
  }
  return normalized;
}

export function cleanAddressText(rawAddress) {
  if (!rawAddress) return "";

  // Standardize spaces and collapse duplicate commas
  let text = rawAddress.trim()
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();

  // Spacing for No25 / no.25 -> No 25
  text = text.replace(/\bno\.?\s*(\d+)/gi, "No $1");

  // Expand abbreviations
  text = expandAddressAbbreviations(text);

  // Normalize obvious Sri Lankan city aliases
  text = normalizeSriLankanCityAliases(text);

  // Capitalize first letter of every alphabetical word
  text = text.split(" ")
    .map(word => {
      if (word.length === 0) return "";
      if (/^[a-zA-Z]/.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");

  // Clean up spacing around commas
  text = text.replace(/\s*,\s*/g, ", ")
    .replace(/^,|,$/g, "")
    .trim();

  return text;
}

export function parseSriLankanAddress(cleanedAddress) {
  let houseNumber = null;
  let street = null;
  let area = null;
  let city = null;
  let postalCode = null;

  // 1. Detect City
  const cities = [
    "Colombo", "Kandy", "Jaffna", "Galle", "Matara", "Negombo", "Gampaha",
    "Kurunegala", "Kalutara", "Hambantota", "Ratnapura", "Badulla", "Kegalle",
    "Matale", "Nuwara Eliya", "Polonnaruwa", "Monaragala", "Mannar", "Kilinochchi",
    "Vavuniya", "Mullaitivu", "Trincomalee", "Batticaloa", "Ampara", "Puttalam",
    "Anuradhapura", "Dehiwala", "Mount Lavinia", "Nugegoda", "Moratuwa", "Kotte",
    "Wattala", "Kelaniya", "Rajagiriya", "Battaramulla"
  ];

  for (const c of cities) {
    const regex = new RegExp(`\\b${c}\\b(?!\\s+(?:Road|Street|Avenue|Lane|Mawatha|Drive|Junction|Highway|Bypass))`, "i");
    if (regex.test(cleanedAddress)) {
      city = c;
      break;
    }
  }

  // 2. Detect Postal Code
  const postal5Match = cleanedAddress.match(/\b\d{5}\b/);
  if (postal5Match) {
    postalCode = postal5Match[0];
  } else if (city === "Colombo") {
    const colomboZoneMatch = cleanedAddress.match(/\bColombo\s+(\d{1,2})\b/i);
    if (colomboZoneMatch) {
      postalCode = colomboZoneMatch[1].padStart(2, "0");
    } else {
      // Find 1- or 2-digit number near the end (excluding numbers connected to road names)
      const lastDigits = cleanedAddress.match(/\b(\d{1,2})\b(?=[^0-9]*$)/);
      if (lastDigits) {
        postalCode = lastDigits[1].padStart(2, "0");
      }
    }
  }

  // 3. Detect House Number
  const houseMatch = cleanedAddress.match(/\b(?:No|Number|Apt|Apartment|Flat|Shop|Room|Building|Bldg)\s*(\d+(?:[\/\-]\d+)?[A-Za-z]?)\b/i);
  if (houseMatch) {
    houseNumber = houseMatch[1];
  } else {
    const startDigits = cleanedAddress.match(/^\s*(\d+(?:[\/\-]\d+)?[A-Za-z]?)\b/i);
    if (startDigits) {
      houseNumber = startDigits[1];
    }
  }

  // 4. Detect Street
  const streetRegex = /\b([A-Za-z0-9'\s\-]+?\s+(?:Road|Street|Avenue|Lane|Mawatha|Drive|Junction|Mawata|Path|Gardens))\b/i;
  const streetMatch = cleanedAddress.match(streetRegex);
  if (streetMatch) {
    street = streetMatch[1].trim();
    if (houseNumber) {
      const prefixRegex = new RegExp(`^\\s*(?:No\\.?\\s*)?${houseNumber}\\b`, "i");
      street = street.replace(prefixRegex, "").trim();
    }
    street = street.replace(/^[\d\/\-\s]+(?!\d*(?:st|nd|rd|th)\b)/gi, "").trim();
  }

  // 5. Detect Area
  const knownAreas = [
    "Wellawatte", "Bambalapitiya", "Kollupitiya", "Borella", "Rajagiriya",
    "Battaramulla", "Nugegoda", "Dehiwala", "Mount Lavinia", "Moratuwa",
    "Panadura", "Wattala", "Kelaniya", "Kirulapone", "Havelock Town",
    "Cinnamon Gardens", "Slave Island", "Fort", "Pettah", "Kotahena",
    "Grandpass", "Maradana", "Panchikawatte", "Dematagoda", "Madampitiya",
    "Mattakkuliya", "Narahenpita", "Pamankada", "Thimbirigasyaya"
  ];

  for (const a of knownAreas) {
    const regex = new RegExp(`\\b${a}\\b`, "i");
    if (regex.test(cleanedAddress)) {
      area = a;
      break;
    }
  }

  if (!area && street && city) {
    const streetIndex = cleanedAddress.indexOf(street);
    const cityIndex = cleanedAddress.indexOf(city);
    if (streetIndex !== -1 && cityIndex !== -1 && cityIndex > streetIndex + street.length) {
      const middlePart = cleanedAddress.substring(streetIndex + street.length, cityIndex).trim();
      const cleanedMiddle = middlePart.replace(/^[\s,]+|[\s,]+$/g, "").trim();
      if (cleanedMiddle.length > 2 && !/\b\d+\b/.test(cleanedMiddle)) {
        area = cleanedMiddle;
      }
    }
  }

  return {
    houseNumber,
    street,
    area,
    city,
    postalCode
  };
}

export function normalizeColomboPostal(parsedAddress) {
  if (parsedAddress && parsedAddress.city === "Colombo" && parsedAddress.postalCode) {
    parsedAddress.postalCode = parsedAddress.postalCode.padStart(2, "0");
  }
}

export function buildNormalizedAddress(parsedAddress) {
  const parts = [];
  if (parsedAddress.houseNumber) {
    parts.push(`No ${parsedAddress.houseNumber}`);
  }
  if (parsedAddress.street) {
    parts.push(parsedAddress.street);
  }
  if (parsedAddress.area) {
    parts.push(parsedAddress.area);
  }
  let cityPart = parsedAddress.city || "";
  if (cityPart === "Colombo" && parsedAddress.postalCode) {
    cityPart = `Colombo ${parsedAddress.postalCode}`;
  } else if (parsedAddress.city && parsedAddress.postalCode) {
    cityPart = `${parsedAddress.city} ${parsedAddress.postalCode}`;
  }
  if (cityPart) {
    parts.push(cityPart);
  }
  return parts.join(", ");
}

export function calculateAddressConfidence(parsedAddress, rawAddress) {
  let score = 0;
  if (parsedAddress.city) score += 0.25;
  if (parsedAddress.street) score += 0.20;
  if (parsedAddress.houseNumber) score += 0.15;
  if (parsedAddress.area) score += 0.15;
  if (parsedAddress.postalCode) score += 0.10;

  // Structure / length check
  const rawWords = (rawAddress || "").trim().split(/\s+/).filter(Boolean);
  if (rawWords.length >= 4) {
    score += 0.10;
  }

  // Vague address check
  const lowerRaw = (rawAddress || "").toLowerCase();
  const vagueMarkers = ["near", "opposite", "behind", "close to", "bus stand"];
  if (vagueMarkers.some(marker => lowerRaw.includes(marker))) {
    score -= 0.20;
  }

  // Only city is present
  const nonCityFields = ["houseNumber", "street", "area", "postalCode"];
  const hasOtherFields = nonCityFields.some(f => parsedAddress[f] !== null);
  if (parsedAddress.city && !hasOtherFields) {
    score -= 0.20;
  }

  return Math.max(0, Math.min(1, score));
}

export function isAddressSufficient(parsedAddress, confidence) {
  const hasCity = !!parsedAddress.city;
  const hasDetails = !!(parsedAddress.houseNumber || parsedAddress.street || parsedAddress.area);
  return hasCity && hasDetails;
}

export function parseAddress(rawAddress) {
  if (!rawAddress || typeof rawAddress !== "string" || rawAddress.trim() === "") {
    return {
      rawAddress: rawAddress || "",
      cleanedAddress: "",
      normalizedAddress: "",
      houseNumber: null,
      street: null,
      area: null,
      city: null,
      postalCode: null,
      confidence: 0,
      isSufficient: false,
      needsUserConfirmation: false,
      error: "ADDRESS_EMPTY"
    };
  }

  const cleaned = cleanAddressText(rawAddress);
  const parsed = parseSriLankanAddress(cleaned);
  normalizeColomboPostal(parsed);
  const normalized = buildNormalizedAddress(parsed);
  const confidence = calculateAddressConfidence(parsed, rawAddress);
  const isSufficient = isAddressSufficient(parsed, confidence);

  let error = null;
  if (!parsed.city) {
    error = "CITY_NOT_FOUND";
  } else if (!isSufficient) {
    error = "ADDRESS_TOO_VAGUE";
  }

  return {
    rawAddress,
    cleanedAddress: cleaned,
    normalizedAddress: normalized,
    houseNumber: parsed.houseNumber,
    street: parsed.street,
    area: parsed.area,
    city: parsed.city === "Colombo" && parsed.postalCode ? `Colombo ${parsed.postalCode}` : parsed.city,
    postalCode: parsed.postalCode,
    confidence,
    isSufficient,
    needsUserConfirmation: isSufficient,
    error
  };
}
