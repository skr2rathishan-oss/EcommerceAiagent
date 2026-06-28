import fs from 'fs';
let code = fs.readFileSync('kapruka-ai-agent/src/services/core/requestPipeline.service.mjs', 'utf8');

code = code.replace(/from "\.\.\//g, 'from "../../');
fs.writeFileSync('kapruka-ai-agent/src/services/core/requestPipeline.service.mjs', code);
console.log('Fixed imports in pipeline');
