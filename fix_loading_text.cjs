const fs = require('fs');
let content = fs.readFileSync('./src/components/PurchaseModal.tsx', 'utf8');

// If it's loading because it's checking order (hasAttemptedPayment is false), it should say '正在查询订单...'? 
// No, the requirement is "用户第一次点击完成支付，页面弹出“订单查询中...”".
// Which is handled by `errorMsg`. But the button itself will also change text to "正在确认收款并签发邀请码...".
// We can change the button text to just say "处理中..." or check the state.
content = content.replace("'正在确认收款并签发邀请码...'", "!hasAttemptedPayment ? '正在查询...' : '正在确认收款并签发邀请码...'");

fs.writeFileSync('./src/components/PurchaseModal.tsx', content, 'utf8');
