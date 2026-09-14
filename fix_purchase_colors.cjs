const fs = require('fs');
let content = fs.readFileSync('./src/components/PurchaseModal.tsx', 'utf8');

// The alert colors at the top:
content = content.replace('text-blue-400 text-xs', 'text-blue-600 text-xs');
// The bold blue numbers (like the generated code text):
content = content.replace('text-blue-400 tracking-wider', 'text-blue-600 tracking-wider');

fs.writeFileSync('./src/components/PurchaseModal.tsx', content, 'utf8');
