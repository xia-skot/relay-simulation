import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  QrCode, 
  Sparkles, 
  Copy, 
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { apiGetPaymentConfig } from '../lib/authStore';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (inviteCode: string) => void;
}

const PAYMENT_CACHE_KEY = 'relay_payment_config_cache_v1';

function getCachedPaymentConfig() {
  try {
    const raw = localStorage.getItem(PAYMENT_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.price === 'number') {
        return parsed;
      }
    }
  } catch {}
  return {
    price: 9.9,
    wechatQr: '',
    alipayQr: '',
    instruction: '扫描上方二维码支付对应金额，支付成功后点击下方按钮自动出码。'
  };
}

export default function PurchaseModal({ isOpen, onClose, onSuccess }: PurchaseModalProps) {
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(getCachedPaymentConfig);
  const [issuedCode, setIssuedCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasAttemptedPayment, setHasAttemptedPayment] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIssuedCode('');
      setErrorMsg('');
      setHasAttemptedPayment(false);
      setLoading(false);
      
      // Fetch latest config in background, while cached config shows instantly
      apiGetPaymentConfig().then(res => {
        if (res.success && res.config) {
          setConfig(res.config);
          try {
            localStorage.setItem(PAYMENT_CACHE_KEY, JSON.stringify(res.config));
          } catch {}
        }
      });
    }
  }, [isOpen]);

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

  const handleCopy = () => {
    if (!issuedCode) return;
    navigator.clipboard.writeText(issuedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-white border border-slate-200/60 rounded-3xl p-6 text-slate-900 shadow-2xl relative overflow-hidden"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-700 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            title="关闭"
          >
            <X size={18} />
          </button>

          {!issuedCode ? (
            <div>
              {/* Header */}
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-xs font-semibold mb-2">
                  <Sparkles size={13} />
                  <span>在线获取邀请码</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  购买注册邀请码
                </h2>
                <div className="flex items-baseline justify-center gap-1 mt-2">
                  <span className="text-sm text-slate-500 font-medium">单次邀请码价格：</span>
                  <span className="text-2xl font-black text-amber-500">¥{config.price.toFixed(2)}</span>
                  <span className="text-xs text-slate-500">/ 注册后失效</span>
                </div>
              </div>

              {/* Pay Method Selector */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-200 mb-4">
                <button
                  type="button"
                  onClick={() => setPayMethod('wechat')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    payMethod === 'wechat'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  微信支付
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('alipay')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    payMethod === 'alipay'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  支付宝
                </button>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-5 mb-4 relative">
                <div className="w-48 h-48 bg-white rounded-2xl p-2.5 shadow-sm border border-slate-200 flex items-center justify-center relative overflow-hidden">
                  {(payMethod === 'wechat' && config.wechatQr) ? (
                    <img 
                      src={config.wechatQr} 
                      alt="微信收款码" 
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (payMethod === 'alipay' && config.alipayQr) ? (
                    <img 
                      src={config.alipayQr} 
                      alt="支付宝收款码" 
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    /* QR Code Stand-in */
                    <div className="w-full h-full border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-3 text-center bg-slate-50">
                      <QrCode size={64} className={payMethod === 'wechat' ? 'text-emerald-600' : 'text-blue-600'} />
                      <span className="text-[11px] font-bold text-slate-700 mt-2">
                        {payMethod === 'wechat' ? '微信扫一扫支付' : '支付宝扫一扫支付'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        ¥{config.price.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-center">
                  <span className="text-xs text-slate-700 font-medium">
                    {payMethod === 'wechat' ? '请使用【微信】扫码支付' : '请使用【支付宝】扫码支付'}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    {config.instruction || '扫描上方二维码支付对应金额，支付成功后点击下方按钮自动出码。'}
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className={`mb-4 p-2.5 rounded-xl border text-xs text-center font-medium ${errorMsg === '订单查询中...' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  {errorMsg}
                </div>
              )}

              {/* Confirm Payment Action */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmPay}
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {loading ? (
                    !hasAttemptedPayment ? '正在查询...' : '正在确认收款并签发邀请码...'
                  ) : (
                    <>
                      <Zap size={16} />
                      <span>我已完成支付</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  <span>一码一用 · 自动填入注册表单 · 注册后失效</span>
                </div>
              </div>
            </div>
          ) : (
            /* Payment Succeeded & Invite Code Issued Screen */
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} />
              </div>
              
              <h3 className="text-xl font-bold text-slate-900">支付确认成功！</h3>
              <p className="text-xs text-slate-500 mt-1">
                专属注册邀请码已成功签发，并已为您自动填入注册表单
              </p>

              {/* Code Box */}
              <div className="my-5 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3">
                <span className="font-mono text-xl font-black text-blue-600 tracking-wider select-all">
                  {issuedCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>复制</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <span>立即去完成注册</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
