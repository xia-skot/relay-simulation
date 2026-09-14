const fs = require('fs');
let content = fs.readFileSync('./src/components/PurchaseModal.tsx', 'utf8');

// The replacement above left the old div because of the regex. Let's fix it by exact replace.
const oldBlock = `{errorMsg && (
              <div className={\`mb-4 p-2.5 rounded-xl border text-xs text-center \${errorMsg === '订单查询中...' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-red-50 border-red-200 text-red-600'}\`}>
                {errorMsg}
              </div>
            )}
            {/* old error block commented out below */}
              <div className="mb-4 p-2.5 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs text-center">
                {errorMsg}
              </div>
            )}`;

const newBlock = `{errorMsg && (
              <div className={\`mb-4 p-2.5 rounded-xl border text-xs text-center \${errorMsg === '订单查询中...' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-red-50 border-red-200 text-red-600'}\`}>
                {errorMsg}
              </div>
            )}`;

content = content.replace(oldBlock, newBlock);

fs.writeFileSync('./src/components/PurchaseModal.tsx', content, 'utf8');
