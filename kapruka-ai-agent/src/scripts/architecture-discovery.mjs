import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(SRC_DIR, '..');
const FRONTEND_DIR = path.resolve(ROOT_DIR, '..', 'frontend');

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

const report = [];

report.push("# Velora Architecture Discovery Report");
report.push("\n## 1. Controllers Map");
const controllersPath = path.join(SRC_DIR, 'controllers');
if (fs.existsSync(controllersPath)) {
    fs.readdirSync(controllersPath).forEach(file => {
        if (file.endsWith('.mjs') || file.endsWith('.js')) {
            const content = fs.readFileSync(path.join(controllersPath, file), 'utf8');
            const exports = [...content.matchAll(/export const ([a-zA-Z0-9_]+) =/g)].map(m => m[1]);
            report.push(`- **${file}**`);
            report.push(`  - Endpoints/Handlers: ${exports.join(', ') || 'None found'}`);
            
            const imports = [...content.matchAll(/import .* from ['"](.*)['"]/g)].map(m => m[1]);
            const services = imports.filter(i => i.includes('service') || i.includes('Service')).map(i => path.basename(i));
            if (services.length > 0) report.push(`  - Services Called: ${services.join(', ')}`);
        }
    });
}

report.push("\n## 2. Services Dependency Graph");
const servicesPath = path.join(SRC_DIR, 'services');
if (fs.existsSync(servicesPath)) {
    walkDir(servicesPath, (filePath) => {
        if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(SRC_DIR, filePath);
            const imports = [...content.matchAll(/import .* from ['"](.*)['"]/g)].map(m => m[1]);
            const internalDeps = imports.filter(i => i.startsWith('.'));
            report.push(`- **${relativePath}**`);
            if (internalDeps.length > 0) {
                report.push(`  - Dependencies: ${internalDeps.join(', ')}`);
            } else {
                report.push(`  - Dependencies: None`);
            }
        }
    });
}

report.push("\n## 3. Conversation Pipeline");
report.push("User -> Controller (`chat.controller.mjs`) -> CUL (`understandConversation`) -> Decision Builder (`buildDecision`) -> State Management (`updateMemory`, `saveMessage`) -> Response Engine (`routeIntent` / LLM) -> Gemini -> Streaming Response.");

report.push("\n## 4. Gemini Pipeline");
let geminiFiles = [];
walkDir(SRC_DIR, (filePath) => {
    if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('@google/genai') || content.includes('gemini') || content.includes('chatWithLLM')) {
            geminiFiles.push(path.relative(SRC_DIR, filePath));
        }
    }
});
report.push("Files integrating with Gemini:");
geminiFiles.forEach(f => report.push(`- ${f}`));

report.push("\n## 5. MCP Pipeline");
let mcpFiles = [];
walkDir(SRC_DIR, (filePath) => {
    if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('mcp.client') || content.includes('@modelcontextprotocol/sdk')) {
            mcpFiles.push(path.relative(SRC_DIR, filePath));
        }
    }
});
report.push("Files integrating with MCP:");
mcpFiles.forEach(f => report.push(`- ${f}`));

report.push("\n## 6. Conversation State");
report.push("- Handled largely in `services/commerce/conversationStateService.mjs` (loadConversationState, saveConversationState)");
report.push("- Shopping Context in `services/commerce/shoppingContextService.mjs`");
report.push("- Memory in `agent/memoryManager.mjs` & `services/memory/chatMemory.service.mjs`");

report.push("\n## 7. Prompt Pipeline");
report.push("- `agent/core/promptCache.mjs` - Initializes and manages prompt cache.");
report.push("- `agent/core/promptLoader.mjs` - Loads system prompts and modules.");
report.push("- `agent/builders/runtimeBuilder.mjs` - Constructs runtime variables.");

report.push("\n## 8. Frontend Request Pipeline");
if (fs.existsSync(FRONTEND_DIR)) {
    report.push("Frontend repository found. Assumed standard React/Vite interaction with `/api/chat` endpoints via SSE.");
} else {
    report.push("Frontend directory not found at standard path.");
}

report.push("\n## 9. Duplicate Implementation Report");
report.push("- Found multiple memory managers (`agent/memoryManager.mjs`, `services/memory/memory.service.mjs`, `services/memory/chatMemory.service.mjs`). This indicates some duplication in state handling.");

report.push("\n## 11. Workflow Engine Integration Points");
report.push("To properly connect `05_workflowManager.mjs`:");
report.push("- **`chat.controller.mjs`**: Inject `manageWorkflow` immediately after `buildDecision` and CUL extraction.");
report.push("- Use the returned `workflow` state to dynamically route to Shopping Context, Delivery Flow, or General Chat.");
report.push("- Replace hardcoded interceptions (e.g. `if (isResumeRequest && userState?.pausedFlows...`) with proper Workflow Manager transitions.");

fs.writeFileSync(path.join(ROOT_DIR, 'architecture-report.md'), report.join('\n'));
console.log('Architecture report generated at ' + path.join(ROOT_DIR, 'architecture-report.md'));
