import { findNearbyCities } from "./delivery.service.mjs";

export const getDeliveryAddressPrompt = (lang) => {
  if (lang === "si") {
    return "Delivery check karanna oyage full address eka ewanna puluwanda? (gewal ankayath ekkama) 😊";
  } else if (lang === "ta") {
    return "டெலிவரி விபரங்களைச் சரிபார்க்க, உங்கள் முழு முகவரியையும் அனுப்ப முடியுமா? 😊";
  }
  return "To check delivery availability, could you please provide your full delivery address? (including house/building number, road, area, and city) 😊";
};

export const getDeliveryAddressVagueMessage = (lang) => {
  if (lang === "si") {
    return `Aiyoo 😅 delivery address eka thawa poddak pahadiliwa ewanna puluwanda?

Karunakarala ewanna:
* house/building number eka
* road / street eka
* area eka
* city eka

Udaharana: **No 14, Hospital Road, Jaffna**`;
  } else if (lang === "ta") {
    return `Aiyoo 😅 முகவரியை இன்னும் கொஞ்சம் விபரமாக அனுப்ப முடியுமா?

தயவுசெய்து அனுப்பவும்:
* வீட்டு இலக்கம்
* வீதி பெயர்
* பகுதி / வட்டாரம்
* நகரம்

உதாரணம்: **No 14, Hospital Road, Jaffna**`;
  }
  return `Aiyoo 😅 I need a little more detail for the delivery address.

Please send:
* house/building number
* road / street
* area
* city

Example: **No 14, Hospital Road, Jaffna**`;
};

export const getDeliveryAddressConfirmationMessage = (address, lang) => {
  if (lang === "si") {
    return `Mama me delivery address eka hoyagaththa 😊
**${address}**

**A.** Ow, me address ekama thama
**B.** Address eka edit karanna`;
  } else if (lang === "ta") {
    return `நான் இந்த முகவரியைக் கண்டுபிடித்துள்ளேன் 😊
**${address}**

**A.** ஆம், இந்த முகவரியைப் பயன்படுத்தவும்
**B.** முகவரியைத் திருத்தவும்`;
  }
  return `I found this delivery address 😊
**${address}**

**A.** Yes, use this address
**B.** Edit address`;
};

export const getDeliveryDatePrompt = (lang) => {
  if (lang === "si") {
    return "Hari 👍 delivery karanna oni dawasa ewanna puluwanda? (tomorrow, next day hari custom date ekak) 😊";
  } else if (lang === "ta") {
    return "சரி 👍 டெலிவரி செய்ய வேண்டிய திகதியை அனுப்ப முடியுமா? (tomorrow, next day அல்லது ஒரு குறிப்பிட்ட திகதி) 😊";
  }
  return "Got it 👍 When would you like this delivered? (tomorrow, next day, or a specific date) 😊";
};

export const getDeliveryDateCancelMessage = (lang) => {
  if (lang === "si") {
    return "Awulak ne, mama delivery check eka cancel kara. 🤝";
  } else if (lang === "ta") {
    return "பிரச்சினை இல்லை, நான் டெலிவரி சரிபார்ப்பை ரத்து செய்துள்ளேன். 🤝";
  }
  return "No problem, I've cancelled the delivery check. 🤝";
};

export const getDeliverySuccessMessage = (city, date, charge, lang) => {
  if (lang === "si") {
    return `Niyamai! 🎉 **${city}** walata **${date}** dawasata delivery available (Delivery Charge: Rs. ${charge}).

Oyata me order eka place karanna onida? 😊`;
  } else if (lang === "ta") {
    return `அருமை! 🎉 **${city}** முகவரிக்கு **${date}** திகதியில் டெலிவரி செய்ய முடியும் (டெலிவரி கட்டணம்: ரூ. ${charge}).

ஆர்டரை உறுதிப்படுத்த விரும்புகிறீர்களா? 😊`;
  }
  return `Great news! 🎉 Delivery is available to **${city}** on **${date}** (Delivery Charge: Rs. ${charge}).

Would you like to place the order now? 😊`;
};

export const getDeliverySelectedCityPrefix = (selectedCity, lang) => {
  if (lang === "si") {
    return `Hari hari 👍 **${selectedCity}** walata delivery eka check karannam.`;
  } else if (lang === "ta") {
    return `Seri 👍 **${selectedCity}** ku delivery check pannuren.`;
  }
  return `Got it 👍 I’ll check delivery for **${selectedCity}** instead.`;
};

export const getDeliverySimilarProductsPrefix = (city, date, lang) => {
  if (lang === "si") {
    return `Hari 😄 oya select karapu city/date ekata deliver karanna puluwan similar products pennannam.`;
  } else if (lang === "ta") {
    return `Super 😄 unga city/date ku deliver panna mudiyum similar items kaamikkiren.`;
  }
  return `Sure 😊 I’ll show you similar items that can actually be delivered to **${city}** on **${date}**.`;
};

export const getDeliveryCancelRecoveryMessage = (lang) => {
  if (lang === "si") {
    return `Sorry ah 😔 me location/date ekata me delivery eka complete karaganna bari una.

Habai mama oyata thawath help karanna puluwan 👇

**A.** Oya kalin search karapu de walata similar products pennanna
**B.** Aluthin search ekak patan ganna

**A** hari **B** hari ekak danna — mama continue karannam 😊`;
  } else if (lang === "ta") {
    return `Sorry pa 😔 indha location/date ku delivery complete panna mudiyala.

Aana naan unga help pannalaam 👇

**A.** Neenga munnadi search pannina maari similar products kaamikkava?
**B.** Pudusa oru search start pannava?

**A** illa **B** nu sollunga — naan continue pannuren 😊`;
  }
  return `Sorry about the inconvenience 😔
Looks like I couldn’t complete this delivery for that location/date right now.

But I can still help you with one of these 👇

**A.** Show products similar to what you searched before
**B.** Start a fresh search for a new product

Reply with **A** or **B** and I’ll handle it for you 😊`;
};

export const getDeliveryCancelA_Prefix = (lang) => {
  if (lang === "si") {
    return `Hari 😄 oya kalin hoyapu de walata similar options tikak pennannam.`;
  } else if (lang === "ta") {
    return `Seri 😄 neenga munnadi paatha products maari innum sila options kaamikkiren.`;
  }
  return `No problem 😊 I’ll show you similar options based on what you searched earlier.`;
};

export const getDeliveryCancelB_Prefix = (lang) => {
  if (lang === "si") {
    return `Hari hari 👍 aluthin balamu.

Oya mokakda hoyanne? 👀`;
  } else if (lang === "ta") {
    return `Okay 👍 pudusa start pannalaam.

Ippo enna product theduveenga? 👀`;
  }
  return `Sure 👍 let’s start fresh.

What would you like to look for now? 👀`;
};

export const handleDeliveryFailure = async (city, date, productId, lang = "en") => {
  const altCities = await findNearbyCities(city);
  
  const nearest_city_1 = altCities[0] || "Colombo";
  const nearest_city_2 = altCities[1] || "Kandy";
  const nearest_city_3 = altCities[2] || "Jaffna";

  let textResponse = "";

  if (lang === "si") {
    textResponse = `Aiyoo 😔 **${city}** walata **${date}** dawasata me item eka deliver karanna bari wenawa.

Habai awulak ne — mama oyata options tikak hoyala thiyenawa 👇

**A.** **${nearest_city_1}** walata deliver karanna
**B.** **${nearest_city_2}** walata deliver karanna
**C.** **${nearest_city_3}** walata deliver karanna
**D.** Oya select karapu city/date ekata deliver karanna puluwan similar products pennanna
**E.** Me order eka cancel karanna

**A, B, C, D, E** walin ekak reply karanna 😊`;
  } else if (lang === "ta") {
    textResponse = `Aiyoo 😔 **${city}** ku **${date}** ku indha item delivery panna mudiyala.

Aana worry pannadhe — unga kaaga konjam options ready pannirukken 👇

**A.** **${nearest_city_1}** ku deliver pannalaam
**B.** **${nearest_city_2}** ku deliver pannalaam
**C.** **${nearest_city_3}** ku deliver pannalaam
**D.** Neenga select pannina city/date ku deliver panna koodiya similar products kaaminga
**E.** Indha order cancel pannunga

Please **A, B, C, D, illa E** nu reply pannunga 😊`;
  } else {
    textResponse = `Aiyoo 😔 looks like this item can’t be delivered to **${city}** on **${date}**.

But no worries — I found a few options for you 👇

**A.** Deliver to **${nearest_city_1}**
**B.** Deliver to **${nearest_city_2}**
**C.** Deliver to **${nearest_city_3}**
**D.** Show similar products that can be delivered to your selected location/date
**E.** Cancel this order

Just reply with **A, B, C, D, or E** 😊`;
  }

  return {
    available: false,
    city,
    deliveryDate: date,
    productId,
    nearestCities: [nearest_city_1, nearest_city_2, nearest_city_3],
    text: textResponse
  };
};
