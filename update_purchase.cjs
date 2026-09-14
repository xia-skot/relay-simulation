const fs = require('fs');

let content = fs.readFileSync('./src/components/PurchaseModal.tsx', 'utf8');

// Theming replacements for purchase modal
content = content.replace('bg-black/80', 'bg-slate-900/40');
content = content.replace('bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl relative overflow-hidden', 'bg-white border border-slate-200/60 rounded-3xl p-6 text-slate-900 shadow-2xl relative overflow-hidden');
content = content.replace('bg-slate-800/60 hover:bg-slate-800', 'bg-slate-100 hover:bg-slate-200');
content = content.replace('text-slate-400 hover:text-white', 'text-slate-500 hover:text-slate-700');
content = content.replace('bg-slate-950 p-1 rounded-2xl border border-slate-800/80', 'bg-slate-50 p-1 rounded-2xl border border-slate-200');
content = content.replace(/'text-slate-400 hover:text-slate-200'/g, "'text-slate-500 hover:text-slate-700'");
content = content.replace('bg-slate-950/60 border border-slate-800/80', 'bg-slate-50/50 border border-slate-100');
content = content.replace('bg-white rounded-2xl p-2.5 shadow-inner', 'bg-white rounded-2xl p-2.5 shadow-sm border border-slate-200');
content = content.replace(/text-slate-300/g, 'text-slate-700');
content = content.replace(/text-slate-400/g, 'text-slate-500');

// Payment buttons logic check
// For the unselected state it uses text-slate-400. That was handled above.

// Success step
content = content.replace('bg-emerald-500/20 text-emerald-400', 'bg-emerald-100 text-emerald-600');
content = content.replace('bg-slate-950 border border-blue-500/40', 'bg-blue-50 border border-blue-200');
content = content.replace('bg-slate-800 hover:bg-slate-700 text-xs text-slate-200', 'bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700');
content = content.replace('text-blue-300', 'text-blue-600');

fs.writeFileSync('./src/components/PurchaseModal.tsx', content, 'utf8');
