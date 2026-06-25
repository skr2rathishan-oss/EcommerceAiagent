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
      state: "WAITING_FOR_CONTACT_NAME",
      delivery_available: true,
      delivery_fee: result.deliveryCharge || 0
    };
    updated = await updateDeliverySession(session.sessionId, availableUpdates, freshSession.session_version);
    if (!updated) return null;

    // Perishable warning check
    const category = (session.selected_product?.category || "").toLowerCase();
    const isPerishable = ["cake", "flowers", "combo", "cakes", "flower"].some(c => category.includes(c));
    
    let successMsg = "";
    if (lang === "si") {
      successMsg = "Niyamai! 🎉 me item eka deliver karanna puluwan.\n\nDan mata **contact name eka** (nama) danna order eka complete karanna. 😊\nDelivery ekata contact karanna ona nama danna please.";
    } else if (lang === "ta") {
      successMsg = "Super! 🎉 indha item-ku delivery panna mudiyum.\n\nIppo order complete panna **contact name** venum. 😊\nDelivery-ku contact panna vendiya name anuppunga.";
    } else {
      successMsg = "Good news! 🎉 Delivery is available for this item.\n\nNow I just need the **contact name** for the order. 😊\nPlease send the name of the person we should contact for delivery.";
    }

    if (isPerishable) {
      const warning = lang === "si" 
        ? "\n\n⚠️ meka ikmanin narakwana ekayak. Karunakarala delivery dawasata location eke kenek inna bawak thahawuru karanna." 
        : lang === "ta"
          ? "\n\n⚠️ இது கெட்டுப்போகக்கூடிய பொருள். டெலிவரி திகதியில் அதை பெற்றுக்கொள்ள யாராவது இருப்பதை உறுதிப்படுத்தவும்."
          : "\n\n⚠️ This is a perishable item. Please make sure someone is available to receive it on the delivery date.";
      successMsg += warning;
    }

    return {
      type: "text",
      text: successMsg
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
        state: "WAITING_FOR_CONTACT_NAME",
        delivery_available: true,
        delivery_fee: result.deliveryCharge || 0
      };
      updated = await updateDeliverySession(session.sessionId, availableUpdates, freshSession.session_version);
      if (!updated) return null;

      let successMsg = prefix + "\n\n";
      if (lang === "si") {
        successMsg += "Niyamai! 🎉 me item eka deliver karanna puluwan.\n\nDan mata **contact name eka** (nama) danna order eka complete karanna. 😊\nDelivery ekata contact karanna ona nama danna please.";
      } else if (lang === "ta") {
        successMsg += "Super! 🎉 indha item-ku delivery panna mudiyum.\n\nIppo order complete panna **contact name** venum. 😊\nDelivery-ku contact panna vendiya name anuppunga.";
      } else {
        successMsg += "Good news! 🎉 Delivery is available for this item.\n\nNow I just need the **contact name** for the order. 😊\nPlease send the name of the person we should contact for delivery.";
      }
      return {
        type: "text",
        text: successMsg
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
  return await handleFinalOrderConfirmation(session, choice, lang);
}

export async function handleContactNameInput(session, nameText, lang = "en") {
  const cleanedName = nameText.trim();
  const isNumeric = /^\d+$/.test(cleanedName);
  const isValid = cleanedName.length >= 2 && !isNumeric && !/^[_\-\s\.\,\#\/\@\!\$\%\^\&\*\(\)\+]+$/.test(cleanedName);

  if (!isValid) {
    let failMsg = "Aiyoo 😅 that doesn't look like a valid contact name. Please send the name of the person receiving the delivery.\nExample: **Nimal Perera**";
    if (lang === "si") {
      failMsg = "Aiyoo 😅 eka hari contact name ekak wage penne na. Karunakarala delivery labaganna kenaage nama danna.\nUdaharana: **Nimal Perera**";
    } else if (lang === "ta") {
      failMsg = "Aiyoo 😅 adhu sariyaana peyaraaga theriyavillai. Delivery perubavarin peyarai anuppunga.\nUdaaranam: **Nimal Perera**";
    }
    return {
      type: "text",
      text: failMsg
    };
  }

  const updates = {
    state: "WAITING_FOR_CONTACT_PHONE",
    contact_name: cleanedName
  };
  const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
  if (!updated) return null;

  let phonePrompt = "Perfect! 😊 Now send me the **contact phone number** for the delivery.\nExample: **0771234567**";
  if (lang === "si") {
    phonePrompt = "Niyamai! 😊 dan **contact phone number eka** danna.\nExample: **0771234567**";
  } else if (lang === "ta") {
    phonePrompt = "Perfect! 😊 ippo **contact phone number** anuppunga.\nExample: **0771234567**";
  }

  return {
    type: "text",
    text: phonePrompt
  };
}

export function normalizeSriLankanPhoneNumber(rawPhone) {
  let clean = rawPhone.replace(/[\s\-\(\)\+]/g, "").trim();
  if (clean.startsWith("947")) {
    clean = "0" + clean.slice(2);
  }
  const isValid = /^0(70|71|72|74|75|76|77|78)\d{7}$/.test(clean);
  return {
    isValid,
    normalized: isValid ? clean : null
  };
}

export async function handleContactPhoneInput(session, phoneText, lang = "en") {
  const { isValid, normalized } = normalizeSriLankanPhoneNumber(phoneText);

  if (!isValid) {
    let failMsg = "Aiyoo 😅 that phone number doesn't look right. Please send a valid Sri Lankan mobile number.\nExample: **0771234567**";
    if (lang === "si") {
      failMsg = "Aiyoo 😅 e phone number eka hari na wage. Karunakarala hari Sri Lankan mobile number ekak danna.\nExample: **0771234567**";
    } else if (lang === "ta") {
      failMsg = "Aiyoo 😅 adhu sariyaana phone number illai. Sariyaana Sri Lankan mobile number anuppunga.\nUdaaranam: **0771234567**";
    }
    return {
      type: "text",
      text: failMsg
    };
  }

  const updates = {
    state: "WAITING_FOR_FINAL_ORDER_CONFIRMATION",
    contact_phone: normalized
  };
  const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
  if (!updated) return null;

  const summaryText = buildOrderSummary(updated, lang);
  const orderSummary = buildOrderSummaryPayload(updated);

  return {
    type: "delivery_result",
    text: summaryText,
    available: true,
    city: updated.city,
    deliveryDate: updated.delivery_date,
    productId: updated.selected_product?.product_id,
    orderSummary
  };
}

/**
 * Build the full orderSummary payload compatible with the frontend InteractiveOrderSummary component.
 * The component requires: product.images[], product.currency, sellerInfo.email, sellerInfo.location.
 */
export function buildOrderSummaryPayload(session) {
  const product = {
    id: session.selected_product?.product_id || "",
    name: session.selected_product?.product_name || "Product",
    price: session.selected_product?.price || 0,
    currency: "Rs.",
    category: session.selected_product?.category || "",
    brand: "Kapruka",
    images: [
      `https://cdn.kapruka.com/products/${session.selected_product?.product_id || "default"}.jpg`
    ],
    stock: 1,
    rating: 4.5,
    reviewCount: 0,
    shortDesc: session.selected_product?.product_name || "",
    description: "",
    specs: [],
    variants: [],
    delivery: session.delivery_date || "Soon",
    isMcp: true
  };

  const deliveryInfo = {
    fullName: session.contact_name || "Guest",
    phone: session.contact_phone || "",
    email: "guest@kapruka.com",
    address: session.normalized_address || session.city || ""
  };

  const sellerInfo = {
    name: "Kapruka Partner",
    rating: 4.8,
    email: "support@kapruka.com",
    phone: "+94 11 230 9090",
    location: `${session.city || "Colombo"}, Sri Lanka`
  };

  return { product, deliveryInfo, sellerInfo, status: "pending" };
}

export function buildOrderSummary(session, lang = "en") {
  const productName = session.selected_product?.product_name || "Product";
  const address = session.normalized_address || session.city || "Address";
  const city = session.city || "Colombo";
  const date = session.delivery_date || "Tomorrow";
  const fee = session.delivery_fee || 0;
  const name = session.contact_name || "Guest";
  const phone = session.contact_phone || "0771234567";

  if (lang === "si") {
    return `🎉 Hari hari, okkoma ready 😊

Me order summary eka poddak check karala balanna 👇

**Product:** ${productName}
**Delivery Address:** ${address}
**Delivery City:** ${city}
**Delivery Date:** ${date}
**Delivery Fee:** LKR ${fee}
**Contact Name:** ${name}
**Phone Number:** ${phone}

Okkoma hari nam **Yes** hari **Y** hari reply karanna — mama order eka place karannam.
Continue karanna epa nam **No** kiyanna.`;
  } else if (lang === "ta") {
    return `🎉 Super, ellam ready 😊

Order summary oru thadava check pannunga 👇

**Product:** ${productName}
**Delivery Address:** ${address}
**Delivery City:** ${city}
**Delivery Date:** ${date}
**Delivery Fee:** LKR ${fee}
**Contact Name:** ${name}
**Phone Number:** ${phone}

Ellam correct-na **Yes** illa **Y** nu reply pannunga — naan order place pannuren.
Continue panna vendaam-na **No** nu sollunga.`;
  } else {
    return `🎉 Everything is ready 😊

Here’s your order summary — please check it once before I place the order 👇

**Product:** ${productName}
**Delivery Address:** ${address}
**Delivery City:** ${city}
**Delivery Date:** ${date}
**Delivery Fee:** LKR ${fee}
**Contact Name:** ${name}
**Phone Number:** ${phone}

If everything looks good, just reply with **Yes** or **Y** and I’ll place the order for you.
If you don’t want to continue, reply **No**.`;
  }
}

export async function handleFinalOrderConfirmation(session, choice, lang = "en") {
  const lowerMsg = choice.toLowerCase().trim();
  const isYes = lowerMsg === "yes" || lowerMsg === "y" || lowerMsg === "yes machan" || lowerMsg === "hari" || lowerMsg === "ow" || lowerMsg === "okay" || lowerMsg === "ok";
  const isNo = lowerMsg === "no" || lowerMsg === "n" || lowerMsg === "cancel" || lowerMsg === "stop" || lowerMsg === "epa" || lowerMsg === "epa machan" || lowerMsg === "na";

  if (isYes) {
    return await confirmAndCreateOrder(session, lang);
  } else if (isNo) {
    const updates = {
      state: "WAITING_FOR_CANCEL_CHOICE"
    };
    const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
    if (!updated) return null;

    let cancelPrompt = "No worries 😊 I haven’t placed the order yet.\n\nIf you want, I can help you with one of these:\n\n**A.** Change the delivery details\n**B.** Start over with another product\n\nReply with **A** or **B**.";
    if (lang === "si") {
      cancelPrompt = "Awulak ne 😊 mama thama order eka place kale ne.\n\nOyata ona nam me deken ekak karamu:\n\n**A.** Delivery details wenas karamu\n**B.** Aluthin wena product ekak balamu\n\n**A** hari **B** hari reply කරන්න.";
    } else if (lang === "ta") {
      cancelPrompt = "Parava illa 😊 naan innum order place pannala.\n\nNeenga venumna idhula onnu pannalaam:\n\n**A.** Delivery details maathalaam\n**B.** Pudusa vera product paakalaam\n\n**A** illai **B** nu reply pannunga.";
    }
    return {
      type: "text",
      text: cancelPrompt
    };
  } else {
    const summaryText = buildOrderSummary(session, lang);
    const orderSummary = buildOrderSummaryPayload(session);
    return {
      type: "delivery_result",
      text: summaryText,
      available: true,
      city: session.city,
      deliveryDate: session.delivery_date,
      productId: session.selected_product?.product_id,
      orderSummary
    };
  }
}

export async function handleCancelChoice(session, choice, lang = "en") {
  const lowerMsg = choice.toLowerCase().trim();
  const isA = lowerMsg === "a" || lowerMsg === "1" || lowerMsg.includes("change") || lowerMsg.includes("wenas") || lowerMsg.includes("maath");
  const isB = lowerMsg === "b" || lowerMsg === "2" || lowerMsg.includes("start over") || lowerMsg.includes("aluthin") || lowerMsg.includes("pudusa") || lowerMsg.includes("vera");

  if (isA) {
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
      postal_code: null,
      delivery_date: null,
      delivery_available: null,
      delivery_fee: null,
      contact_name: null,
      contact_phone: null
    };
    const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
    if (!updated) return null;

    const addressPrompt = getDeliveryAddressPrompt(lang);
    return {
      type: "text",
      text: addressPrompt
    };
  } else if (isB) {
    const updates = {
      state: "IDLE",
      selected_product: null,
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
      contact_name: null,
      contact_phone: null
    };
    await updateDeliverySession(session.sessionId, updates, session.session_version);
    
    let startOverMsg = "Alright, let's start over. What product are you looking for today? 😊";
    if (lang === "si") {
      startOverMsg = "Hari, aluthin wena product ekak balamu. Ada oyata ona mokakda? 😊";
    } else if (lang === "ta") {
      startOverMsg = "Seri, pudusa vera product paakalaam. Indru ungaluku enna vendum? 😊";
    }
    return {
      type: "text",
      text: startOverMsg
    };
  } else {
    let cancelPrompt = "Please reply with **A** to change delivery details or **B** to start over with another product.";
    if (lang === "si") {
      cancelPrompt = "Karunakarala delivery details wenas karanna **A** danna, nathnam aluth product ekak balanna **B** danna.";
    } else if (lang === "ta") {
      cancelPrompt = "Delivery details maatha **A** anuppunga, pudu product paaka **B** anuppunga.";
    }
    return {
      type: "text",
      text: cancelPrompt
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
      name: session.contact_name || "Guest User",
      phone: session.contact_phone || "0771234567",
      email: "guest@example.com"
    };

    const delivery = {
      address: session.normalized_address || session.city,
      city: session.city,
      date: session.delivery_date
    };

    const sender = {
      name: session.contact_name || "Guest User",
      anonymous: false
    };

    logger.info(`[DeliveryFlow] Calling createOrder for sessionId ${session.sessionId}`);
    const orderDoc = await createOrder(session.sessionId, { cart, recipient, delivery, sender });

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

    const productPrice = session.selected_product.price || 0;
    const deliveryFee = session.delivery_fee || 0;
    const subtotal = productPrice;
    const total = orderDoc.summary?.total || (productPrice + deliveryFee);

    return {
      type: "order_confirmation",
      text: successText,
      order: {
        referenceNumber: orderDoc.orderRef,
        orderNumber: orderDoc.orderRef,
        orderDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        estimatedDelivery: session.delivery_date || "Within 3-5 business days",
        paymentStatus: "Pending Payment",
        recipient: {
          name: session.contact_name || "Guest",
          phone: session.contact_phone || "",
          email: "guest@kapruka.com",
          address: session.normalized_address || session.city || ""
        },
        items: [{
          id: session.selected_product.product_id,
          name: session.selected_product.product_name,
          image: "",
          qty: 1,
          price: productPrice,
          currency: "Rs."
        }],
        summary: {
          subtotal,
          deliveryCharge: deliveryFee,
          discount: 0,
          total
        },
        paymentUrl: orderDoc.checkoutUrl
      }
    };

  } catch (error) {
    logger.error(`[DeliveryFlow] createOrder error: ${error.message}`);
    const freshSession = await getDeliverySession(session.sessionId);
    await updateDeliverySession(session.sessionId, { state: "WAITING_FOR_FINAL_ORDER_CONFIRMATION" }, freshSession.session_version);
    
    let errText = "";
    if (lang === "si") {
      errText = `Sorry 😔 mata me welawe order eka hadanna bari una. Oyage details thama save wela thiyenawa. Ayeth Yes kiyala try karanna onida?`;
    } else if (lang === "ta") {
      errText = `மன்னிக்கவும் 😔 இப்போது ஆர்டரை உருவாக்க முடியவில்லை. உங்கள் விபரங்கள் சேமிக்கப்பட்டுள்ளன. மீண்டும் Yes என அனுப்பி முயற்சிக்க விரும்புகிறீர்களா?`;
    } else {
      errText = `Sorry 😔 I couldn’t create the order right now. Your delivery details are still saved. Reply **Yes** to try again.`;
    }
    return {
      type: "text",
      text: errText
    };
  }
}
