import fs from 'fs';

const chatControllerPath = 'kapruka-ai-agent/src/controllers/chat.controller.mjs';
let chatCode = fs.readFileSync(chatControllerPath, 'utf8');

// Replace everything from export const chat = async to export const saveLocalMessage with the new wrapper
chatCode = chatCode.replace(/export const chat = async \(req, res\) => \{[\s\S]*?(?=export const saveLocalMessage)/, 
`import { processRequest } from "../services/core/requestPipeline.service.mjs";

export const chat = async (req, res) => {
  return processRequest(req, res, false);
};

`);

// Clean up unused imports at the top
const chatImportsToKeep = `import { processRequest } from "../services/core/requestPipeline.service.mjs";
import { saveMessage } from "../services/memory/conversation.service.mjs";
import { addMessage } from "../services/memory/chatMemory.service.mjs";
`;
chatCode = chatImportsToKeep + chatCode.substring(chatCode.indexOf('export const chat ='));

fs.writeFileSync(chatControllerPath, chatCode);

const streamControllerPath = 'kapruka-ai-agent/src/controllers/chatStream.controller.mjs';

const streamCode = `import { processRequest } from "../services/core/requestPipeline.service.mjs";

export const chatStream = async (req, res) => {
  return processRequest(req, res, true);
};
`;
fs.writeFileSync(streamControllerPath, streamCode);

console.log('Controllers refactored.');
