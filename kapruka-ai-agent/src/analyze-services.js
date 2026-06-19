const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Rathishan/Desktop/Git/Ecommerceagent/kapruka-ai-agent/src/services';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = content.split('\n').slice(0, 15);
  console.log(`=== ${file} ===`);
  console.log(lines.join('\n'));
  console.log();
}
