const fs = require('fs');

let content = fs.readFileSync('./src/components/AuthModal.tsx', 'utf8');

// Theming replacements
content = content.replace('bg-slate-900 text-slate-100', 'bg-slate-50 text-slate-900');
content = content.replace('bg-blue-600/30', 'bg-blue-400/20');
content = content.replace('bg-cyan-500/20', 'bg-cyan-400/20');
content = content.replace(/#1e293b/g, '#e2e8f0');
content = content.replace('opacity-30', 'opacity-60');

content = content.replace('bg-slate-950/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10', 'bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 shadow-2xl relative z-10');

// Logo
content = content.replace('bg-slate-950 rounded-[14px]', 'bg-white rounded-[14px]');

// Header text
content = content.replace('text-2xl font-black tracking-tight text-white flex items-center gap-2', 'text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2');
content = content.replace('text-xs text-slate-400 mt-1', 'text-xs text-slate-500 mt-1');

// Tab switcher
content = content.replace('bg-slate-900/90 p-1 rounded-xl border border-slate-800', 'bg-slate-100/90 p-1 rounded-xl border border-slate-200');
content = content.replace(/'text-slate-400 hover:text-slate-200'/g, "'text-slate-500 hover:text-slate-700'");

// Label text
content = content.replace(/text-slate-300/g, 'text-slate-700');
// Label icons
// Let's just do a blanket replace for input backgrounds and text
content = content.replace(/bg-slate-900\/90 border border-slate-800/g, 'bg-slate-50 border border-slate-200');
content = content.replace(/text-white placeholder:text-slate-600/g, 'text-slate-900 placeholder:text-slate-400');

// Quick Demo buttons
content = content.replace(/bg-blue-950\/40 hover:bg-blue-900\/60 border border-dashed border-blue-600\/50 rounded-xl text-blue-300 hover:text-white/g, 'bg-blue-50 hover:bg-blue-100 border border-dashed border-blue-200 rounded-xl text-blue-700 hover:text-blue-800');
content = content.replace(/bg-slate-900 hover:bg-slate-800\/80 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-slate-200/g, 'bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-300 rounded-xl text-slate-600 hover:text-slate-800');

// Send code button
content = content.replace(/bg-slate-800 hover:bg-slate-700 text-slate-300/g, 'bg-slate-200 hover:bg-slate-300 text-slate-700');

// Return to login buttons
content = content.replace(/text-slate-400 hover:text-slate-200/g, 'text-slate-500 hover:text-slate-700');

// Eye button icon styling
content = content.replace(/text-slate-500 hover:text-slate-300/g, 'text-slate-400 hover:text-slate-600');

// Remove the footer block
const startFooter = '{/* Footer info & 163 Guide Toggle */}';
const footerIndex = content.indexOf(startFooter);
if (footerIndex !== -1) {
    const endFooterRegex = /<\/div>\s*<\/motion\.div>/;
    const endMatch = content.match(endFooterRegex);
    if (endMatch) {
        // Just extract the part up to the footer, and then append the closing tags
        const beforeFooter = content.substring(0, footerIndex);
        const afterFooter = endMatch[0]; // "</div>\n      </motion.div>"
        
        // Wait, where is the end? Let's check exactly.
        content = beforeFooter + afterFooter + '\n\n      {/* Purchase Invite Code Modal */}\n      <PurchaseModal\n        isOpen={showPurchaseModal}\n        onClose={() => setShowPurchaseModal(false)}\n        onSuccess={(code) => {\n          setInviteCode(code);\n          setShowPurchaseModal(false);\n          setSuccessMsg(`已自动填入专属邀请码：${code}`);\n        }}\n      />\n    </div>\n  );\n}\n';
    }
}

fs.writeFileSync('./src/components/AuthModal.tsx', content, 'utf8');
console.log("Rewritten");
