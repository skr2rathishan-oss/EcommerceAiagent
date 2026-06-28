import { findNearbyCities } from "./delivery.service.mjs";

export const getDeliveryAddressPrompt = (lang) => {
  return { status: "ask_delivery_address", context: {} };
};

export const getDeliveryAddressVagueMessage = (lang) => {
  return { status: "address_incomplete", context: {} };
};

export const getDeliveryAddressConfirmationMessage = (address, lang) => {
  return { status: "confirm_parsed_address", context: { formatted_address: address } };
};

export const getDeliveryDatePrompt = (lang) => {
  return { status: "ask_delivery_date", context: {} };
};

export const getDeliveryDateCancelMessage = (lang) => {
  return { status: "delivery_date_cancelled", context: {} };
};

export const getDeliverySuccessMessage = (city, date, charge, lang) => {
  return { status: "delivery_available", context: { city, date, charge } };
};

export const getDeliverySelectedCityPrefix = (selectedCity, lang) => {
  return { status: "delivery_selected_city_prefix", context: { selectedCity } };
};

export const getDeliverySimilarProductsPrefix = (city, date, lang) => {
  return { status: "delivery_similar_products_prefix", context: { city, date } };
};

export const getDeliveryCancelRecoveryMessage = (lang) => {
  return { status: "delivery_cancel_recovery", context: {} };
};

export const getDeliveryCancelA_Prefix = (lang) => {
  return { status: "delivery_cancel_a_prefix", context: {} };
};

export const getDeliveryCancelB_Prefix = (lang) => {
  return { status: "delivery_cancel_b_prefix", context: {} };
};

export const handleDeliveryFailure = async (city, date, productId, lang = "en") => {
  const altCities = await findNearbyCities(city);
  
  const nearest_city_1 = altCities[0] || "Colombo";
  const nearest_city_2 = altCities[1] || "Kandy";
  const nearest_city_3 = altCities[2] || "Jaffna";

  return {
    available: false,
    city,
    deliveryDate: date,
    productId,
    nearestCities: [nearest_city_1, nearest_city_2, nearest_city_3],
    status: "delivery_failure_options",
    context: {
      city,
      date,
      nearest_city_1,
      nearest_city_2,
      nearest_city_3
    }
  };
};
