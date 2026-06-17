const fs = require('fs');
const path = require('path');

const projectRoot = 'c:/Users/Rathishan/Desktop/Git/Ecommerceagent/kapruka-ai-agent/src';
const servicesDir = path.join(projectRoot, 'services');

const fileMapping = {
  'logger.service.mjs': 'core',
  'cache.service.mjs': 'core',
  'redis.service.mjs': 'core',
  'performance.service.mjs': 'core',
  'startupHealthService.mjs': 'core',
  'llm.service.mjs': 'ai',
  'modelRouter.mjs': 'ai',
  'contextBuilder.service.mjs': 'ai',
  'chatMemory.service.mjs': 'memory',
  'memory.service.mjs': 'memory',
  'memoryManager.service.mjs': 'memory',
  'conversation.service.mjs': 'memory',
  'order.service.mjs': 'commerce',
  'orderTracking.service.mjs': 'commerce',
  'delivery.service.mjs': 'commerce',
  'deliveryRecoveryService.mjs': 'commerce',
  'productInteraction.service.mjs': 'commerce',
  'recommendation.service.mjs': 'commerce',
  'recommendationCache.service.mjs': 'commerce',
  'recommendationExplanation.service.mjs': 'commerce',
  'mcp.client.mjs': 'integration',
  'mcp.service.mjs': 'integration',
  'googleMapsService.mjs': 'integration',
  'googleMapsHealthService.mjs': 'integration',
  'analytics.service.mjs': 'analytics',
  'insights.service.mjs': 'analytics',
  'languageDetector.js': 'media',
  'translationService.js': 'media',
  'voiceService.js': 'media',
};

// 1. Create directories
const dirs = new Set(Object.values(fileMapping));
dirs.forEach(dir => {
  const dirPath = path.join(servicesDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// 2. Move files
const movedFiles = [];
Object.entries(fileMapping).forEach(([file, newDir]) => {
  const oldPath = path.join(servicesDir, file);
  const newPath = path.join(servicesDir, newDir, file);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    movedFiles.push({ file, newDir });
    console.log(`Moved ${file} to ${newDir}/`);
  }
});

// 3. Update imports across all .js and .mjs files in src
function updateImportsInDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      updateImportsInDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Determine depth to calculate relative paths properly
      const relativeToSrc = path.relative(projectRoot, fullPath);
      const isInsideServices = relativeToSrc.startsWith('services\\') || relativeToSrc.startsWith('services/');

      movedFiles.forEach(({ file, newDir }) => {
        // Regex to match imports of the moved files
        // E.g. "../services/core/logger.service.mjs" or "./services/core/logger.service.mjs"
        const regex = new RegExp(`(['"\`])((?:\\.\\/|\\.\\.\\/)+)(?:services\\/)?${file.replace('.', '\\.')}(['"\`])`, 'g');
        
        content = content.replace(regex, (match, quote1, relPath, quote2) => {
          modified = true;
          
          if (isInsideServices) {
            // If the file being modified is inside a services subdirectory (e.g. core/logger.service.mjs)
            // and it imports another service (e.g. memory/memory.service.mjs), 
            // the relative path should be "../memory/memory.service.mjs"
            
            // Check if the current file itself was moved into a subdir
            const currentFileName = path.basename(fullPath);
            const currentFileDir = fileMapping[currentFileName];
            
            if (currentFileDir) {
               // We are inside a subdirectory like src/services/core/
               return `${quote1}../${newDir}/${file}${quote2}`;
            } else {
               // We are in src/services/ (not moved) or another deep folder
               return `${quote1}${relPath}${newDir}/${file}${quote2}`;
            }
          } else {
            // Outside services (e.g. controllers, routes)
            // e.g. "../services/core/logger.service.mjs" -> "../services/core/logger.service.mjs"
            
            // If the original import was just `../services/core/logger.service.mjs`, we want to inject the `newDir`
            // Let's just safely assume any path ending in the filename gets the newDir prepended to the filename
            const newRelPath = relPath.endsWith('services/') 
              ? `${relPath}${newDir}/` 
              : `${relPath}services/${newDir}/`;
              
            // A more robust replacement: just replace the filename with newDir/filename
            // Assuming the old path correctly pointed to the services folder
            return `${quote1}${relPath.endsWith('services/') ? relPath : relPath + 'services/'}${newDir}/${file}${quote2}`.replace(/services\/services\//g, 'services/');
          }
        });
        
        // Simpler global replace for anything that looks like "*/services/file" -> "*/services/newDir/file"
        const simpleRegex = new RegExp(`(['"\`])(.*?\\/?)services\\/${file.replace('.', '\\.')}(['"\`])`, 'g');
        content = content.replace(simpleRegex, (match, q1, pre, q2) => {
           modified = true;
           return `${q1}${pre}services/${newDir}/${file}${q2}`;
        });
        
        // Handle sibling imports within the old services folder: "./services/core/logger.service.mjs"
        if (isInsideServices) {
           const currentFileDir = fileMapping[path.basename(fullPath)];
           const siblingRegex = new RegExp(`(['"\`])\\.\\/${file.replace('.', '\\.')}(['"\`])`, 'g');
           content = content.replace(siblingRegex, (match, q1, q2) => {
              modified = true;
              if (currentFileDir) {
                 return `${q1}../${newDir}/${file}${q2}`;
              } else {
                 return `${q1}./${newDir}/${file}${q2}`;
              }
           });
           
           // Also handle when it was already modified to something weird
        }
      });

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated imports in: ${relativeToSrc}`);
      }
    }
  }
}

console.log("Updating imports...");
updateImportsInDir(projectRoot);
console.log("Done!");
