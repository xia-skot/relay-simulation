const fs = require('fs');
let content = fs.readFileSync('./src/components/AuthModal.tsx', 'utf8');

// 1. "学员姓名 / 昵称" -> "姓名", 框内不要提示
content = content.replace('学员姓名 / 昵称', '姓名');
content = content.replace('placeholder="例如：张同学"', 'placeholder=""');

// 2. 注册邮箱提示语去掉“真实”
content = content.replace('接收验证码的真实邮箱', '接收验证码的邮箱');

// 3. 邀请码内不要提示语
content = content.replace('placeholder="例如：RP-INIT-2026（可在线购买或向管理员获取）"', 'placeholder=""');

// 4. 设置密码也要小眼睛 (this one got missed in the script before due to regex mismatch on the placeholder, let's fix it manually)
const targetPasswordBlock = `
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="设置登录密码"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"
              />`;

const replacementPasswordBlock = `
              <div className="relative">
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
              </div>`;

content = content.replace(targetPasswordBlock.trim(), replacementPasswordBlock.trim());

// Also catch the "请输入密码" one if the placeholder was changed
const targetPasswordBlock2 = `
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"
              />`;

const replacementPasswordBlock2 = `
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>`;

content = content.replace(targetPasswordBlock2.trim(), replacementPasswordBlock2.trim());


fs.writeFileSync('./src/components/AuthModal.tsx', content, 'utf8');
