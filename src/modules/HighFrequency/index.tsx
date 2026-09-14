import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  Info,
  Settings2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

const LOGIC_STEPS = [
  "正常运行：线路无故障，各元件输出 0。",
  "故障发生：A、B 侧启动元件检测到故障，输出 1。",
  "方向判断：A 侧判断为正向，B 侧判断为反向（外部故障场景）。",
  "综合逻辑：B 侧由于判断为反向，准备向 A 侧发信屏蔽。",
  "信号传输：B 发出闭锁波，A 侧收讯机收到信号。",
  "闭锁保护：A 侧正向故障因收到闭锁信号而不跳闸，保证选择性。"
];

export default function HighFrequencyModule() {
  const [step, setStep] = useState(0);
  const [isAuto, setIsAuto] = useState(false);
  const [faultType, setFaultType] = useState<'internal' | 'external'>('external');

  useEffect(() => {
    let timer: number;
    if (isAuto) {
      timer = window.setInterval(() => {
        setStep(prev => {
          if (prev >= 5) {
            setIsAuto(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [isAuto]);

  const state = useMemo(() => {
    const isFault = step > 0;
    const aStart = isFault ? 1 : 0;
    const bStart = isFault ? 1 : 0;
    const aDir = isFault ? 1 : 0; // Positive for A
    const bDir = isFault ? (faultType === 'internal' ? 1 : 0) : 0; 
    
    const aFwd = aStart && aDir ? 1 : 0;
    const bFwd = bStart && bDir ? 1 : 0;
    
    // Blocking signal logic
    const bTx = step >= 3 && bStart && !bDir ? 1 : 0;
    const aRx = step >= 4 ? bTx : 0;
    
    const aTrip = step >= 5 && aFwd && !aRx ? 1 : 0;
    const bTrip = step >= 5 && bFwd ? 1 : 0;

    return { aStart, bStart, aDir, bDir, aFwd, bFwd, bTx, aRx, aTrip, bTrip };
  }, [step, faultType]);

  const ActiveG = ({ active, children, color = "#ef4444" }: any) => (
    <g opacity={active ? 1 : 0.2}>
      {children}
    </g>
  );

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 p-6 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="lg:col-span-3 space-y-6 flex flex-col">
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
             <h2 className="text-sm font-bold mb-4 border-b pb-2 flex items-center gap-2">
                <Settings2 size={16} className="text-blue-600" /> 保护逻辑设置
             </h2>
             
             <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">故障位置</label>
                  <select 
                    value={faultType}
                    onChange={(e) => { setFaultType(e.target.value as any); setStep(0); }}
                    className="w-full bg-slate-100 border border-slate-200 p-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="external">区外故障 (B侧右侧)</option>
                    <option value="internal">区内故障 (AB线路中)</option>
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-2">
                 <button 
                  onClick={() => setIsAuto(!isAuto)}
                  className={cn(
                    "py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-white transition-all shadow-md active:scale-95",
                    isAuto ? "bg-amber-500" : "bg-green-600 hover:bg-green-700"
                  )}
                 >
                   {isAuto ? <><Pause size={14} /> 暂停</> : <><Play size={14} /> 自动演示</>}
                 </button>
                 <button 
                  onClick={() => { setStep(0); setIsAuto(false); }}
                  className="py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                 >
                   重置逻辑
                 </button>
               </div>
             </div>
           </div>

           <div className="bg-slate-950 p-5 rounded-2xl shadow-2xl text-white">
             <div className="flex justify-between items-center mb-3">
               <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">当前运行步骤</h3>
               <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-mono">{step+1} / 6</span>
             </div>
             <p className="text-sm font-medium leading-relaxed italic text-slate-300 min-h-[3em]">
               {LOGIC_STEPS[step]}
             </p>
           </div>
        </div>

        <div className="lg:col-span-9 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col p-4 relative overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <svg viewBox="0 0 800 400" className="w-full h-full max-h-[500px]">
               {/* Transmition Line */}
               <line x1="100" y1="100" x2="700" y2="100" stroke="#000" strokeWidth="4" />
               <text x="400" y="80" textAnchor="middle" className="text-xs font-bold fill-slate-400 uppercase tracking-widest italic">Power Transmission Line</text>
               
               {/* Component Nodes */}
               <g transform="translate(100, 100)">
                 <rect x="-40" y="-40" width="80" height="80" fill="white" stroke="black" strokeWidth="2" />
                 <text textAnchor="middle" y="5" className="text-lg font-black fill-slate-800">A侧</text>
                 <ActiveG active={state.aTrip}>
                    <line x1="0" y1="40" x2="0" y2="100" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,2" />
                    <text x="10" y="90" className="text-xs font-bold fill-red-600">TRIP</text>
                 </ActiveG>
               </g>

               <g transform="translate(700, 100)">
                 <rect x="-40" y="-40" width="80" height="80" fill="white" stroke="black" strokeWidth="2" />
                 <text textAnchor="middle" y="5" className="text-lg font-black fill-slate-800">B侧</text>
                 <ActiveG active={state.bTrip}>
                    <line x1="0" y1="40" x2="0" y2="100" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,2" />
                    <text x="10" y="90" className="text-xs font-bold fill-red-600">TRIP</text>
                 </ActiveG>
               </g>

               {/* Signals in wire */}
               {state.bTx > 0 && (
                 <motion.g
                  initial={{ x: 650, y: 100 }}
                  animate={{ x: 150, y: 100 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                 >
                   <circle r="8" fill="#3b82f6" fillOpacity="0.6" />
                   <path d="M -5 -3 L 5 0 L -5 3 Z" fill="white" />
                 </motion.g>
               )}

               {/* Fault Point */}
               <g transform={faultType === 'internal' ? "translate(350, 100)" : "translate(760, 100)"} opacity={step > 0 ? 1 : 0.1}>
                 <path d="M 0 0 L -10 -20 L 10 -20 Z" fill="#ef4444" />
                 <text y="-30" textAnchor="middle" className="text-xs font-black fill-red-600 italic">FAULT k</text>
               </g>

               {/* Logic Table */}
               <foreignObject x="100" y="240" width="600" height="150" className="opacity-80">
                 <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden font-mono text-[10px]">
                    <div className="grid grid-cols-5 bg-slate-900 text-white p-2">
                      <span>侧端</span>
                      <span>启动</span>
                      <span>方向</span>
                      <span>收信</span>
                      <span>出口</span>
                    </div>
                    <div className="grid grid-cols-5 p-2 border-b border-slate-100">
                      <span className="font-bold">A侧</span>
                      <span className={state.aStart ? "text-green-600 font-bold" : ""}>{state.aStart}</span>
                      <span className={state.aDir ? "text-blue-600 font-bold" : ""}>{state.aDir ? "正" : "反"}</span>
                      <span className={state.aRx ? "text-red-500 font-black animate-pulse" : ""}>{state.aRx ? "收" : "静"}</span>
                      <span className={state.aTrip ? "bg-red-500 text-white px-1 rounded" : ""}>{state.aTrip ? "跳" : "锁"}</span>
                    </div>
                    <div className="grid grid-cols-5 p-2">
                       <span className="font-bold">B侧</span>
                       <span className={state.bStart ? "text-green-600 font-bold" : ""}>{state.bStart}</span>
                       <span className={state.bDir ? "text-blue-600 font-bold" : ""}>{state.bDir ? "正" : "反"}</span>
                       <span className="text-slate-400">---</span>
                       <span className={state.bTrip ? "bg-red-500 text-white px-1 rounded" : ""}>{state.bTrip ? "跳" : "锁"}</span>
                    </div>
                 </div>
               </foreignObject>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function useMemo(factory: () => any, deps: any[]) {
    return React.useMemo(factory, deps);
}
