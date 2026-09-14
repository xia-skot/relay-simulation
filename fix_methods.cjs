const fs = require('fs');

let content = fs.readFileSync('./src/components/PurchaseModal.tsx', 'utf8');

// The rewrite regex removed `handleCopy`. Let's re-add it.
const missingMethods = `
  const handleCopy = () => {
    if (!issuedCode) return;
    navigator.clipboard.writeText(issuedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
`;

content = content.replace("// Rest of the imports/hooks are up above... Let's just replace the function block.", missingMethods);

// Also remove setHasAttemptedPayment state reset on open so it gets reset properly.
const openEffect = `useEffect(() => {
    if (isOpen) {
      setIssuedCode('');
      setErrorMsg('');
      setHasAttemptedPayment(false);
      apiGetPaymentConfig().then(res => {
        if (res.success && res.config) {
          setConfig(res.config);
        }
      });
    }
  }, [isOpen]);`;
  
content = content.replace(/useEffect\(\(\) => \{\s*if \(isOpen\) \{\s*setIssuedCode\(''\);\s*setErrorMsg\(''\);\s*apiGetPaymentConfig\(\)\.then\(res => \{\s*if \(res\.success && res\.config\) \{\s*setConfig\(res\.config\);\s*\}\s*\}\);\s*\}\s*\}, \[isOpen\]\);/, openEffect);

fs.writeFileSync('./src/components/PurchaseModal.tsx', content, 'utf8');
