import fs from 'fs';

const chatStreamCode = fs.readFileSync('kapruka-ai-agent/src/controllers/chatStream.controller.mjs', 'utf8');

let pipelineCode = chatStreamCode;

// Rename the main function
pipelineCode = pipelineCode.replace(
  'export const chatStream = async (req, res) => {',
  'export const processRequest = async (req, res, isStream = false) => {'
);

// Update controller name in logging
pipelineCode = pipelineCode.replace(
  'const controller = "chatStream.controller.mjs";',
  'const controller = "requestPipeline.service.mjs";'
);

// Imports for both streaming and non-streaming
const importsToReplace = `import {
  chatWithLLMStream,
  formatRecommendationsStream
} from "../services/ai/llmStream.service.mjs";`;

const newImports = `import { chatWithLLM } from "../services/ai/llm.service.mjs";
import { chatWithLLMStream, formatRecommendationsStream } from "../services/ai/llmStream.service.mjs";
import { formatRecommendations } from "../utils/formatters/recommendationFormatter.js";`;

pipelineCode = pipelineCode.replace(importsToReplace, newImports);

// Fix the Gemini general_chat block (Line 1047 in chatStream approx)
const geminiStreamBlock = `        const chatResult = await chatWithLLMStream(
          { message, history, memory: memoryState, memoryContext: "", runtimeContext },
          (chunk) => {
            if (!res.writableEnded) {
              res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
            }
          }
        );`;

const geminiBothBlock = `        let chatResult;
        if (isStream) {
          chatResult = await chatWithLLMStream(
            { message, history, memory: memoryState, memoryContext: "", runtimeContext },
            (chunk) => {
              if (!res.writableEnded) {
                res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
              }
            }
          );
        } else {
          chatResult = await chatWithLLM({ message, history, memory: memoryState, memoryContext: "", runtimeContext });
        }`;

pipelineCode = pipelineCode.replace(geminiStreamBlock, geminiBothBlock);

// Fix another chatWithLLMStream usage in Phase 9 (Line 1289 approx)
const phase9GeminiStreamBlock = `      req.pipelineStages.push("LLM (Gemini)");
      result = await chatWithLLMStream(
        { message, history, memory: memoryState, memoryContext, runtimeContext },
        (chunk) => {
          if (!res.writableEnded) {
            res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
          }
        }
      );`;

const phase9GeminiBothBlock = `      req.pipelineStages.push("LLM (Gemini)");
      if (isStream) {
        result = await chatWithLLMStream(
          { message, history, memory: memoryState, memoryContext, runtimeContext },
          (chunk) => {
            if (!res.writableEnded) {
              res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
            }
          }
        );
      } else {
        result = await chatWithLLM({ message, history, memory: memoryState, memoryContext, runtimeContext });
      }`;

pipelineCode = pipelineCode.replace(phase9GeminiStreamBlock, phase9GeminiBothBlock);


// Fix formatRecommendationsStream usages
// Priority 3: Resume Search A
const formatResumeSearchA = `            const formattedText = await formatRecommendationsStream(
              message,
              searchResult,
              history,
              voiceMode,
              (chunk) => {
                if (!res.writableEnded) {
                  res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
                }
              }
            );`;

const formatBothSearchA = `            let formattedText;
            if (isStream) {
              formattedText = await formatRecommendationsStream(
                message,
                searchResult,
                history,
                voiceMode,
                (chunk) => {
                  if (!res.writableEnded) {
                    res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
                  }
                }
              );
            } else {
              formattedText = await formatRecommendations(message, searchResult, history, voiceMode);
            }`;
pipelineCode = pipelineCode.replace(formatResumeSearchA, formatBothSearchA);

// Priority 3: Resume Search B
const formatResumeSearchB = `            const formattedText = await formatRecommendationsStream(
              pendingQuery,
              searchResult,
              history,
              voiceMode,
              (chunk) => {
                if (!res.writableEnded) {
                  res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
                }
              }
            );`;

const formatBothSearchB = `            let formattedText;
            if (isStream) {
              formattedText = await formatRecommendationsStream(
                pendingQuery,
                searchResult,
                history,
                voiceMode,
                (chunk) => {
                  if (!res.writableEnded) {
                    res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
                  }
                }
              );
            } else {
              formattedText = await formatRecommendations(pendingQuery, searchResult, history, voiceMode);
            }`;
pipelineCode = pipelineCode.replace(formatResumeSearchB, formatBothSearchB);


// Format Array result (Phase 10)
const formatArrayResult = `        logStepStart("Formatting results");
        text = await formatRecommendationsStream(message, result, history, voiceMode, (chunk) => {
          if (!res.writableEnded) {
            res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
          }
        });
        logStepDone("Formatting done", \`\${result.length} products\`);`;

const formatBothArrayResult = `        logStepStart("Formatting results");
        if (isStream) {
          text = await formatRecommendationsStream(message, result, history, voiceMode, (chunk) => {
            if (!res.writableEnded) {
              res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
            }
          });
        } else {
          text = await formatRecommendations(message, result, history, voiceMode);
        }
        logStepDone("Formatting done", \`\${result.length} products\`);`;
pipelineCode = pipelineCode.replace(formatArrayResult, formatBothArrayResult);

// Format product grid result (Phase 10)
const formatGridResult = `          logStepStart("Formatting suggested results");
          const history = await getRecentHistory(sessionId);
          text = await formatRecommendationsStream(message, result.products || [], history, voiceMode, (chunk) => {
            if (!res.writableEnded) {
              res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
            }
          });
          logStepDone("Formatting suggested done");`;

const formatBothGridResult = `          logStepStart("Formatting suggested results");
          const history = await getRecentHistory(sessionId);
          if (isStream) {
            text = await formatRecommendationsStream(message, result.products || [], history, voiceMode, (chunk) => {
              if (!res.writableEnded) {
                res.write(\`data: \${JSON.stringify({ type: "chunk", text: chunk })}\\n\\n\`);
              }
            });
          } else {
            text = await formatRecommendations(message, result.products || [], history, voiceMode);
          }
          logStepDone("Formatting suggested done");`;
pipelineCode = pipelineCode.replace(formatGridResult, formatBothGridResult);


// We must remove some non-essential streaming writes if not streaming, but actually it's fine since we check writableEnded or we can just condition them on isStream.
// e.g., setSSEHeaders(res)
// This is called inside utility functions or direct writes.
// Let's modify setSSEHeaders to be safe or conditionally apply it.
const setSSE = `setSSEHeaders(res);`;
const condSetSSE = `if (isStream) setSSEHeaders(res);`;
pipelineCode = pipelineCode.split(setSSE).join(condSetSSE);

// res.write() should be wrapped in isStream for raw text chunks
pipelineCode = pipelineCode.replace(
  /if \(!res\.writableEnded\) \{\s+res\.write\(`data: \$\{JSON\.stringify\(\{ type: "chunk", text: ([^}]+) \}\)\}\\n\\n`\);\s+\}/g,
  `if (isStream && !res.writableEnded) {
            res.write(\`data: \${JSON.stringify({ type: "chunk", text: $1 })}\\n\\n\`);
          }`
);

// Fix other raw res.writes like for refResult.response
pipelineCode = pipelineCode.replace(
  /if \(!res\.writableEnded\) \{\s+res\.write\(`data: \$\{JSON\.stringify\(\{ type: "chunk", text: refResult\.response \}\)\}\\n\\n`\);\s+\}/g,
  `if (isStream && !res.writableEnded) {
          res.write(\`data: \${JSON.stringify({ type: "chunk", text: refResult.response })}\\n\\n\`);
        }`
);

// One missed format: `updateProgress`
// createProgressUpdater should probably be conditional or it already handles non-streaming gracefully?
// Actually, createProgressUpdater sends SSE chunks.
const progressUpdater = `const updateProgress = createProgressUpdater(res, logs);`;
const condProgressUpdater = `const updateProgress = isStream ? createProgressUpdater(res, logs) : () => {};`;
pipelineCode = pipelineCode.replace(progressUpdater, condProgressUpdater);

// Context extraction progress event
const ctxExtractionEvent = `    if (!res.writableEnded) {
      res.write(\`data: \${JSON.stringify({
        type: "progress",
        step: "EXTRACTING",
        message: "Context extracted",
        logs: [
          { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: [\`Intent: \${parsedIntent.intent}\`] },
          { id: "EXTRACTING", title: "Extracting context", status: "completed", details: ctxDetails }
        ]
      })}\\n\\n\`);
    }`;

const condCtxExtractionEvent = `    if (isStream && !res.writableEnded) {
      res.write(\`data: \${JSON.stringify({
        type: "progress",
        step: "EXTRACTING",
        message: "Context extracted",
        logs: [
          { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: [\`Intent: \${parsedIntent.intent}\`] },
          { id: "EXTRACTING", title: "Extracting context", status: "completed", details: ctxDetails }
        ]
      })}\\n\\n\`);
    }`;
pipelineCode = pipelineCode.replace(ctxExtractionEvent, condCtxExtractionEvent);

fs.writeFileSync('kapruka-ai-agent/src/services/core/requestPipeline.service.mjs', pipelineCode);

console.log("Migration script complete");
