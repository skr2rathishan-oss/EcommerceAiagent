/**
 * test-cul.mjs — Quick validation of the Conversation Understanding Layer
 */
import { understandConversation, selectResponse, buildDecision } from "../services/responseService.mjs";

const tests = [
  {
    label: "English greeting",
    msg: "hello",
    intent: "general_chat",
    params: {},
    ctx: {},
    deliveryState: null,
  },
  {
    label: "Singlish search (cake)",
    msg: "Mama cake order karanna oni",
    intent: "search_products",
    params: { query: "cake" },
    ctx: {},
    deliveryState: null,
  },
  {
    label: "English birthday gift search",
    msg: "birthday gift for my girlfriend",
    intent: "search_products",
    params: { query: "birthday gift", recipient: "girlfriend", occasion: "birthday" },
    ctx: {},
    deliveryState: null,
  },
  {
    label: "Delivery intent",
    msg: "Deliver to Colombo",
    intent: "check_delivery",
    params: { city: "Colombo" },
    ctx: { deliveryLocation: "Colombo" },
    deliveryState: null,
  },
  {
    label: "Tamil mix greeting",
    msg: "Vanakkam enna shopping pannalaam",
    intent: "general_chat",
    params: {},
    ctx: {},
    deliveryState: null,
  },
  {
    label: "Active delivery state override",
    msg: "Main road, Colombo 3",
    intent: "general_chat",
    params: {},
    ctx: {},
    deliveryState: "WAITING_FOR_ADDRESS",
  },
  {
    label: "Order intent",
    msg: "I want to buy this",
    intent: "create_order",
    params: {},
    ctx: {},
    deliveryState: null,
  },
  {
    label: "Thank you (should use response library)",
    msg: "thank you so much",
    intent: "general_chat",
    params: {},
    ctx: {},
    deliveryState: null,
  },
  {
    label: "Interrupted flow (delivery in progress, user asks for shopping)",
    msg: "Can I also see some chocolate cakes?",
    intent: "search_products",
    params: { query: "chocolate cake" },
    ctx: { productType: "chocolate cake" },
    deliveryState: "WAITING_FOR_ADDRESS",
  },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    const culOutput = await understandConversation({
      message: t.msg,
      deliveryState: t.deliveryState,
    });

    const decision = buildDecision(culOutput, t.deliveryState);

    const response = selectResponse(decision, {}, "test_session_id");

    console.log(`\n[${t.label}]`);
    console.log(`  Message:  "${t.msg}"`);
    console.log(`  Language: ${decision.language.detected} (${decision.language.confidence})`);
    console.log(`  Intent:   ${decision.intent.value} (${decision.intent.confidence})`);
    console.log(`  Emotion:  ${decision.emotion}`);
    console.log(`  Stage:    ${decision.conversation_stage}`);
    console.log(`  Flow:     ${decision.active_flow}`);
    console.log(`  Tool:     required=${decision.tool.required} name=${decision.tool.name}`);
    console.log(`  Library:  ${decision.response.module}/${decision.response.category}`);
    console.log(`  LLM?:     ${decision.llm_response}`);
    console.log(`  Response Object:`, response);
    passed++;
  } catch (e) {
    console.error(`[FAIL] ${t.label}: ${e.message}`);
    failed++;
  }
}

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
