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
  GraduationCap,
  Home,
  LineChart
} from 'lucide-react';
import { cn } from './lib/utils';

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
  const [activeModule, setActiveModule] = useState('curve');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [iframeBgColor, setIframeBgColor] = useState('transparent');
  const menuRef = useRef<HTMLDivElement>(null);

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

  const startDemo = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Fullscreen request failed", err);
      });
    }
    setHasStarted(true);
  };

  if (!hasStarted) {
    return (
      <div className="w-screen h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
        <div className="max-w-2xl w-full mx-auto px-6 py-12 bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
            <GraduationCap className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl md:text-3xl font-black text-slate-900 tracking-tight text-center mb-4">
            继电保护<br/>可视化交互演示平台
          </h1>
          <p className="text-slate-500 mb-10 text-center max-w-lg">
            选择一个功能模块进行交互式虚拟仿真与学习演示。
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
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
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
    <div className="w-screen h-screen flex bg-black overflow-hidden font-sans">
      
      {/* Left Thin Sidebar */}
      <div 
        className={cn(
          "w-16 h-full flex flex-col items-center py-4 shrink-0 relative z-50 border-r transition-colors duration-300",
          activeModule === '3d' 
            ? "bg-slate-900 border-slate-800" 
            : "bg-slate-50 border-slate-200"
        )}
      >
        <button
          onClick={() => setHasStarted(false)}
          className="p-3 mb-3 rounded-xl shadow-sm transition-all flex items-center justify-center bg-blue-500 text-white hover:bg-blue-600"
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
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
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
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 tracking-tight">继保原理仿真功能列表</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">选择教学模块</p>
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

    </div>
  );
}

