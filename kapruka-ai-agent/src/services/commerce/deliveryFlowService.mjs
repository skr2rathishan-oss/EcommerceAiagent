import { getDeliverySession, updateDeliverySession } from "../../memory/memoryStore.mjs";
import { parseAddress } from "./addressService.mjs";
import { checkDelivery } from "./delivery.service.mjs";
import { createOrder } from "./order.service.mjs";
import { normalizeDeliveryDate } from "../../utils/date.utils.mjs";
import {
  getDeliveryAddressPrompt,
  getDeliveryAddressVagueMessage,
  getDeliveryAddressConfirmationMessage,
  getDeliveryDatePrompt,
  getDeliveryDateCancelMessage,
  getDeliverySuccessMessage,
  getDeliverySelectedCityPrefix,
  getDeliverySimilarProductsPrefix,
  getDeliveryCancelRecoveryMessage,
  getDeliveryCancelA_Prefix,
  getDeliveryCancelB_Prefix,
  handleDeliveryFailure
} from "./deliveryRecoveryService.mjs";
import logger from "../../utils/logger.mjs";

export async function startDeliveryFlow(sessionId, product, lang = "en") {
  logger.info(`[DeliveryFlow] Starting flow for session ${sessionId}, product: ${product?.name}`);
  const selectedProduct = product ? {
    product_id: product.id || product.productId,
    product_name: product.name || product.productName,
    price: product.price,
    category: product.category || ""
  } : null;

  const session = await getDeliverySession(sessionId);
  
  await updateDeliverySession(sessionId, {
    state: "WAITING_FOR_ADDRESS",
    selected_product: selectedProduct,
    raw_address: null,
    cleaned_address: null,
    normalized_address: null,
    address_confidence: null,
    house_number: null,
    street: null,
    area: null,
    city: null,
    postal_code: null,
    delivery_date: null,
    delivery_available: null,
    delivery_fee: null,
    alternative_dates: [],
    nearest_cities: [],
    alternative_products: [],
    order_id: null,
    payment_link: null
  }, session.session_version);

  const prompt = getDeliveryAddressPrompt(lang);
  return {
    type: "text",
    text: prompt
  };
}

export async function handleAddressInput(session, addressText, lang = "en") {
  const parsed = parseAddress(addressText);
  
  if (!parsed.isSufficient) {
    const vagueMsg = getDeliveryAddressVagueMessage(lang);
    return {
      type: "text",
      text: vagueMsg
    };
  }

  const updates = {
    state: "WAITING_FOR_ADDRESS_CONFIRMATION",
    raw_address: addressText,
    cleaned_address: parsed.cleanedAddress,
    normalized_address: parsed.normalizedAddress,
    address_confidence: parsed.confidence,
    house_number: parsed.houseNumber,
    street: parsed.street,
    area: parsed.area,
    city: parsed.city,
    postal_code: parsed.postalCode
  };

  const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
  if (!updated) return null; // OCC Stale call ignored

  const confirmMsg = getDeliveryAddressConfirmationMessage(parsed.normalizedAddress, lang);
  return {
    type: "text",
    text: confirmMsg
  };
}

export async function handleAddressConfirmation(session, choice, lang = "en") {
  const lowerMsg = choice.toLowerCase().trim();
  const isYes = lowerMsg === "a" || lowerMsg === "yes" || lowerMsg.includes("use this") || lowerMsg.includes("ow") || lowerMsg.includes("hari");
  const isNo = lowerMsg === "b" || lowerMsg === "no" || lowerMsg.includes("edit") || lowerMsg.includes("na") || lowerMsg.includes("epa");

  if (isYes) {
    const updates = {
      state: "WAITING_FOR_DATE"
    };
    const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
    if (!updated) return null;

    const datePrompt = getDeliveryDatePrompt(lang);
    return {
      type: "text",
      text: datePrompt
    };
  } else if (isNo) {
    const updates = {
      state: "WAITING_FOR_ADDRESS",
      raw_address: null,
      cleaned_address: null,
      normalized_address: null,
      address_confidence: null,
      house_number: null,
      street: null,
      area: null,
      city: null,
      postal_code: null
    };
    const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
    if (!updated) return null;

    const addressPrompt = getDeliveryAddressPrompt(lang);
    return {
      type: "text",
      text: addressPrompt
    };
  } else {
    // Re-prompt confirmation
    const confirmMsg = getDeliveryAddressConfirmationMessage(session.normalized_address || "your address", lang);
    return {
      type: "text",
      text: confirmMsg
    };
  }
}

export async function handleDateInput(session, dateText, lang = "en") {
  const lowerMsg = dateText.toLowerCase().trim();
  if (lowerMsg === "cancel" || lowerMsg === "stop" || lowerMsg === "nevermind") {
    const updates = {
      state: "CANCELLED",
      selected_product: null,
      raw_address: null,
      cleaned_address: null,
      normalized_address: null,
      city: null
    };
    const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
    if (!updated) return null;

    const cancelMsg = getDeliveryDateCancelMessage(lang);
    return {
      type: "text",
      text: cancelMsg
    };
  }

  const normalizedDate = normalizeDeliveryDate(dateText);
  const checkStateUpdates = {
    state: "CHECKING_DELIVERY",
    delivery_date: normalizedDate
  };

  let updated = await updateDeliverySession(session.sessionId, checkStateUpdates, session.session_version);
  if (!updated) return null;

  // Perform Kapruka Delivery Check
  const city = session.city || "Colombo";
  const productId = session.selected_product?.product_id;
  const result = await checkDelivery(city, normalizedDate, productId);

  // Load fresh session to verify version has not mutated during async checkDelivery
  const freshSession = await getDeliverySession(session.sessionId);
  if (freshSession.session_version !== updated.session_version) {
    logger.warn(`[DeliveryFlow] Stale checkDelivery async response ignored for session ${session.sessionId}`);
    return null;
  }

  if (result.available) {
    const availableUpdates = {
      state: "WAITING_FOR_CONFIRMATION",
      delivery_available: true,
      delivery_fee: result.deliveryCharge || 0
    };
    updated = await updateDeliverySession(session.sessionId, availableUpdates, freshSession.session_version);
    if (!updated) return null;

    // Perishable warning check
    const category = (session.selected_product?.category || "").toLowerCase();
    const isPerishable = ["cake", "flowers", "combo", "cakes", "flower"].some(c => category.includes(c));
    let successMsg = getDeliverySuccessMessage(city, normalizedDate, result.deliveryCharge || 0, lang);
    if (isPerishable) {
      const warning = lang === "si" 
        ? "\n\n⚠️ meka ikmanin narakwana ekayak. Karunakarala delivery dawasata location eke kenek inna bawak thahawuru karanna." 
        : lang === "ta"
          ? "\n\n⚠️ இது கெட்டுப்போகக்கூடிய பொருள். டெலிவரி திகதியில் அதை பெற்றுக்கொள்ள யாராவது இருப்பதை உறுதிப்படுத்தவும்."
          : "\n\n⚠️ This is a perishable item. Please make sure someone is available to receive it on the delivery date.";
      successMsg += warning;
    }

    // Return structured checkout confirmation card payload
    return {
      type: "delivery_result",
      text: successMsg,
      available: true,
      city,
      deliveryDate: normalizedDate,
      productId,
      orderSummary: {
        product: {
          id: session.selected_product?.product_id,
          name: session.selected_product?.product_name,
          price: session.selected_product?.price,
          currency: "LKR",
          category: session.selected_product?.category
        },
        deliveryInfo: {
          fullName: "Guest User",
          phone: "0771234567",
          email: "guest@example.com",
          address: session.normalized_address || city
        },
        sellerInfo: {
          name: "Velora Partner",
          rating: 4.8
        },
        status: "pending"
      }
    };
  } else {
    const failureResult = await handleDeliveryFailure(city, normalizedDate, productId, lang);
    const unavailableUpdates = {
      state: "WAITING_FOR_RECOVERY_CHOICE",
      delivery_available: false,
      nearest_cities: failureResult.nearestCities
    };
    updated = await updateDeliverySession(session.sessionId, unavailableUpdates, freshSession.session_version);
    if (!updated) return null;

    return {
      type: "delivery_result",
      text: failureResult.text,
      available: false,
      city,
      deliveryDate: normalizedDate,
      productId,
      alternativeCities: failureResult.nearestCities
    };
  }
}

export async function handleRecoveryChoice(session, choice, lang = "en") {
  const lowerMsg = choice.toLowerCase().trim();
  const isA = lowerMsg === "a" || lowerMsg === "1" || (session.nearest_cities && lowerMsg.includes(session.nearest_cities[0]?.toLowerCase()));
  const isB = lowerMsg === "b" || lowerMsg === "2" || (session.nearest_cities && lowerMsg.includes(session.nearest_cities[1]?.toLowerCase()));
  const isC = lowerMsg === "c" || lowerMsg === "3" || (session.nearest_cities && lowerMsg.includes(session.nearest_cities[2]?.toLowerCase()));
  const isD = lowerMsg === "d" || lowerMsg === "4" || lowerMsg.includes("similar") || lowerMsg.includes("wena") || lowerMsg.includes("d");
  const isE = lowerMsg === "e" || lowerMsg === "5" || lowerMsg.includes("cancel") || lowerMsg.includes("stop") || lowerMsg.includes("e");

  const date = session.delivery_date;
  const productId = session.selected_product?.product_id;

  if (isA || isB || isC) {
    const cityIndex = isA ? 0 : isB ? 1 : 2;
    const selectedCity = session.nearest_cities?.[cityIndex] || "Colombo";

    const prefix = getDeliverySelectedCityPrefix(selectedCity, lang);
    
    // Transition to checking delivery
    let updates = {
      state: "CHECKING_DELIVERY",
      city: selectedCity
    };
    let updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
    if (!updated) return null;

    const result = await checkDelivery(selectedCity, date, productId);

    const freshSession = await getDeliverySession(session.sessionId);
    if (freshSession.session_version !== updated.session_version) return null;

    if (result.available) {
      const availableUpdates = {
        state: "WAITING_FOR_CONFIRMATION",
        delivery_available: true,
        delivery_fee: result.deliveryCharge || 0
      };
      updated = await updateDeliverySession(session.sessionId, availableUpdates, freshSession.session_version);
      if (!updated) return null;

      let successMsg = prefix + "\n\n" + getDeliverySuccessMessage(selectedCity, date, result.deliveryCharge || 0, lang);
      return {
        type: "delivery_result",
        text: successMsg,
        available: true,
        city: selectedCity,
        deliveryDate: date,
        productId,
        orderSummary: {
          product: {
            id: session.selected_product?.product_id,
            name: session.selected_product?.product_name,
            price: session.selected_product?.price,
            currency: "LKR",
            category: session.selected_product?.category
          },
          deliveryInfo: {
            fullName: "Guest User",
            phone: "0771234567",
            email: "guest@example.com",
            address: selectedCity
          },
          sellerInfo: {
            name: "Velora Partner",
            rating: 4.8
          },
          status: "pending"
        }
      };
    } else {
      const failureResult = await handleDeliveryFailure(selectedCity, date, productId, lang);
      const unavailableUpdates = {
        state: "WAITING_FOR_RECOVERY_CHOICE",
        delivery_available: false,
        nearest_cities: failureResult.nearestCities
      };
      updated = await updateDeliverySession(session.sessionId, unavailableUpdates, freshSession.session_version);
      if (!updated) return null;

      return {
        type: "delivery_result",
        text: prefix + "\n\n" + failureResult.text,
        available: false,
        city: selectedCity,
        deliveryDate: date,
        productId,
        alternativeCities: failureResult.nearestCities
      };
    }
  }

  if (isD) {
    const prefix = getDeliverySimilarProductsPrefix(session.city, date, lang);
    await updateDeliverySession(session.sessionId, { state: "IDLE" }, session.session_version);
    return {
      type: "similar_products",
      text: prefix
    };
  }

  if (isE) {
    await updateDeliverySession(session.sessionId, { state: "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION" }, session.session_version);
    const cancelRecoveryMsg = getDeliveryCancelRecoveryMessage(lang);
    return {
      type: "text",
      text: cancelRecoveryMsg
    };
  }

  const failureText = await handleDeliveryFailure(session.city, date, productId, lang);
  return {
    type: "text",
    text: failureText.text
  };
}

export async function handleCancelOptions(session, choice, lang = "en") {
  const lowerMsg = choice.toLowerCase().trim();
  const isA = lowerMsg === "a" || lowerMsg === "1" || lowerMsg.includes("similar") || lowerMsg.includes("kalin");
  const isB = lowerMsg === "b" || lowerMsg === "2" || lowerMsg.includes("fresh") || lowerMsg.includes("aluthin");

  if (isA) {
    await updateDeliverySession(session.sessionId, { state: "IDLE" }, session.session_version);
    const prefix = getDeliveryCancelA_Prefix(lang);
    return {
      type: "similar_products",
      text: prefix
    };
  }

  if (isB) {
    await updateDeliverySession(session.sessionId, { state: "IDLE" }, session.session_version);
    const prefix = getDeliveryCancelB_Prefix(lang);
    return {
      type: "text",
      text: prefix
    };
  }

  const cancelRecoveryMsg = getDeliveryCancelRecoveryMessage(lang);
  return {
    type: "text",
    text: cancelRecoveryMsg
  };
}

export async function handleCheckoutConfirmation(session, choice, lang = "en") {
  const lowerMsg = choice.toLowerCase().trim();
  const isYes = lowerMsg === "a" || lowerMsg === "yes" || lowerMsg.includes("place order") || lowerMsg.includes("place the order") || lowerMsg.includes("ow") || lowerMsg.includes("hari");
  const isNo = lowerMsg === "b" || lowerMsg === "cancel" || lowerMsg.includes("stop") || lowerMsg.includes("epa");

  if (isYes) {
    return await confirmAndCreateOrder(session, lang);
  } else if (isNo) {
    const updates = {
      state: "CANCELLED",
      selected_product: null,
      raw_address: null,
      cleaned_address: null,
      normalized_address: null,
      city: null
    };
    await updateDeliverySession(session.sessionId, updates, session.session_version);
    const cancelMsg = lang === "si" 
      ? "Awulak ne, mama order eka cancel kara. 🤝"
      : lang === "ta"
        ? "பிரச்சினை இல்லை, நான் ஆர்டரை ரத்து செய்துள்ளேன். 🤝"
        : "No problem, I've cancelled the order creation. 🤝";
    return {
      type: "text",
      text: cancelMsg
    };
  } else {
    // Re-prompt checkout confirmation
    const category = (session.selected_product?.category || "").toLowerCase();
    const isPerishable = ["cake", "flowers", "combo", "cakes", "flower"].some(c => category.includes(c));
    let successMsg = getDeliverySuccessMessage(session.city, session.delivery_date, session.delivery_fee || 0, lang);
    if (isPerishable) {
      const warning = lang === "si" 
        ? "\n\n⚠️ meka ikmanin narakwana ekayak. Karunakarala delivery dawasata location eke kenek inna bawak thahawuru karanna." 
        : lang === "ta"
          ? "\n\n⚠️ இது கெட்டுப்போகக்கூடிய பொருள். டெலிவரி திகதியில் அதை பெற்றுக்கொள்ள யாராவது இருப்பதை உறுதிப்படுத்தவும்."
          : "\n\n⚠️ This is a perishable item. Please make sure someone is available to receive it on the delivery date.";
      successMsg += warning;
    }
    return {
      type: "delivery_result",
      text: successMsg,
      available: true,
      city: session.city,
      deliveryDate: session.delivery_date,
      productId: session.selected_product?.product_id,
      orderSummary: {
        product: {
          id: session.selected_product?.product_id,
          name: session.selected_product?.product_name,
          price: session.selected_product?.price,
          currency: "LKR",
          category: session.selected_product?.category
        },
        deliveryInfo: {
          fullName: "Guest User",
          phone: "0771234567",
          email: "guest@example.com",
          address: session.normalized_address || session.city
        },
        sellerInfo: {
          name: "Velora Partner",
          rating: 4.8
        },
        status: "pending"
      }
    };
  }
}

export async function confirmAndCreateOrder(session, lang = "en") {
  const updates = {
    state: "CREATING_ORDER"
  };
  let updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
  if (!updated) return null;

  try {
    const cart = [{
      productId: session.selected_product.product_id,
      name: session.selected_product.product_name,
      price: session.selected_product.price || 0,
      quantity: 1
    }];

    const recipient = {
      name: "Guest User",
      phone: "0771234567",
      email: "guest@example.com"
    };

    const delivery = {
      address: session.normalized_address || session.city,
      city: session.city,
      date: session.delivery_date
    };

    const sender = {
      name: "Guest User",
      anonymous: false
    };

    logger.info(`[DeliveryFlow] Calling createOrder for sessionId ${session.sessionId}`);
    const orderDoc = await createOrder(session.sessionId, { cart, recipient, delivery, sender });

    // Load fresh session and verify concurrency version has not mutated
    const freshSession = await getDeliverySession(session.sessionId);
    if (freshSession.session_version !== updated.session_version) {
      logger.warn(`[DeliveryFlow] Stale createOrder async response ignored for session ${session.sessionId}`);
      return null;
    }

    const orderSuccessUpdates = {
      state: "PAYMENT_PENDING",
      order_id: orderDoc.orderRef,
      payment_link: orderDoc.checkoutUrl
    };
    updated = await updateDeliverySession(session.sessionId, orderSuccessUpdates, freshSession.session_version);
    if (!updated) return null;

    let successText = "";
    if (lang === "si") {
      successText = `Niyamai! 🎉 Oyage order eka ready!
      
**Order ID:** ${orderDoc.orderRef}
**Delivery To:** ${session.normalized_address}
**Delivery Date:** ${session.delivery_date}

Meka thama oyage payment link eka:
${orderDoc.checkoutUrl}`;
    } else if (lang === "ta") {
      successText = `அருமை! 🎉 உங்கள் ஆர்டர் தயாராக உள்ளது!
      
**ஆர்டர் ஐடி:** ${orderDoc.orderRef}
**முகவரி:** ${session.normalized_address}
**திகதி:** ${session.delivery_date}

இதோ உங்கள் கட்டண இணைப்பு:
${orderDoc.checkoutUrl}`;
    } else {
      successText = `🎉 Your order is ready!
      
**Order ID:** ${orderDoc.orderRef}
**Delivery To:** ${session.normalized_address}
**Delivery Date:** ${session.delivery_date}

Here’s your payment link:
${orderDoc.checkoutUrl}`;
    }

    return {
      type: "order_confirmation",
      text: successText,
      order: {
        orderNumber: orderDoc.orderRef,
        status: "unpaid",
        items: [{
          name: session.selected_product.product_name,
          price: session.selected_product.price || 0,
          quantity: 1,
          image: ""
        }],
        total: orderDoc.summary?.total || (session.selected_product.price + (session.delivery_fee || 0)),
        paymentUrl: orderDoc.checkoutUrl
      }
    };

  } catch (error) {
    logger.error(`[DeliveryFlow] createOrder error: ${error.message}`);
    // Do not lose session on failure, keep state WAITING_FOR_CONFIRMATION or WAITING_FOR_RETRY
    const freshSession = await getDeliverySession(session.sessionId);
    await updateDeliverySession(session.sessionId, { state: "WAITING_FOR_CONFIRMATION" }, freshSession.session_version);
    
    let errText = "";
    if (lang === "si") {
      errText = `Sorry 😔 mata me welawe order eka hadanna bari una. Oyage details thama save wela thiyenawa. Ayeth try karanna onida?`;
    } else if (lang === "ta") {
      errText = `மன்னிக்கவும் 😔 இப்போது ஆர்டரை உருவாக்க முடியவில்லை. உங்கள் விபரங்கள் சேமிக்கப்பட்டுள்ளன. மீண்டும் முயற்சிக்க விரும்புகிறீர்களா?`;
    } else {
      errText = `Sorry 😔 I couldn’t create the order right now. Your delivery details are still saved. Would you like me to try again?`;
    }
    return {
      type: "text",
      text: errText
    };
  }
}
