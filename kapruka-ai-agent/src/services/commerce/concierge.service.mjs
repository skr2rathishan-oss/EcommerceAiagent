import UserProfile from "../../database/UserProfile.mjs";
import { suggestAlternativeLocations } from "../integration/googleMapsService.mjs";
import { checkDelivery } from "./delivery.service.mjs";
import logger from "../../utils/logger.mjs";

export const getAddresses = async (sessionId) => {
  try {
    const profile = await UserProfile.findOne({ sessionId }).lean();
    return profile?.addresses || [];
  } catch (err) {
    logger.error(`[CONCIERGE] getAddresses failed: ${err.message}`);
    throw err;
  }
};

export const getDefaultAddress = async (sessionId) => {
  try {
    const addresses = await getAddresses(sessionId);
    return addresses.find(a => a.isDefault) || (addresses.length > 0 ? addresses[0] : null);
  } catch (err) {
    logger.error(`[CONCIERGE] getDefaultAddress failed: ${err.message}`);
    throw err;
  }
};

export const saveAddress = async (sessionId, addressData) => {
  try {
    let profile = await UserProfile.findOne({ sessionId });
    if (!profile) {
      profile = new UserProfile({ sessionId, addresses: [] });
    }

    if (!profile.addresses) {
      profile.addresses = [];
    }

    // If new address is marked as default, unset others
    if (addressData.isDefault) {
      profile.addresses.forEach(a => { a.isDefault = false; });
    }

    // If it's the first address, make it default
    if (profile.addresses.length === 0) {
      addressData.isDefault = true;
    }

    profile.addresses.push(addressData);
    await profile.save();

    logger.info(`[CONCIERGE] Saved new address for session ${sessionId}. Label: ${addressData.label}`);
    return profile.addresses;
  } catch (err) {
    logger.error(`[CONCIERGE] saveAddress failed: ${err.message}`);
    throw err;
  }
};

export const validateDeliveryForAddress = async (city, deliveryDate, productId) => {
  try {
    const result = await checkDelivery(city, deliveryDate, productId);
    return result;
  } catch (err) {
    logger.error(`[CONCIERGE] validateDeliveryForAddress failed: ${err.message}`);
    throw err;
  }
};

export const findNearestDeliverableArea = async (city) => {
  try {
    logger.info(`[CONCIERGE] Finding nearest deliverable areas for: ${city}`);
    const alternatives = await suggestAlternativeLocations(city);
    // returns array of string cities (max 4)
    if (alternatives && alternatives.length > 0) {
      return {
        areaName: alternatives[0],
        alternatives: alternatives,
        distance: "nearby" // generic distance as per user requirement
      };
    }
    return null;
  } catch (err) {
    logger.error(`[CONCIERGE] findNearestDeliverableArea failed: ${err.message}`);
    throw err;
  }
};
