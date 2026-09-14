const fs = require('fs');
let content = fs.readFileSync('./src/components/AuthModal.tsx', 'utf8');

// 4. 邀请码内不要提示语
// We just need to remove the paragraph text below the invite code input.
const regex = /<p className="text-\[10px\] text-slate-500">\s*每个邀请码仅限注册一次，注册后即失效。没有邀请码可找管理员要或点击右上方在线购买。\s*<\/p>/g;
content = content.replace(regex, '');

fs.writeFileSync('./src/components/AuthModal.tsx', content, 'utf8');
