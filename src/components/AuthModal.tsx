import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Shield, 
  Sparkles,
  Zap,
  SendHorizontal,
  Clock,
  Key,
  CreditCard,
  ShoppingBag
} from 'lucide-react';
import { AuthMode, UserAccount } from '../types/auth';
import { apiSendCode, apiRegister, apiLogin, apiResetPassword } from '../lib/authStore';
import PurchaseModal from './PurchaseModal';

interface AuthModalProps {
  onSuccess: (user: UserAccount) => void;
}

export default function AuthModal({ onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  
  // Verification code countdown
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  // Status states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Trigger Send Email Code
  const handleSendCode = async () => {
    if (countdown > 0 || sendingCode) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('请先输入接收验证码的邮箱');
      return;
    }

    if (!validateEmail(email)) {
      setErrorMsg('请输入正确的邮箱格式');
      return;
    }

    setSendingCode(true);
    const res = await apiSendCode(email);
    setSendingCode(false);

    if (res.success) {
      setCountdown(60);
      setSuccessMsg(res.message || '验证码已发送至邮箱，请查收');
      // If server returned devCode for quick preview/fallback
      if (res.devCode) {
        setCode(res.devCode);
      }
    } else {
      setErrorMsg(res.message || '发送验证码失败');
      if (res.devCode) {
        setCode(res.devCode);
      }
    }
  };

  // Submit Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('请输入邮箱和登录密码');
      return;
    }

    if (!validateEmail(email)) {
      setErrorMsg('请输入合法的邮箱格式（如 user@example.com）');
      return;
    }

    setLoading(true);
    const res = await apiLogin(email, password);
    setLoading(false);

    if (res.success && res.user) {
      onSuccess(res.user);
    } else {
      setErrorMsg(res.message || '登录验证失败');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim() || !code.trim()) {
      setErrorMsg('请填写完整的邮箱、密码及邮箱验证码');
      return;
    }

    if (!inviteCode.trim()) {
      setErrorMsg('请输入注册专属邀请码（可在线购买或向管理员申请）');
      return;
    }

    if (!validateEmail(email)) {
      setErrorMsg('请输入合法的邮箱格式');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('密码长度不能少于6位');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致，请重新检查');
      return;
    }

    setLoading(true);
    const res = await apiRegister({
      email,
      password,
      code,
      inviteCode: inviteCode.trim(),
      name: name.trim() || email.split('@')[0]
    });
    setLoading(false);

    if (res.success && res.user) {
      setSuccessMsg('注册成功！正在为您进入平台...');
      setTimeout(() => {
        onSuccess(res.user!);
      }, 800);
    } else {
      setErrorMsg(res.message || '注册失败');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim() || !code.trim()) {
      setErrorMsg('请完整填写邮箱、验证码与新密码');
      return;
    }

    if (!validateEmail(email)) {
      setErrorMsg('请输入合法的邮箱格式');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('新密码长度不能少于6位');
      return;
    }

    setLoading(true);
    const res = await apiResetPassword({
      email,
      newPassword: password,
      code
    });
    setLoading(false);

    if (res.success) {
      setSuccessMsg('密码重置成功！请使用新密码登录');
      setTimeout(() => {
        switchMode('login');
      }, 1000);
    } else {
      setErrorMsg(res.message || '重置失败');
    }
  };

  return (
    <div className="w-screen h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60" />
      </div>

      {/* Auth Card Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 flex items-center justify-center mb-3">
            <Logo className="w-16 h-16 drop-shadow-md" />
          </div>
          
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            继电保护可视化交互演示平台
          </h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200 mb-5 text-sm">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
              mode === 'login' 
                ? 'bg-blue-600 text-white shadow' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            邮箱登录
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
              mode === 'register' 
                ? 'bg-blue-600 text-white shadow' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            邮箱注册
          </button>
        </div>

        {/* Alerts */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5 leading-relaxed"
            >
              <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
              <span className="break-words">{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs flex items-start gap-2.5 leading-relaxed"
            >
              <CheckCircle2 size={16} className="shrink-0 text-blue-500 mt-0.5" />
              <span className="break-words">{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                电子邮箱
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock size={14} className="text-slate-400" />
                  登录密码
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot_password')}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  忘记密码？
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入登录密码"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {loading ? '正在验证登录...' : '登 录 平 台'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* 2. REGISTER FORM WITH VERIFICATION CODE & INVITE CODE */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User size={14} className="text-slate-400" />
                姓名
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=""
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                注册邮箱
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="接收验证码的邮箱"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* Verification Code Row */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Shield size={14} className="text-slate-400" />
                邮箱验证码
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  placeholder="6位数字验证码"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-mono tracking-wider focus:outline-none focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || sendingCode}
                  className="shrink-0 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium text-xs rounded-xl border border-slate-900 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {sendingCode ? (
                    '发送中...'
                  ) : countdown > 0 ? (
                    <>
                      <Clock size={13} />
                      <span>{countdown}s 后重发</span>
                    </>
                  ) : (
                    <>
                      <SendHorizontal size={13} />
                      <span>获取验证码</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Invite Code Row (Required) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Key size={14} className="text-amber-400" />
                  <span>注册专属邀请码</span>
                  <span className="text-red-400 font-bold">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                >
                  <ShoppingBag size={13} />
                  <span>在线购买邀请码</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder=""
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-mono focus:outline-none focus:border-amber-500 transition-all"
              />
              
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400" />
                设置密码 (≥6位)
              </label>
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
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400" />
                确认密码
              </label>
              <div className="relative">
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
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {loading ? '正在验证注册...' : '注 册 并 进 入'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD WITH CODE */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-3.5">
            <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold pb-1 border-b border-slate-800">
              <KeyRound size={16} className="text-amber-400" />
              <span>验证码找回密码</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                绑定的邮箱
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入注册邮箱"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* Code Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Shield size={14} className="text-slate-400" />
                邮箱验证码
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  placeholder="6位验证码"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-mono tracking-wider focus:outline-none focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || sendingCode}
                  className="shrink-0 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium text-xs rounded-xl border border-slate-900 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {sendingCode ? (
                    '发送中...'
                  ) : countdown > 0 ? (
                    <>
                      <Clock size={13} />
                      <span>{countdown}s 后重发</span>
                    </>
                  ) : (
                    <>
                      <SendHorizontal size={13} />
                      <span>获取验证码</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400" />
                设置新密码 (≥6位)
              </label>
              <div className="relative">
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
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {loading ? '正在更新密码...' : '重 置 密 码'}
              <ArrowRight size={16} />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                想起密码了？返回登录
              </button>
            </div>
          </form>
        )}

      </motion.div>

      {/* Purchase Invite Code Modal */}
      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={(code) => {
          setInviteCode(code);
          setShowPurchaseModal(false);
        }}
      />
    </div>
  );
}
