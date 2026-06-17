import { getCoordinates, findNearbyLocations } from "../integration/googleMapsService.mjs";
import logger from "../../utils/logger.mjs";

export const checkGeocodingHealth = async () => {
  try {
    const coords = await getCoordinates("Colombo");
    if (coords && coords.lat && coords.lng) {
      logger.info("[GOOGLE MAPS] Geocoding Health Check: Success");
      return "Available";
    }
    return "Unavailable";
  } catch (err) {
    logger.error(`[GOOGLE MAPS] Geocoding Health Check failed: ${err.message}`);
    return "Unavailable";
  }
};

export const checkPlacesHealth = async () => {
  try {
    const locations = await findNearbyLocations(6.9271, 79.8612, 10);
    if (locations && Array.isArray(locations)) {
      logger.info("[GOOGLE MAPS] Places Health Check: Success");
      return "Available";
    }
    return "Unavailable";
  } catch (err) {
    logger.error(`[GOOGLE MAPS] Places Health Check failed: ${err.message}`);
    return "Unavailable";
  }
};
