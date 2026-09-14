const fs = require('fs');

let content = fs.readFileSync('./src/components/AuthModal.tsx', 'utf8');

// Import Logo
content = content.replace("import { \n  Mail,", "import Logo from './Logo';\nimport { \n  Mail,");

// Replace the Zap icon block
const oldIconBlock = `<div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/20 mb-3">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
              <Zap className="w-7 h-7 text-blue-400" />
            </div>
          </div>`;
          
const newIconBlock = `<div className="w-14 h-14 flex items-center justify-center mb-3">
            <Logo className="w-16 h-16 drop-shadow-md" />
          </div>`;
          
content = content.replace(oldIconBlock, newIconBlock);

fs.writeFileSync('./src/components/AuthModal.tsx', content, 'utf8');
