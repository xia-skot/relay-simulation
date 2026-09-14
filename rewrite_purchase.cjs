const fs = require('fs');

let content = fs.readFileSync('./src/components/PurchaseModal.tsx', 'utf8');

content = content.replace('特惠单次授权：', '单次邀请码价格：');
content = content.replace('/ 一次性有效', '/ 注册后失效');
content = content.replace('我已完成支付，立即获取邀请码', '我已完成支付');
content = content.replace('text-xl font-bold text-white tracking-tight', 'text-xl font-bold text-slate-900 tracking-tight');
content = content.replace('text-xl font-bold text-white', 'text-xl font-bold text-slate-900');

// We need to implement the mechanism where it delays for 1s, then shows an error message.
// Let's modify the handleConfirmPay function. First, search for it.

const functionMatch = content.match(/const handleConfirmPay = async \(\) => {[\s\S]*?(?=return \()/);
if (functionMatch) {
  let oldFunc = functionMatch[0];
  let newFunc = `const [hasAttemptedPayment, setHasAttemptedPayment] = useState(false);

  const handleConfirmPay = async () => {
    if (!hasAttemptedPayment) {
      setLoading(true);
      setErrorMsg('订单查询中...');
      
      setTimeout(() => {
        setLoading(false);
        setErrorMsg('请先完成支付或5s后重试');
        setHasAttemptedPayment(true);
      }, 1000);
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      // Simulate API call for issuing a code after successful payment verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newCode = 'RP-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-88';
      setIssuedCode(newCode);
      onSuccess(newCode);
    } catch (err) {
      setErrorMsg('网络超时，请重试');
    } finally {
      setLoading(false);
    }
  };

  // Rest of the imports/hooks are up above... Let's just replace the function block.
  `;
  content = content.replace(functionMatch[0], newFunc);
}

fs.writeFileSync('./src/components/PurchaseModal.tsx', content, 'utf8');
