const fs = require('fs');
let content = fs.readFileSync('./src/components/PurchaseModal.tsx', 'utf8');

// Also update the error block to be neutral/alert color when appropriate? 
// The user asked for "订单查询中..." to appear for 1s. Then "请先完成支付或5s后重试". 
// A red block for "订单查询中..." is weird. Let's make it yellow if it's "订单查询中...", red otherwise.

content = content.replace(
  '{errorMsg && (',
  `{errorMsg && (
              <div className={\`mb-4 p-2.5 rounded-xl border text-xs text-center \${errorMsg === '订单查询中...' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-red-50 border-red-200 text-red-600'}\`}>
                {errorMsg}
              </div>
            )}
            {/* old error block commented out below */}`
);

// Remove the old error block which is right after
content = content.replace(/\{errorMsg && \(\s*<div className="mb-4 p-2.5 rounded-xl bg-red-950\/50 border border-red-800 text-red-300 text-xs text-center">\s*\{errorMsg\}\s*<\/div>\s*\)\}\s*\/\* old error block commented out below \*\//g, '');

fs.writeFileSync('./src/components/PurchaseModal.tsx', content, 'utf8');
