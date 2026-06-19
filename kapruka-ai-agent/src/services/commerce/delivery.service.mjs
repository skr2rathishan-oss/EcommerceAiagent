import { getMcpClient } from "../integration/mcp.client.mjs";

export const checkDelivery = async (city, deliveryDate, productId) => {
  const client = await getMcpClient();

  const result = await client.callTool({
    name: "kapruka_check_delivery",
    arguments: {
      params: {
        city: city,
        delivery_date: deliveryDate || null,
        product_id: productId || null,
        response_format: "json"
      }
    }
  });

  const data = JSON.parse(result.structuredContent.result);

  const deliveryResult = {
    available: data.available,
    city: data.city,
    deliveryDate: data.checked_date,
    deliveryCharge: data.rate || 0,
    warning: data.perishable_warning || data.reason || null
  };

  return deliveryResult;
};

export const listDeliveryCities = async (query, limit = 25) => {
  const client = await getMcpClient();
  const result = await client.callTool({
    name: "kapruka_list_delivery_cities",
    arguments: {
      params: {
        query: query || null,
        limit: limit,
        response_format: "json"
      }
    }
  });

  const raw =
    result?.structuredContent?.result ??
    result?.content?.[0]?.text ??
    "";

  try {
    const data = JSON.parse(raw);
    return data.cities || [];
  } catch (err) {
    console.error("Failed to parse listDeliveryCities response:", err.message);
    return [];
  }
};

export const findNearbyCities = async (city) => {
  const cleanCity = city.toLowerCase().trim();
  const proximityMap = {
    "mullaitivu": ["Jaffna", "Kilinochchi", "Vavuniya"],
    "mullaittivu": ["Jaffna", "Kilinochchi", "Vavuniya"],
    "jaffna": ["Kilinochchi", "Vavuniya", "Mannar"],
    "kilinochchi": ["Jaffna", "Vavuniya", "Mullaitivu"],
    "vavuniya": ["Anuradhapura", "Kilinochchi", "Trincomalee"],
    "mannar": ["Vavuniya", "Kilinochchi", "Anuradhapura"],
    "colombo": ["Dehiwala", "Mount Lavinia", "Nugegoda"],
    "kandy": ["Matale", "Peradeniya", "Gampola"],
    "galle": ["Matara", "Hikkaduwa", "Ambalangoda"],
    "matara": ["Galle", "Weligama", "Hambantota"]
  };

  let candidates = proximityMap[cleanCity];
  if (!candidates) {
    const key = Object.keys(proximityMap).find(k => cleanCity.includes(k) || k.includes(cleanCity));
    candidates = key ? proximityMap[key] : ["Jaffna", "Kilinochchi", "Vavuniya"];
  }

  // Call kapruka_list_delivery_cities for each candidate to get canonical names
  const verifiedCities = [];
  for (const candidate of candidates) {
    try {
      const matched = await listDeliveryCities(candidate, 1);
      if (matched && matched.length > 0) {
        verifiedCities.push(matched[0].name);
      } else {
        verifiedCities.push(candidate);
      }
    } catch {
      verifiedCities.push(candidate);
    }
  }

  return verifiedCities;
};
