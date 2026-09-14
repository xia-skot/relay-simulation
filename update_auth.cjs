const fs = require('fs');

let content = fs.readFileSync('./src/components/AuthModal.tsx', 'utf8');

// 1. Change title
content = content.replace('继电保护仿真平台', '继电保护可视化交互演示平台');

// 2. Change success alert from dark to light
content = content.replace('bg-slate-900 border border-blue-500/40 text-blue-200', 'bg-blue-50 border border-blue-200 text-blue-700');
content = content.replace('text-blue-400 mt-0.5', 'text-blue-500 mt-0.5');

// 3. Change Get Verification Code button color
content = content.replace(/bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-blue-400 font-medium text-xs rounded-xl border border-slate-700/g, 'bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium text-xs rounded-xl border border-slate-900');
content = content.replace(/bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-400 font-medium text-xs rounded-xl border border-slate-700/g, 'bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium text-xs rounded-xl border border-slate-900');

fs.writeFileSync('./src/components/AuthModal.tsx', content, 'utf8');
