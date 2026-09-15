import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Key,
  ShieldCheck,
  CreditCard,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  Search,
  RefreshCw,
  X,
  Upload,
  Image as ImageIcon,
  Check,
  Zap,
  Sparkles,
  QrCode,
  Calendar,
  Clock,
  ArrowRight,
  AlertTriangle,
  Database,
  Activity,
  Server,
  Info
} from 'lucide-react';
import {
  apiGetAdminUsers,
  apiGetAdmins,
  apiAddAdmin,
  apiRemoveAdmin,
  apiGetInviteCodes,
  apiGenerateInviteCodes,
  apiDeleteInviteCode,
  apiBatchDeleteInviteCodes,
  apiDeleteOrder,
  apiGetPaymentConfig,
  apiUpdatePaymentConfig,
  apiGetPaymentOrders
} from '../lib/authStore';
import { UserAccount, AdminAccount, InviteCode, PaymentConfig, PurchaseOrder } from '../types/auth';

interface AdminDashboardProps {
  onClose: () => void;
  currentEmail: string;
}

interface ConfirmModalState {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function AdminDashboard({ onClose, currentEmail }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'invite' | 'users' | 'admins' | 'payment'>('invite');
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [dbDiagnostics, setDbDiagnostics] = useState<any>(null);
  const [showDbModal, setShowDbModal] = useState(false);
  const [dbChecking, setDbChecking] = useState(false);

  // 1. Invite Codes State
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [genCount, setGenCount] = useState(1);
  const [genRemark, setGenRemark] = useState('');
  const [codeFilter, setCodeFilter] = useState<'all' | 'unused' | 'used'>('all');

  // 2. Users State
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // 3. Admins State
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // 4. Payment & Orders State
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    price: 9.9,
    wechatQr: '',
    alipayQr: '',
    instruction: '付款后点击【我已完成支付】即可自动出码。',
    autoIssue: true,
  });
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  // Show temporary toast feedback
  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Check database health and load diagnostics
  const checkDbHealth = async () => {
    setDbChecking(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setDbDiagnostics(data);
      if (data.mongo === 'connected') {
        setDbStatus('connected');
      } else {
        setDbStatus('disconnected');
      }
      return data;
    } catch (e: any) {
      setDbStatus('disconnected');
      setDbDiagnostics({ mongo: 'error', error: e.message });
      return null;
    } finally {
      setDbChecking(false);
    }
  };

  // Load data on mount or tab change
  const loadAllData = async () => {
    setLoading(true);
    setDbStatus('checking');
    try {
      // Check database connection health
      checkDbHealth();

      const [uRes, aRes, iRes, pRes, oRes] = await Promise.all([
        apiGetAdminUsers(),
        apiGetAdmins(),
        apiGetInviteCodes(),
        apiGetPaymentConfig(),
        apiGetPaymentOrders()
      ]);

      if (uRes.success && uRes.users) setUsers(uRes.users);
      if (aRes.success && aRes.admins) setAdmins(aRes.admins);
      if (iRes.success && iRes.inviteCodes) setInviteCodes(iRes.inviteCodes);
      if (pRes.success && pRes.config) setPaymentConfig(pRes.config);
      if (oRes.success && oRes.orders) setOrders(oRes.orders);
    } catch (err) {
      showNotice('获取数据异常', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // 1. Generate Invite Code Handler
  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await apiGenerateInviteCodes({
      count: genCount,
      remark: genRemark || '管理员手动生成',
      createdBy: currentEmail,
    });
    setLoading(false);

    if (res.success) {
      showNotice(res.message);
      setGenRemark('');
      // Reload codes
      const iRes = await apiGetInviteCodes();
      if (iRes.success && iRes.inviteCodes) setInviteCodes(iRes.inviteCodes);
    } else {
      showNotice(res.message, 'error');
    }
  };

  // Delete Invite Code (Safe in-app modal)
  const promptDeleteCode = (code: string) => {
    setConfirmModal({
      title: '删除并作废邀请码',
      description: `确定要永久删除邀请码【${code}】吗？删除后该邀请码将立即失效并从系统库中清除。`,
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        const res = await apiDeleteInviteCode(code);
        setLoading(false);
        if (res.success) {
          showNotice(`邀请码【${code}】已成功删除`);
          setInviteCodes(prev => prev.filter(c => c.code !== code));
          setOrders(prev => prev.map(o => o.inviteCode === code ? { ...o, inviteCodeStatus: 'deleted' } : o));
        } else {
          showNotice(res.message, 'error');
        }
      }
    });
  };

  // Batch delete all unused invite codes
  const promptBatchDeleteUnused = () => {
    const unusedCount = inviteCodes.filter(c => c.status === 'unused').length;
    if (unusedCount === 0) {
      showNotice('当前没有未使用的邀请码', 'error');
      return;
    }
    setConfirmModal({
      title: '一键清空未使用邀请码',
      description: `确定要清空全部 ${unusedCount} 个未使用的邀请码吗？此操作将立即从数据库彻底清除这些邀请码（已被学员注册使用的邀请码不会受到任何影响）。`,
      confirmText: `确认清空 (${unusedCount}个)`,
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        const res = await apiBatchDeleteInviteCodes({ allUnused: true });
        setLoading(false);
        if (res.success) {
          showNotice(res.message);
          setInviteCodes(prev => prev.filter(c => c.status !== 'unused'));
          setOrders(prev => prev.map(o => ({ ...o, inviteCodeStatus: 'deleted' })));
        } else {
          showNotice(res.message, 'error');
        }
      }
    });
  };

  // Delete an individual purchase order
  const promptDeleteOrder = (orderId: string, inviteCode: string) => {
    setConfirmModal({
      title: '删除流水订单',
      description: `确定要删除订单【${orderId}】流水记录吗？如果对应的邀请码【${inviteCode}】尚未被使用，也将同步将其作废删除。`,
      confirmText: '确认删除订单',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        const res = await apiDeleteOrder(orderId);
        setLoading(false);
        if (res.success) {
          showNotice('订单及对应未使用邀请码已删除');
          setOrders(prev => prev.filter(o => o.orderId !== orderId));
          setInviteCodes(prev => prev.filter(c => !(c.code === inviteCode && c.status === 'unused')));
        } else {
          showNotice(res.message, 'error');
        }
      }
    });
  };

  // 2. Add Admin Handler
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    setLoading(true);
    const res = await apiAddAdmin(newAdminEmail.trim());
    setLoading(false);

    if (res.success) {
      showNotice(res.message);
      setNewAdminEmail('');
      const aRes = await apiGetAdmins();
      if (aRes.success && aRes.admins) setAdmins(aRes.admins);
      // Reload users to update role tags
      const uRes = await apiGetAdminUsers();
      if (uRes.success && uRes.users) setUsers(uRes.users);
    } else {
      showNotice(res.message, 'error');
    }
  };

  // Remove Admin Handler (Safe in-app modal)
  const promptRemoveAdmin = (email: string) => {
    if (email.toLowerCase() === 'skot_catan@163.com') {
      showNotice('超级管理员不可移除', 'error');
      return;
    }
    setConfirmModal({
      title: '移除管理员权限',
      description: `确定移除管理员【${email}】的后台管理权限吗？移除后该账号将降级为普通学员。`,
      confirmText: '确认移除',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        const res = await apiRemoveAdmin(email);
        setLoading(false);
        if (res.success) {
          showNotice('已移除管理员权限');
          setAdmins(prev => prev.filter(a => a.email.toLowerCase() !== email.toLowerCase()));
          const uRes = await apiGetAdminUsers();
          if (uRes.success && uRes.users) setUsers(uRes.users);
        } else {
          showNotice(res.message, 'error');
        }
      }
    });
  };

  // 3. Save Payment Config Handler
  const handleSavePaymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await apiUpdatePaymentConfig(paymentConfig);
    setLoading(false);
    if (res.success) {
      showNotice('收款设置保存成功！前端购买弹窗已实时同步生效');
    } else {
      showNotice(res.message, 'error');
    }
  };

  // Image Upload helper (converts to Base64 data URL)
  const handleImageUpload = (field: 'wechatQr' | 'alipayQr', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showNotice('图片大小请小于 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPaymentConfig(prev => ({ ...prev, [field]: dataUrl }));
      showNotice(`${field === 'wechatQr' ? '微信' : '支付宝'}收款码已就绪，记得点击下方保存按钮生效！`);
    };
    reader.readAsDataURL(file);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  // Filtered Invite Codes
  const filteredCodes = inviteCodes.filter(c => {
    if (codeFilter === 'unused') return c.status === 'unused';
    if (codeFilter === 'used') return c.status === 'used';
    return true;
  });

  // Filtered Users
  const filteredUsers = users.filter(u => {
    const s = userSearch.toLowerCase();
    return u.email.toLowerCase().includes(s) || (u.name && u.name.toLowerCase().includes(s));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md font-sans">
      <div className="w-full max-w-5xl h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Top Navigation Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  系统管理控制台
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-semibold">
                  管理员专属
                </span>
                {dbStatus === 'connected' ? (
                  <button
                    type="button"
                    onClick={() => { checkDbHealth(); setShowDbModal(true); }}
                    className="px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 border border-emerald-500/30 transition-all cursor-pointer group"
                    title="点击查看数据库连接自检详情"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>数据库已连接</span>
                    {dbDiagnostics?.latencyMs !== undefined && (
                      <span className="text-[10px] text-emerald-400/80 font-mono">({dbDiagnostics.latencyMs}ms)</span>
                    )}
                    <Info size={11} className="text-emerald-400/70 group-hover:text-emerald-300" />
                  </button>
                ) : dbStatus === 'disconnected' ? (
                  <button
                    type="button"
                    onClick={() => { checkDbHealth(); setShowDbModal(true); }}
                    className="px-2.5 py-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-300 text-[11px] font-semibold flex items-center gap-1.5 border border-red-500/30 transition-all cursor-pointer group"
                    title="点击查看异常自检详情"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                    <span>数据库未连接</span>
                    <Info size={11} className="text-red-400/70 group-hover:text-red-300" />
                  </button>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 border border-slate-700 animate-pulse">
                    <RefreshCw size={10} className="animate-spin text-blue-400" /> 数据库自检中
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                当前登录：<span className="text-slate-200 font-mono">{currentEmail}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAllData}
              disabled={loading}
              title="刷新数据"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-300 transition-colors cursor-pointer"
              title="退出管理后台"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Toast Feedback */}
        {feedback && (
          <div className={`px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2 transition-all ${
            feedback.type === 'success' 
              ? 'bg-emerald-950 text-emerald-300 border-b border-emerald-800' 
              : 'bg-red-950 text-red-300 border-b border-red-800'
          }`}>
            <CheckCircle2 size={14} />
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-6 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('invite')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'invite'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key size={15} />
            <span>邀请码管理</span>
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px] text-slate-300">
              {inviteCodes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={15} />
            <span>注册账户信息</span>
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px] text-slate-300">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('admins')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'admins'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={15} />
            <span>管理员账号设置</span>
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-full text-[10px] text-slate-300">
              {admins.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payment')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'payment'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard size={15} />
            <span>收款设置与购买流水</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* ================= TAB 1: INVITE CODES ================= */}
          {activeTab === 'invite' && (
            <div className="space-y-6">
              
              {/* Manual Generator Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400" />
                    <span>手动批量生成注册邀请码</span>
                  </h3>
                  <span className="text-xs text-slate-400">一个邀请码仅限注册一次，注册后系统自动作废</span>
                </div>

                <form onSubmit={handleGenerateCodes} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs text-slate-400 font-medium">生成数量 (1~50)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={genCount}
                      onChange={(e) => setGenCount(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <label className="text-xs text-slate-400 font-medium">用途备注说明</label>
                    <input
                      type="text"
                      placeholder="例如：电气一班教学专享 / 学员小李"
                      value={genRemark}
                      onChange={(e) => setGenRemark(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>{loading ? '正在生成...' : '立即生成邀请码'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Codes Table Header & Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">状态筛选：</span>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setCodeFilter('all')}
                      className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                        codeFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      全部 ({inviteCodes.length})
                    </button>
                    <button
                      onClick={() => setCodeFilter('unused')}
                      className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                        codeFilter === 'unused' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      未使用 ({inviteCodes.filter(c => c.status === 'unused').length})
                    </button>
                    <button
                      onClick={() => setCodeFilter('used')}
                      className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                        codeFilter === 'used' ? 'bg-slate-800 text-slate-300 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      已失效/已使用 ({inviteCodes.filter(c => c.status === 'used').length})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {inviteCodes.filter(c => c.status === 'unused').length > 0 && (
                    <button
                      type="button"
                      onClick={promptBatchDeleteUnused}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title="快速清空所有未使用的邀请码"
                    >
                      <Trash2 size={13} />
                      <span>一键清空未使用码 ({inviteCodes.filter(c => c.status === 'unused').length})</span>
                    </button>
                  )}
                  <div className="text-xs text-slate-500">
                    共找到 {filteredCodes.length} 条记录
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                        <th className="py-3 px-4 font-semibold">邀请码</th>
                        <th className="py-3 px-4 font-semibold">来源类型</th>
                        <th className="py-3 px-4 font-semibold">状态</th>
                        <th className="py-3 px-4 font-semibold">使用学员邮箱</th>
                        <th className="py-3 px-4 font-semibold">备注说明</th>
                        <th className="py-3 px-4 font-semibold">创建时间</th>
                        <th className="py-3 px-4 font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredCodes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-500">
                            暂无邀请码记录，请点击上方按钮生成！
                          </td>
                        </tr>
                      ) : (
                        filteredCodes.map((item) => (
                          <tr key={item.id || item.code} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-blue-400 flex items-center gap-2">
                              <span>{item.code}</span>
                              <button
                                onClick={() => copyCode(item.code)}
                                title="复制邀请码"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                              >
                                {copiedCode === item.code ? (
                                  <Check size={12} className="text-emerald-400" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {item.type === 'purchased' ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                                  在线购买
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                                  管理员手动
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {item.status === 'unused' ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                                  有效 · 未使用
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                                  已使用 · 已失效
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300 font-mono">
                              {item.usedBy ? (
                                <span className="text-white font-medium">{item.usedBy}</span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                              {item.remark || '—'}
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => promptDeleteCode(item.code)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/50 transition-colors cursor-pointer"
                                title="删除并作废该码"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 2: REGISTERED USERS ================= */}
          {activeTab === 'users' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="按邮箱或姓名搜索用户..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="text-xs text-slate-400">
                  总注册学员数：<span className="font-bold text-blue-400">{users.length}</span> 人
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                        <th className="py-3 px-4 font-semibold">学员邮箱</th>
                        <th className="py-3 px-4 font-semibold">学员姓名/昵称</th>
                        <th className="py-3 px-4 font-semibold">账户权限</th>
                        <th className="py-3 px-4 font-semibold">注册所用邀请码</th>
                        <th className="py-3 px-4 font-semibold">注册时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-500">
                            未匹配到用户账号
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u, idx) => (
                          <tr key={u.email || idx} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-white">
                              {u.email}
                              {u.email.toLowerCase() === 'skot_catan@163.com' && (
                                <span className="ml-2 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                                  超级管理员
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {u.name || '—'}
                            </td>
                            <td className="py-3 px-4">
                              {u.role === 'admin' ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                                  管理员
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                                  学员
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {u.inviteCodeUsed ? (
                                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400 text-[11px]">
                                  {u.inviteCodeUsed}
                                </span>
                              ) : (
                                <span className="text-slate-600">系统直通</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                              {u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: ADMIN ACCOUNTS ================= */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              
              {/* Add Admin Form */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-400" />
                  <span>新增管理员邮箱账号</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  管理员拥有管理控制台访问权限，可手动生成邀请码、新增其他管理员、修改收款配置及查看所有用户账号。
                </p>

                <form onSubmit={handleAddAdmin} className="flex gap-3 max-w-lg">
                  <input
                    type="email"
                    required
                    placeholder="输入要设为管理员的邮箱（例如 teacher@school.edu）"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus size={14} />
                    <span>添加为管理员</span>
                  </button>
                </form>
              </div>

              {/* Admin Accounts List */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300">当前活跃管理员列表</h4>
                  <span className="text-[11px] text-slate-500">skot_catan@163.com 为超级管理员</span>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {admins.map((admin) => {
                    const isSuper = admin.email.toLowerCase() === 'skot_catan@163.com';
                    return (
                      <div key={admin.email} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-900/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSuper ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {isSuper ? '超管' : '管理'}
                          </div>
                          <div>
                            <div className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                              <span>{admin.email}</span>
                              {isSuper && (
                                <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  超级管理员 (受保护)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              添加时间：{admin.addedAt ? new Date(admin.addedAt).toLocaleDateString() : '初始创建'}
                            </div>
                          </div>
                        </div>

                        <div>
                          {!isSuper && (
                            <button
                              onClick={() => promptRemoveAdmin(admin.email)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} />
                              <span>解除管理员</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 4: PAYMENT CONFIG & ORDERS ================= */}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              
              {/* Payment Settings Form */}
              <form onSubmit={handleSavePaymentConfig} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard size={16} className="text-emerald-400" />
                      <span>微信 / 支付宝收款配置</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      可直接上传您的微信/支付宝个人收钱码或赞赏码图片，保存后将在前端购买邀请码窗口即时显示。
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>保存收款配置</span>
                  </button>
                </div>

                {/* Price Setting */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      邀请码购买价格 (元)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentConfig.price}
                        onChange={(e) => setPaymentConfig(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-8 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      扫码付款提示文案
                    </label>
                    <input
                      type="text"
                      value={paymentConfig.instruction}
                      onChange={(e) => setPaymentConfig(prev => ({ ...prev, instruction: e.target.value }))}
                      placeholder="例如：付款时可留空备注，支付完成后点击下方【我已完成支付】即可自动出码"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* QR Codes Upload Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                  
                  {/* WeChat QR Card */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
                    <div className="w-full flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <QrCode size={15} />
                        微信收款码 (赞赏码/收钱码)
                      </span>
                      {paymentConfig.wechatQr && (
                        <button
                          type="button"
                          onClick={() => setPaymentConfig(prev => ({ ...prev, wechatQr: '' }))}
                          className="text-[11px] text-red-400 hover:underline cursor-pointer"
                        >
                          清除重传
                        </button>
                      )}
                    </div>

                    <div className="w-40 h-40 bg-white rounded-xl p-2 mb-3 flex items-center justify-center border border-slate-700 shadow-inner overflow-hidden">
                      {paymentConfig.wechatQr ? (
                        <img 
                          src={paymentConfig.wechatQr} 
                          alt="微信收款码" 
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 p-2 text-center">
                          <ImageIcon size={32} className="text-slate-300 mb-1" />
                          <span className="text-[10px]">未上传收款码</span>
                          <span className="text-[9px] text-slate-400">目前显示默认扫码图</span>
                        </div>
                      )}
                    </div>

                    <label className="w-full py-2 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 border border-emerald-600/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                      <Upload size={13} />
                      <span>上传微信收款图片</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload('wechatQr', e)}
                      />
                    </label>
                  </div>

                  {/* Alipay QR Card */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
                    <div className="w-full flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <QrCode size={15} />
                        支付宝收款码 (商家码/收钱码)
                      </span>
                      {paymentConfig.alipayQr && (
                        <button
                          type="button"
                          onClick={() => setPaymentConfig(prev => ({ ...prev, alipayQr: '' }))}
                          className="text-[11px] text-red-400 hover:underline cursor-pointer"
                        >
                          清除重传
                        </button>
                      )}
                    </div>

                    <div className="w-40 h-40 bg-white rounded-xl p-2 mb-3 flex items-center justify-center border border-slate-700 shadow-inner overflow-hidden">
                      {paymentConfig.alipayQr ? (
                        <img 
                          src={paymentConfig.alipayQr} 
                          alt="支付宝收款码" 
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 p-2 text-center">
                          <ImageIcon size={32} className="text-slate-300 mb-1" />
                          <span className="text-[10px]">未上传收款码</span>
                          <span className="text-[9px] text-slate-400">目前显示默认扫码图</span>
                        </div>
                      )}
                    </div>

                    <label className="w-full py-2 bg-blue-700/30 hover:bg-blue-700/50 text-blue-300 border border-blue-600/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                      <Upload size={13} />
                      <span>上传支付宝收款图片</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload('alipayQr', e)}
                      />
                    </label>
                  </div>

                </div>
              </form>

              {/* Purchase Orders Record */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">在线购买出码记录流水</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">学员在线扫码支付后系统自动签发的邀请码与订单明细</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {orders.some(o => {
                      const c = inviteCodes.find(item => item.code === o.inviteCode);
                      return c ? c.status === 'unused' : false;
                    }) && (
                      <button
                        type="button"
                        onClick={() => {
                          const unusedCodes = orders
                            .map(o => o.inviteCode)
                            .filter(code => {
                              const c = inviteCodes.find(item => item.code === code);
                              return c && c.status === 'unused';
                            });
                          setConfirmModal({
                            title: '作废所有未使用的购买码',
                            description: `确定要作废清空全部 ${unusedCodes.length} 个未被学员使用的在线购买邀请码吗？`,
                            confirmText: `确认作废 (${unusedCodes.length}个)`,
                            danger: true,
                            onConfirm: async () => {
                              setConfirmModal(null);
                              setLoading(true);
                              const res = await apiBatchDeleteInviteCodes({ codes: unusedCodes });
                              setLoading(false);
                              if (res.success) {
                                showNotice(res.message);
                                setInviteCodes(prev => prev.filter(c => !unusedCodes.includes(c.code)));
                                setOrders(prev => prev.map(o => unusedCodes.includes(o.inviteCode) ? { ...o, inviteCodeStatus: 'deleted' } : o));
                              } else {
                                showNotice(res.message, 'error');
                              }
                            }
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        title="快速作废所有未使用的购买邀请码"
                      >
                        <Trash2 size={13} />
                        <span>作废所有未使用购买码</span>
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400">累计出码 {orders.length} 笔</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                        <th className="py-2.5 px-4 font-semibold">订单号</th>
                        <th className="py-2.5 px-4 font-semibold">支付通道</th>
                        <th className="py-2.5 px-4 font-semibold">金额</th>
                        <th className="py-2.5 px-4 font-semibold">对应生成的邀请码</th>
                        <th className="py-2.5 px-4 font-semibold">邀请码状态</th>
                        <th className="py-2.5 px-4 font-semibold">订单时间</th>
                        <th className="py-2.5 px-4 font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            暂无在线购买订单记录
                          </td>
                        </tr>
                      ) : (
                        orders.map((o) => {
                          const linkedCode = inviteCodes.find(c => c.code === o.inviteCode);
                          const isCodeDeleted = !linkedCode || o.inviteCodeStatus === 'deleted';
                          const isCodeUsed = linkedCode && linkedCode.status === 'used';
                          const isCodeUnused = linkedCode && linkedCode.status === 'unused';

                          return (
                            <tr key={o.orderId} className="hover:bg-slate-900/40">
                              <td className="py-3 px-4 font-mono text-slate-300">{o.orderId}</td>
                              <td className="py-3 px-4">
                                {o.payMethod === 'wechat' ? (
                                  <span className="text-emerald-400 font-medium">微信支付</span>
                                ) : (
                                  <span className="text-blue-400 font-medium">支付宝</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold text-amber-400">¥{Number(o.amount).toFixed(2)}</td>
                              <td className="py-3 px-4 font-mono font-bold">
                                <div className="flex items-center gap-2">
                                  <span className={isCodeDeleted ? 'text-slate-500 line-through' : 'text-blue-400'}>
                                    {o.inviteCode}
                                  </span>
                                  {!isCodeDeleted && (
                                    <button
                                      type="button"
                                      onClick={() => copyCode(o.inviteCode)}
                                      className="text-slate-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
                                      title="复制邀请码"
                                    >
                                      {copiedCode === o.inviteCode ? (
                                        <Check size={12} className="text-emerald-400" />
                                      ) : (
                                        <Copy size={12} />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {isCodeUsed ? (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-medium">
                                    已使用 ({linkedCode?.usedBy || '学员'})
                                  </span>
                                ) : isCodeDeleted ? (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px]">
                                    已作废/已删除
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-medium border border-emerald-500/30">
                                    有效 · 未使用
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                                {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isCodeUnused && (
                                    <button
                                      type="button"
                                      onClick={() => promptDeleteCode(o.inviteCode)}
                                      className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-medium border border-red-500/20 transition-all cursor-pointer inline-flex items-center gap-1"
                                      title="作废并删除此邀请码"
                                    >
                                      <Trash2 size={11} />
                                      <span>作废此码</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => promptDeleteOrder(o.orderId, o.inviteCode)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/50 transition-colors cursor-pointer"
                                    title="删除此笔订单流水"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* In-app Confirmation Dialog (Never blocked by iframe sandbox) */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${confirmModal.danger ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                <AlertTriangle size={22} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white leading-tight">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmModal.description}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {confirmModal.cancelText || '取消'}
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-lg ${
                  confirmModal.danger
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                }`}
              >
                {confirmModal.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Diagnostics & Health Modal */}
      {showDbModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    数据库与服务健康自检报告
                  </h3>
                  <p className="text-xs text-slate-400">实时检测云端持久化存储连接状态</p>
                </div>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Status Item: MongoDB Cluster */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server size={18} className="text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">MongoDB 云数据库集群</div>
                    <div className="text-[11px] text-slate-400">Cluster0 (Atlas 分布式高可用)</div>
                  </div>
                </div>
                <div>
                  {dbStatus === 'connected' ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1 border border-emerald-500/30">
                      <CheckCircle2 size={12} /> 连接畅通
                    </span>
                  ) : dbStatus === 'disconnected' ? (
                    <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-bold flex items-center gap-1 border border-red-500/30">
                      <AlertTriangle size={12} /> 未连接 / 离线
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center gap-1">
                      <RefreshCw size={12} className="animate-spin" /> 检测中
                    </span>
                  )}
                </div>
              </div>

              {/* Status Item: Latency & Target Database */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Activity size={12} className="text-amber-400" /> 自检响应延迟
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-400">
                    {dbDiagnostics?.latencyMs !== undefined ? `${dbDiagnostics.latencyMs} ms` : '计算中...'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Database size={12} className="text-blue-400" /> 当前数据库
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-200 truncate">
                    {dbDiagnostics?.stats?.dbName || 'relay_platform'}
                  </div>
                </div>
              </div>

              {/* Collections Stat Cards */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>云数据库集合 (Collections) 数据统计</span>
                  <span className="text-[10px] text-slate-500 font-normal">多端实时同步</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                    <div className="text-base font-bold font-mono text-blue-400">
                      {dbDiagnostics?.stats?.userCount ?? users.length}
                    </div>
                    <div className="text-[10px] text-slate-400">注册用户数</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                    <div className="text-base font-bold font-mono text-purple-400">
                      {dbDiagnostics?.stats?.codeCount ?? inviteCodes.length}
                    </div>
                    <div className="text-[10px] text-slate-400">有效邀请码</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                    <div className="text-base font-bold font-mono text-emerald-400">
                      {dbDiagnostics?.stats?.orderCount ?? orders.length}
                    </div>
                    <div className="text-[10px] text-slate-400">购买订单记录</div>
                  </div>
                </div>
              </div>

              {/* SMTP Mailer Status */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-slate-400">验证码邮件服务 (SMTP 163): </span>
                  <span className="text-slate-200 font-mono font-medium">
                    {dbDiagnostics?.smtpUser || 'skot_catan@163.com'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {dbDiagnostics?.smtpConfigured ? '授权码已配置' : '默认配置'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={checkDbHealth}
                disabled={dbChecking}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={dbChecking ? 'animate-spin' : ''} />
                {dbChecking ? '正在自检...' : '立即重新自检'}
              </button>

              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
