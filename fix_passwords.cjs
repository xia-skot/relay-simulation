const fs = require('fs');

let content = fs.readFileSync('./src/components/AuthModal.tsx', 'utf8');

// Add state
content = content.replace(
  'const [showPassword, setShowPassword] = useState(false);',
  'const [showPassword, setShowPassword] = useState(false);\n  const [showConfirmPassword, setShowConfirmPassword] = useState(false);'
);

// We need to replace the password fields in Register
// Search for:
// <input
//   type="password"
//   required
//   value={password}
//   onChange={(e) => setPassword(e.target.value)}
//   placeholder="设置登录密码"
//   className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"
// />
// Replace with the relative div with the button

content = content.replace(
  /<input\s+type="password"\s+required\s+value=\{password\}\s+onChange=\{\(e\) => setPassword\(e\.target\.value\)\}\s+placeholder="设置登录密码"\s+className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"\s+\/>/g,
  `<div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="设置登录密码"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>`
);

content = content.replace(
  /<input\s+type="password"\s+required\s+value=\{confirmPassword\}\s+onChange=\{\(e\) => setConfirmPassword\(e\.target\.value\)\}\s+placeholder="再次输入密码"\s+className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"\s+\/>/g,
  `<div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>`
);

// Forgot password
content = content.replace(
  /<input\s+type="password"\s+required\s+value=\{password\}\s+onChange=\{\(e\) => setPassword\(e\.target\.value\)\}\s+placeholder="输入新密码"\s+className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"\s+\/>/g,
  `<div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入新密码"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              </div>`
);

fs.writeFileSync('./src/components/AuthModal.tsx', content, 'utf8');
