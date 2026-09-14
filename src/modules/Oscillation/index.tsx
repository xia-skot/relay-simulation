import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Legend, AreaChart, Area
} from 'recharts';
import { 
  Activity, 
  Settings2, 
  ArrowRight,
  Zap,
  Info 
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DataPoint {
  delta: number;
  I: number;
  U_M: number;
  U_N: number;
  U_osc: number;
}

export default function OscillationModule() {
  const [Em, setEm] = useState(1);
  const [En, setEn] = useState(1);
  const [Zm, setZm] = useState(0.2);
  const [Zl, setZl] = useState(0.6);
  const [Zn, setZn] = useState(0.2);
  const [theta, setTheta] = useState(90);
  const [delta, setDelta] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  const Zsum = Zm + Zl + Zn;

  const data: DataPoint[] = useMemo(() => {
    const points: DataPoint[] = [];
    for (let d = 0; d <= 360; d += 5) {
      const rad = (d * Math.PI) / 180;
      // Current magnitude
      const I = Math.sqrt(Em * Em + En * En - 2 * Em * En * Math.cos(rad)) / Zsum;
      
      // Potential along the line
      // Simple resistive/inductive model
      const costh = Math.cos(theta * Math.PI / 180);
      const sinth = Math.sin(theta * Math.PI / 180);
      
      const calcU = (zLoc: number) => {
        const uReal = Em - I * zLoc * costh;
        const uImag = -I * zLoc * sinth;
        return Math.sqrt(uReal * uReal + uImag * uImag);
      };

      points.push({
        delta: d,
        I: I,
        U_M: 1.0, // simplified for visualization
        U_N: 1.0,
        U_osc: Math.abs(Math.sin(rad/2)) // Characteristic oscillation curve
      });
    }
    return points;
  }, [Em, En, Zsum, theta]);

  useEffect(() => {
    let timer: number;
    if (isRotating) {
      timer = window.setInterval(() => {
        setDelta(prev => (prev + 2) % 360);
      }, 25);
    }
    return () => clearInterval(timer);
  }, [isRotating]);

  // Vector graphics calculations
  const rad = (delta * Math.PI) / 180;
  const scale = 120 / Math.max(Em, En, 1);
  const center = { x: 150, y: 150 };

  const vEm = { x: center.x + Em * Math.cos(rad) * scale, y: center.y - Em * Math.sin(rad) * scale };
  const vEn = { x: center.x + En * scale, y: center.y };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 p-6 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Control Panel */}
        <div className="lg:col-span-3 space-y-4 flex flex-col overflow-y-auto">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2 border-b pb-2">
              <Settings2 size={16} className="text-blue-600" /> 系统参数整定
            </h2>
            
            <div className="space-y-4">
              {[
                { label: '送端电势 Em', val: Em, set: setEm, min: 0.5, max: 1.5, step: 0.05 },
                { label: '受端电势 En', val: En, set: setEn, min: 0.5, max: 1.5, step: 0.05 },
                { label: '系统总抗 ZΣ', val: Zsum, set: (v: number) => setZl(v - Zm - Zn), min: 0.1, max: 2.0, step: 0.1, disabled: true },
              ].map(p => (
                <div key={p.label}>
                  <div className="flex justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{p.label}</label>
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 rounded">{p.val.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min={p.min} max={p.max} step={p.step} value={p.val}
                    disabled={p.disabled}
                    onChange={(e) => p.set(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-2">
               <button
                onClick={() => setIsRotating(!isRotating)}
                className={cn(
                  "w-full py-3 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2",
                  isRotating ? "bg-amber-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                )}
               >
                <Activity size={14} className={isRotating ? "animate-spin" : ""} />
                {isRotating ? "停止旋转" : "开始同步旋转仿真"}
               </button>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl shadow-xl text-white">
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap size={14} /> 振荡中心解析
            </h3>
            <div className="space-y-4 text-xs">
               <div className="flex justify-between items-center">
                 <span className="opacity-60">中心位置:</span>
                 <span className="font-mono font-bold text-amber-400">{(Em/(Em+En)*Zsum).toFixed(2)} pu</span>
               </div>
               <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                 <p className="leading-relaxed font-medium">
                   当 δ = 180° 时，振荡中心电压降至 <span className="text-red-400 font-bold">最低点 (0 V)</span>。
                   若该点落在线路保护安装处，极易引起距离保护误动作。
                 </p>
               </div>
            </div>
          </div>
        </div>

        {/* Center: Vector Diagram */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col items-center justify-center relative overflow-hidden">
              <h3 className="absolute top-4 left-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                实时旋转平衡相量图
              </h3>
              <svg width="100%" height="100%" viewBox="0 0 300 300" className="max-w-[300px]">
                {/* Fixed Background */}
                <circle cx="150" cy="150" r="120" stroke="#f1f5f9" strokeWidth="1" fill="none" />
                <line x1="0" y1="150" x2="300" y2="150" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="150" y1="0" x2="150" y2="300" stroke="#f1f5f9" strokeWidth="1" />
                
                {/* Vectors */}
                <g className="drop-shadow-sm">
                  {/* En - Reference */}
                  <line x1={center.x} y1={center.y} x2={vEn.x} y2={vEn.y} stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                  <text x={vEn.x + 8} y={vEn.y + 4} className="text-xs font-black fill-blue-600">Ėn</text>
                  
                  {/* Em */}
                  <line x1={center.x} y1={center.y} x2={vEm.x} y2={vEm.y} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                  <text x={vEm.x} y={vEm.y - 12} textAnchor="middle" className="text-xs font-black fill-red-600">Ėm</text>
                  
                  {/* Coordinator Angle */}
                  <path 
                    d={`M 180 150 A 30 30 0 ${delta > 180 ? 1 : 0} 0 ${center.x + 30 * Math.cos(rad)} ${center.y - 30 * Math.sin(rad)}`} 
                    fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2"
                  />
                  <text x={center.x + 40 * Math.cos(rad/2)} y={center.y - 40 * Math.sin(rad/2)} className="text-[10px] fill-slate-500 font-bold">δ</text>
                </g>
              </svg>
              {/* Current value display */}
              <div className="mt-4 px-4 py-2 bg-slate-50 rounded-full border border-slate-100 flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-red-500" />
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">当前功角:</span>
                   <span className="text-sm font-black text-slate-800 font-mono">{Math.round(delta)}°</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Charts */}
        <div className="lg:col-span-5 flex flex-col gap-6">
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                U-δ 振荡特性曲线
             </h3>
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorU" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="delta" ticks={[0, 90, 180, 270, 360]} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                  <Tooltip 
                    contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine x={delta} stroke="#ef4444" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="U_osc" name="中心点电压" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorU)" isAnimationActive={false} />
                </AreaChart>
             </ResponsiveContainer>
           </div>
           
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 font-bold">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                I-δ 线电流变化趋势同步
             </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="delta" ticks={[0, 90, 180, 270, 360]} id="xaxis" hide />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ReferenceLine x={delta} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="I" name="全线短路电流" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(val: number) {
  return (val / Math.PI).toFixed(1) + 'π';
}
