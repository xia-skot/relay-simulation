const fs = require('fs');
let content = fs.readFileSync('./src/components/PurchaseModal.tsx', 'utf8');

content = content.replace(/text-emerald-400/g, 'text-emerald-600');

fs.writeFileSync('./src/components/PurchaseModal.tsx', content, 'utf8');
