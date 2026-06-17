import logger from "../utils/logger.mjs";
import { listDeliveryCities } from "./delivery.service.mjs";

const getApiKey = () => {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLEMAP_API;
};

// Haversine formula to compute distance in km between two lat/lng coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const validateApiKey = async () => {
  const key = getApiKey();
  if (!key) {
    throw new Error("Google Maps API Key is missing");
  }

  // Ping Geocoding API with a test address to verify key validity
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=Colombo&key=${key}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status === "REQUEST_DENIED") {
    throw new Error(`Google Maps API Key validation failed: ${data.error_message || "Denied"}`);
  }
  return true;
};

export const getCoordinates = async (address) => {
  const key = getApiKey();
  if (!key) {
    throw new Error("Google Maps API Key is not configured");
  }

  logger.info(`[GOOGLE MAPS] Geocoding location: ${address}`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.results || data.results.length === 0) {
    logger.warn(`[GOOGLE MAPS] Geocoding failed for: ${address}. Status: ${data.status}`);
    throw new Error(`Geocoding failed for address: ${address}`);
  }

  const result = data.results[0];
  const { lat, lng } = result.geometry.location;
  logger.info(`[GOOGLE MAPS] Geocoding Success. Location: ${address} -> Lat: ${lat}, Lng: ${lng}`);

  return {
    lat,
    lng,
    formattedAddress: result.formatted_address,
  };
};

export const findNearbyLocations = async (lat, lng, radiusKm = 50) => {
  const key = getApiKey();
  if (!key) {
    throw new Error("Google Maps API Key is not configured");
  }

  // Search for cities, towns, and localities within the radius
  const radiusMeters = radiusKm * 1000;
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&types=locality|colloquial_area|sublocality|administrative_area_level_3&key=${key}`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    logger.error(`[GOOGLE MAPS] Places Nearby Search failed. Status: ${data.status}`);
    throw new Error(`Places API search failed: ${data.status}`);
  }

  const results = data.results || [];
  logger.info(`[GOOGLE MAPS] Nearby Locations Found. Count: ${results.length}`);

  const locations = results.map((place) => {
    const plat = place.geometry.location.lat;
    const plng = place.geometry.location.lng;
    const dist = calculateDistance(lat, lng, plat, plng) || 0;
    return {
      name: place.name,
      placeId: place.place_id,
      lat: plat,
      lng: plng,
      distance: parseFloat(dist.toFixed(2)),
    };
  });

  // Sort by distance ascending
  locations.sort((a, b) => a.distance - b.distance);
  return locations;
};

export const findNearbyCities = async (city) => {
  const coords = await getCoordinates(city);
  const nearby = await findNearbyLocations(coords.lat, coords.lng, 50);
  return {
    ...coords,
    nearby,
  };
};

export const suggestAlternativeLocations = async (city) => {
  try {
    const { lat, lng, nearby } = await findNearbyCities(city);
    
    // Extract unique names from Google Places
    const uniqueNames = Array.from(new Set(nearby.map((l) => l.name))).slice(0, 15);
    
    const verifiedCities = [];
    
    // Check which of these are deliverable in Kapruka
    for (const name of uniqueNames) {
      try {
        const matches = await listDeliveryCities(name, 3);
        if (matches && matches.length > 0) {
          // Add the matching deliverable cities
          for (const match of matches) {
            if (!verifiedCities.includes(match.name)) {
              verifiedCities.push(match.name);
            }
          }
        }
      } catch (err) {
        logger.warn(`[GOOGLE MAPS] Kapruka deliverable city check failed for: ${name}`);
      }
      
      // Stop once we have 4 good verified locations
      if (verifiedCities.length >= 4) {
        break;
      }
    }

    // If no geolocated cities verified, fall back to regional defaults
    if (verifiedCities.length === 0) {
      const fallbacks = {
        mullaitivu: ["Jaffna", "Kilinochchi", "Vavuniya"],
        jaffna: ["Kilinochchi", "Vavuniya", "Mannar"],
        colombo: ["Dehiwala", "Mount Lavinia", "Nugegoda"],
      };
      const cleanCity = city.toLowerCase().trim();
      const fallbackList = fallbacks[cleanCity] || ["Colombo 03", "Kandy", "Galle"];
      for (const f of fallbackList) {
        const matches = await listDeliveryCities(f, 1);
        if (matches && matches.length > 0) {
          verifiedCities.push(matches[0].name);
        } else {
          verifiedCities.push(f);
        }
      }
    }

    return verifiedCities.slice(0, 4);
  } catch (err) {
    logger.error(`[GOOGLE MAPS] suggestAlternativeLocations failed: ${err.message}`);
    // Safe hardcoded regional fallback
    return ["Jaffna", "Kilinochchi", "Vavuniya"];
  }
};
