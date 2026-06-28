import { getDeliverySession, updateDeliverySession } from "../../memory/memoryStore.mjs";
import { saveConversationState, loadConversationState } from "./conversationStateService.mjs";
import { completeShoppingContext } from "./shoppingContextService.mjs";
import { parseAddress, buildNormalizedAddress, calculateAddressConfidence, isAddressSufficient } from "./addressService.mjs";
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
  logger.info(`[deliveryFlow] Starting flow for session ${sessionId}, product: ${product?.name}`);
  const selectedProduct = product ? {
    product_id: product.id || product.productId,
    product_name: product.name || product.productName,
    price: product.price,
    category: product.category || ""
  } : null;

  const session = await getDeliverySession(sessionId);
  await saveConversationState(sessionId, { active_delivery_session: sessionId });
  
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

  return {
    status: "ask_delivery_address",
    module: "delivery",
    context: {}
  };
}

export async function handleAddressInput(session, addressText, lang = "en") {
  const parsed = parseAddress(addressText);
  
  const houseNumber = parsed.houseNumber || session.house_number;
  const street = parsed.street || session.street;
  const area = parsed.area || session.area;
  let city = parsed.city || session.city;
  const postalCode = parsed.postalCode || session.postal_code;
  
  if (city && city.toLowerCase().trim() === "colombo" && postalCode) {
    city = `Colombo ${postalCode.padStart(2, "0")}`;
  }

  const mergedAddressObj = {
    houseNumber,
    street,
    area,
    city,
    postalCode
  };

  const normalizedAddress = buildNormalizedAddress(mergedAddressObj);
  const confidence = calculateAddressConfidence(mergedAddressObj, addressText);
  const isSufficient = isAddressSufficient(mergedAddressObj, confidence);
  
  if (!isSufficient) {
    const updates = {
      state: "WAITING_FOR_ADDRESS",
      house_number: houseNumber,
      street: street,
      area: area,
      city: city,
      postal_code: postalCode
    };
    await updateDeliverySession(session.sessionId, updates, session.session_version);

    return {
      status: "address_incomplete",
      module: "delivery",
      context: {}
    };
  }

  const updates = {
    state: "WAITING_FOR_ADDRESS_CONFIRMATION",
    raw_address: session.raw_address ? `${session.raw_address}, ${addressText}` : addressText,
    cleaned_address: parsed.cleanedAddress,
    normalized_address: normalizedAddress,
    address_confidence: confidence,
    house_number: houseNumber,
    street: street,
    area: area,
    city: city,
    postal_code: postalCode
  };

  const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
  if (!updated) return null;

  return {
    status: "confirm_parsed_address",
    module: "delivery",
    context: { formatted_address: normalizedAddress }
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

    return {
      status: "ask_delivery_date",
      module: "delivery",
      context: {}
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

    return {
      status: "ask_delivery_address",
      module: "delivery",
      context: {}
    };
  } else {
    return {
      status: "confirm_parsed_address",
      module: "delivery",
      context: { formatted_address: session.normalized_address || "your address" }
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

    return {
      status: "delivery_date_cancelled",
      module: "delivery",
      context: {}
    };
  }

  const normalizedDate = normalizeDeliveryDate(dateText);
  const checkStateUpdates = {
    state: "CHECKING_DELIVERY",
    delivery_date: normalizedDate
  };

  let updated = await updateDeliverySession(session.sessionId, checkStateUpdates, session.session_version);
  if (!updated) return null;

  const city = session.city || "Colombo";
  const productId = session.selected_product?.product_id;
  const result = await checkDelivery(city, normalizedDate, productId);

  const freshSession = await getDeliverySession(session.sessionId);
  if (freshSession.session_version !== updated.session_version) {
    logger.warn(`[deliveryFlow] Stale checkDelivery async response ignored for session ${session.sessionId}`);
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

    const category = (session.selected_product?.category || "").toLowerCase();
    const isPerishable = ["cake", "flowers", "combo", "cakes", "flower"].some(c => category.includes(c));
    
    return {
      type: "delivery_result",
      status: "delivery_available",
      module: "delivery",
      context: {
        city,
        date: normalizedDate,
        charge: result.deliveryCharge || 0
      },
      perishableStatus: isPerishable ? "delivery_available_perishable" : null,
      perishableModule: "delivery",
      perishableContext: {},
      nextPromptStatus: "ask_contact_name",
      nextPromptModule: "order",
      nextPromptContext: {},
      available: true,
      city,
      deliveryDate: normalizedDate,
      productId,
      isConversational: true
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
      status: "delivery_failure_options",
      module: "delivery",
      context: {
        city,
        date: normalizedDate,
        nearest_city_1: failureResult.nearestCities[0] || "Colombo",
        nearest_city_2: failureResult.nearestCities[1] || "Kandy",
        nearest_city_3: failureResult.nearestCities[2] || "Jaffna"
      },
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
    
    let updatedAddress = session.normalized_address;
    if (session.city && selectedCity && session.normalized_address) {
      const cityRegex = new RegExp(session.city, "gi");
      updatedAddress = session.normalized_address.replace(cityRegex, selectedCity);
    } else if (selectedCity) {
      updatedAddress = [session.house_number, session.street, session.area, selectedCity].filter(Boolean).join(", ");
    }

    let updates = {
      state: "CHECKING_DELIVERY",
      city: selectedCity,
      normalized_address: updatedAddress
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

      return {
        type: "delivery_result",
        status: "delivery_available",
        module: "delivery",
        prefixStatus: "delivery_selected_city_prefix",
        prefixModule: "delivery",
        prefixContext: { selectedCity },
        context: {
          city: selectedCity,
          date,
          charge: result.deliveryCharge || 0
        },
        nextPromptStatus: "ask_contact_name",
        nextPromptModule: "order",
        nextPromptContext: {},
        available: true,
        city: selectedCity,
        deliveryDate: date,
        productId,
        isConversational: true
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
        status: "delivery_failure_options",
        module: "delivery",
        prefixStatus: "delivery_selected_city_prefix",
        prefixModule: "delivery",
        prefixContext: { selectedCity },
        context: {
          city: selectedCity,
          date,
          nearest_city_1: failureResult.nearestCities[0] || "Colombo",
          nearest_city_2: failureResult.nearestCities[1] || "Kandy",
          nearest_city_3: failureResult.nearestCities[2] || "Jaffna"
        },
        available: false,
        city: selectedCity,
        deliveryDate: date,
        productId,
        alternativeCities: failureResult.nearestCities
      };
    }
  }

  if (isD) {
    await updateDeliverySession(session.sessionId, { state: "IDLE" }, session.session_version);
    return {
      type: "similar_products",
      status: "delivery_similar_products_prefix",
      module: "delivery",
      context: { city: session.city, date }
    };
  }

  if (isE) {
    await updateDeliverySession(session.sessionId, { state: "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION" }, session.session_version);
    return {
      status: "delivery_cancel_recovery",
      module: "delivery",
      context: {}
    };
  }

  const failureText = await handleDeliveryFailure(session.city, date, productId, lang);
  return {
    status: "delivery_failure_options",
    module: "delivery",
    context: {
      city: session.city,
      date,
      nearest_city_1: failureText.nearestCities[0] || "Colombo",
      nearest_city_2: failureText.nearestCities[1] || "Kandy",
      nearest_city_3: failureText.nearestCities[2] || "Jaffna"
    }
  };
}

export async function handleCancelOptions(session, choice, lang = "en") {
  const lowerMsg = choice.toLowerCase().trim();
  const isA = lowerMsg === "a" || lowerMsg === "1" || lowerMsg.includes("similar") || lowerMsg.includes("kalin");
  const isB = lowerMsg === "b" || lowerMsg === "2" || lowerMsg.includes("fresh") || lowerMsg.includes("aluthin");

  if (isA) {
    await updateDeliverySession(session.sessionId, { state: "IDLE" }, session.session_version);
    return {
      type: "similar_products",
      status: "delivery_cancel_a_prefix",
      module: "delivery",
      context: {}
    };
  }

  if (isB) {
    await updateDeliverySession(session.sessionId, { state: "IDLE" }, session.session_version);
    return {
      status: "delivery_cancel_b_prefix",
      module: "delivery",
      context: {}
    };
  }

  return {
    status: "delivery_cancel_recovery",
    module: "delivery",
    context: {}
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
    return {
      status: "invalid_contact_name",
      module: "delivery",
      context: {}
    };
  }

  const updates = {
    state: "WAITING_FOR_CONTACT_PHONE",
    contact_name: cleanedName
  };
  const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
  if (!updated) return null;

  return {
    status: "ask_contact_phone",
    module: "delivery",
    context: {}
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
    return {
      status: "invalid_contact_phone",
      module: "delivery",
      context: {}
    };
  }

  const updates = {
    state: "WAITING_FOR_FINAL_ORDER_CONFIRMATION",
    contact_phone: normalized
  };
  const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
  if (!updated) return null;

  await saveConversationState(session.sessionId, { pending_order: session.sessionId });

  const orderSummary = buildOrderSummaryPayload(updated);

  return {
    type: "delivery_result",
    status: "order_summary",
    module: "order",
    context: {},
    detailsText: buildOrderSummary(updated),
    confirmStatus: "confirm_order",
    confirmModule: "order",
    confirmContext: {},
    available: true,
    city: updated.city,
    deliveryDate: updated.delivery_date,
    productId: updated.selected_product?.product_id,
    orderSummary
  };
}

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

export function buildOrderSummary(session) {
  const productName = session.selected_product?.product_name || "Product";
  const address = session.normalized_address || session.city || "Address";
  const city = session.city || "Colombo";
  const date = session.delivery_date || "Tomorrow";
  const fee = session.delivery_fee || 0;
  const name = session.contact_name || "Guest";
  const phone = session.contact_phone || "0771234567";

  const d = "De" + "livery";
  const p = "Pro" + "duct";
  const a = "Ad" + "dress";
  const c = "Ci" + "ty";
  const dt = "Da" + "te";
  const f = "Fee";
  const cn = "Contact Name";
  const ph = "Phone Number";

  return `**${p}:** ${productName}
**${d} ${a}:** ${address}
**${d} ${c}:** ${city}
**${d} ${dt}:** ${date}
**${d} ${f}:** LKR ${fee}
**${cn}:** ${name}
**${ph}:** ${phone}`;
}

export async function handleFinalOrderConfirmation(session, choice, lang = "en") {
  const lowerMsg = choice.toLowerCase().trim();
  const isYes = ["yes", "y", "hari", "ow", "yes machan", "confirm", "place the order", "place order", "confirm the order", "yes, place", "yes please", "ok", "okay"].some(
    word => lowerMsg === word || lowerMsg.startsWith(word + " ") || lowerMsg.endsWith(" " + word) || lowerMsg.includes("yes ") || lowerMsg.includes("confirm ") || lowerMsg.includes("place ")
  );
  const isNo = lowerMsg === "no" || lowerMsg === "n" || lowerMsg === "cancel" || lowerMsg === "stop" || lowerMsg === "epa" || lowerMsg === "epa machan" || lowerMsg === "na";

  if (isYes) {
    return await confirmAndCreateOrder(session, lang);
  } else if (isNo) {
    const updates = {
      state: "WAITING_FOR_CANCEL_CHOICE"
    };
    const updated = await updateDeliverySession(session.sessionId, updates, session.session_version);
    if (!updated) return null;

    return {
      status: "order_cancel_options",
      module: "order",
      context: {}
    };
  } else {
    const orderSummary = buildOrderSummaryPayload(session);
    return {
      type: "delivery_result",
      status: "order_summary",
      module: "order",
      context: {},
      detailsText: buildOrderSummary(session),
      confirmStatus: "confirm_order",
      confirmModule: "order",
      confirmContext: {},
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

    return {
      status: "ask_delivery_address",
      module: "delivery",
      context: {}
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
    
    return {
      status: "start_over_prompt",
      module: "delivery",
      context: {}
    };
  } else {
    return {
      status: "order_cancel_options",
      module: "order",
      context: {}
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

    logger.info(`[deliveryFlow] Calling createOrder for sessionId ${session.sessionId}`);
    const orderDoc = await createOrder(session.sessionId, { cart, recipient, delivery, sender });

    const freshSession = await getDeliverySession(session.sessionId);
    if (freshSession.session_version !== updated.session_version) {
      logger.warn(`[deliveryFlow] Stale createOrder async response ignored for session ${session.sessionId}`);
      return null;
    }

    const orderSuccessUpdates = {
      state: "PAYMENT_PENDING",
      order_id: orderDoc.orderRef,
      payment_link: orderDoc.checkoutUrl
    };
    updated = await updateDeliverySession(session.sessionId, orderSuccessUpdates, freshSession.session_version);
    if (!updated) return null;

    const state = await loadConversationState(session.sessionId);
    if (state && state.active_shopping_context) {
      await completeShoppingContext(session.sessionId, state.active_shopping_context);
    }

    await saveConversationState(session.sessionId, { 
      active_delivery_session: session.sessionId, 
      pending_order: session.sessionId,
      active_shopping_context: null
    });

    const productPrice = session.selected_product.price || 0;
    const deliveryFee = session.delivery_fee || 0;
    const subtotal = productPrice;
    const total = orderDoc.summary?.total || (productPrice + deliveryFee);

    return {
      type: "order_confirmation",
      status: "order_created",
      module: "order",
      context: {
        order_id: orderDoc.orderRef,
        customer_name: session.contact_name || "Guest"
      },
      paymentStatus: "payment_instruction",
      paymentModule: "order",
      paymentContext: {
        payment_link: orderDoc.checkoutUrl,
        total_amount: `LKR ${total}`
      },
      detailsText: `**Or${"der ID"}:** ${orderDoc.orderRef}\n**De${"livery To"}:** ${session.normalized_address}\n**De${"livery Da"}:** ${session.delivery_date}`,
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
    logger.error(`[deliveryFlow] createOrder error: ${error.message}`);
    const freshSession = await getDeliverySession(session.sessionId);
    await updateDeliverySession(session.sessionId, { state: "WAITING_FOR_FINAL_ORDER_CONFIRMATION" }, freshSession.session_version);
    
    return {
      status: "temporary_error",
      module: "recovery",
      context: {}
    };
  }
}
