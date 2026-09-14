import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Settings2, 
  PenLine, 
  Zap, 
  Box, 
  ShieldCheck,
  Menu,
  X,
  Play,
  ChevronDown,
  Home,
  LineChart,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { cn } from './lib/utils';
import Logo from './components/Logo';
import AuthModal from './components/AuthModal';
import { getCurrentUser, setCurrentUser } from './lib/authStore';
import { UserAccount } from './types/auth';
import AdminDashboard from './components/AdminDashboard';

// Import modules
import IframeSandbox from './components/IframeSandbox';

import relay3dHtml from './raw-html/relay3d.html?raw';
import wiringHtml from './raw-html/wiring.html?raw';
import icRelayHtml from './raw-html/ic-relay-waveform.html?raw';
import sldHtml from './raw-html/single-line.html?raw';
import oscHtml from './raw-html/oscillation.html?raw';
import inrushHtml from './raw-html/inrush.html?raw';
import hfpHtml from './raw-html/higher-frequency.html?raw';
import curveHtml from './raw-html/relay-curve.html?raw';

const MODULES = [
  { id: 'curve', name: '继电器触发特性曲线模拟', icon: LineChart, htmlContent: curveHtml },
  { id: '3d', name: '电磁型电流继电器3D交互模型', icon: Box, htmlContent: relay3dHtml },
  { id: 'wiring', name: '中性点不接地系统异地两相接地短路', icon: Settings2, htmlContent: wiringHtml },
  { id: 'icwv', name: '集成电路型继电器波形输出演示', icon: Activity, htmlContent: icRelayHtml },
  { id: 'sld', name: '双侧电源网络过电流保护动作时限与方向元件配置', icon: PenLine, htmlContent: sldHtml },
  { id: 'osc', name: '电力系统振荡特征虚拟仿真', icon: Activity, htmlContent: oscHtml },
  { id: 'inrush', name: '变压器励磁涌流仿真', icon: Zap, htmlContent: inrushHtml },
  { id: 'hfp', name: '闭锁式方向高频保护原理模拟', icon: ShieldCheck, htmlContent: hfpHtml },
];

export default function App() {
  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(() => getCurrentUser());
  const [activeModule, setActiveModule] = useState('curve');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [iframeBgColor, setIframeBgColor] = useState('transparent');
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = Boolean(
    currentUser?.role === 'admin' || 
    currentUser?.email?.toLowerCase() === 'skot_catan@163.com'
  );

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // When active module changes, reset bg color
  useEffect(() => {
    setIframeBgColor('transparent');
  }, [activeModule]);

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
    setHasStarted(false);
  };

  const startDemo = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Fullscreen request failed", err);
      });
    }
    setHasStarted(true);
  };

  // If not authenticated, render login / register / forgot password view
  if (!currentUser) {
    return <AuthModal onSuccess={(user) => setCurrentUserState(user)} />;
  }

  if (!hasStarted) {
    return (
      <div className="w-screen h-screen bg-slate-50 flex items-center justify-center font-sans p-4 relative">
        {/* Top-right user badge */}
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm text-sm">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <UserIcon size={16} />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-800 leading-tight">
                {currentUser.name || '已登录用户'}
              </span>
              {isAdmin && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                  管理员
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">{currentUser.email}</span>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAdminDashboard(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full text-xs font-semibold shadow-sm transition-all cursor-pointer ml-1"
            >
              <ShieldCheck size={14} />
              <span>管理后台</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            title="退出登录"
            className="ml-1 p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>

        <div className="max-w-2xl w-full mx-auto px-6 py-12 bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center">
          <div className="w-16 h-16 flex items-center justify-center mb-5">
            <Logo className="w-16 h-16 drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight text-center mb-4 whitespace-nowrap">
            继电保护可视化交互演示平台
          </h1>
          <p className="text-slate-500 mb-10 text-center max-w-lg">
            欢迎回来，<span className="font-semibold text-slate-800">{currentUser.name || currentUser.email}</span>！请选择教学模块进行交互式虚拟仿真与学习演示。
          </p>

          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">选择演示模块</label>
              <div className="relative">
                <select
                  value={activeModule}
                  onChange={(e) => setActiveModule(e.target.value)}
                  className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium appearance-none outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all cursor-pointer"
                >
                  {MODULES.map(mod => (
                    <option key={mod.id} value={mod.id}>{mod.name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={20} />
                </div>
              </div>
            </div>

            <button
              onClick={startDemo}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play size={20} className="fill-current" />
              开始演示
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex bg-slate-50 overflow-hidden font-sans">
      
      {/* Left Thin Sidebar */}
      <div 
        className={cn(
          "w-16 h-full flex flex-col items-center py-4 shrink-0 relative z-50 border-r transition-colors duration-300 justify-between",
          activeModule === '3d' 
            ? "bg-slate-900 border-slate-800" 
            : "bg-white border-slate-200"
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setHasStarted(false)}
            className="p-3 rounded-xl shadow-sm transition-all flex items-center justify-center bg-blue-500 text-white hover:bg-blue-600"
            title="回主页"
          >
            <Home size={24} />
          </button>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              "p-3 rounded-xl shadow-sm transition-all flex items-center justify-center",
              isMenuOpen ? "bg-red-500 hover:bg-red-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
            title="功能列表"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAdminDashboard(true)}
              className="p-3 rounded-xl shadow-sm transition-all flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              title="管理员后台"
            >
              <ShieldCheck size={24} />
            </button>
          )}
        </div>

        {/* User logout button at bottom of sidebar */}
        <button
          onClick={handleLogout}
          title={`退出登录 (${currentUser.name || currentUser.email})`}
          className="p-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={20} />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-4 left-20 w-80 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl overflow-hidden py-2"
            >
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 tracking-tight">继保原理仿真功能列表</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">选择教学模块</p>
                </div>
              </div>
              <nav className="flex flex-col p-2 space-y-1 max-h-[70vh] overflow-y-auto">
                {MODULES.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => {
                      setActiveModule(mod.id);
                      setIsMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left",
                      activeModule === mod.id 
                        ? "bg-blue-50 text-blue-700 font-medium" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <mod.icon size={18} className={cn(activeModule === mod.id ? "text-blue-600" : "text-slate-400")} />
                    <span className="text-sm">{mod.name}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Full-Screen Frame */}
      <div className="flex-1 h-full relative z-0" style={{ backgroundColor: iframeBgColor === 'transparent' ? '#000' : iframeBgColor }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModule}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            <IframeSandbox 
              htmlContent={MODULES.find(m => m.id === activeModule)?.htmlContent || ''} 
              title={MODULES.find(m => m.id === activeModule)?.name} 
              onBgColorChange={(color) => setIframeBgColor(color)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Admin Dashboard Overlay Modal */}
      {showAdminDashboard && (
        <AdminDashboard
          currentEmail={currentUser.email}
          onClose={() => setShowAdminDashboard(false)}
        />
      )}

    </div>
  );
}

