const fs = require('fs');
const path = require('path');

const servicesDir = path.join('c:/Users/Rathishan/Desktop/Git/Ecommerceagent/kapruka-ai-agent/src/services');

// Subdirectories in services
const subdirs = ['core', 'ai', 'memory', 'commerce', 'integration', 'analytics', 'media'];

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixImports(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Match any import or require that starts with "../"
      // Since these files were moved from src/services/ to src/services/XYZ/,
      // they are now one level deeper.
      // Therefore, if they import something that is NOT another service (e.g. "../agent/...", "../utils/...", "../database/...", "../config/...")
      // the path should change from "../" to "../../".
      
      // We will look for "../" that are NOT followed by one of the subdirs (since the previous script fixed internal service imports already like "../core/")
      
      const regex = /(['"`])\.\.\/((?!core\/|ai\/|memory\/|commerce\/|integration\/|analytics\/|media\/)[a-zA-Z0-9_\-\.]+)/g;
      
      content = content.replace(regex, (match, q1, rest) => {
        modified = true;
        return `${q1}../../${rest}`;
      });

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed imports in: ${fullPath}`);
      }
    }
  }
}

for (const subdir of subdirs) {
  fixImports(path.join(servicesDir, subdir));
}
console.log("Done fixing relative imports!");
