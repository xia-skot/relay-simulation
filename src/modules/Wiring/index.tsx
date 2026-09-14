import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Settings2, 
  Info, 
  ShieldAlert, 
  Activity,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';

// --- Constants (Light theme adapted) ---
const COLORS: Record<string, string> = {
  A: '#f59e0b', // Amber
  B: '#10b981', // Emerald
  C: '#ef4444', // Red
  WireNeutral: '#94a3b8',
  WireActive: '#e11d48', // Rose for fault
  WireNormal: '#cbd5e1',
  Bus: '#475569'
};

const STROKE_WIDTH = {
  WIRE: 2.5,
  BUS: 5
};

export default function WiringModule() {
  const [topology, setTopology] = useState<'Series' | 'Parallel'>('Series');
  const [wiringMode, setWiringMode] = useState<'ThreePhaseStar' | 'TwoPhaseStar'>('ThreePhaseStar');
  const [fault1, setFault1] = useState<'A' | 'B' | 'C' | null>(null);
  const [fault2, setFault2] = useState<'A' | 'B' | 'C' | null>(null);

  const result = useMemo(() => {
    const res = {
      line1SeesCurrent: false,
      line2SeesCurrent: false,
      trippedBreaker1: false,
      trippedBreaker2: false,
      explanation: "请在图中点击虚线圈 (k1/k2) 设置故障点。",
      activePhasesL1: [] as string[],
      activePhasesL2: [] as string[]
    };

    if (!fault1 || !fault2) {
      if (fault1 || fault2) {
        res.explanation = "单相接地状态：中性点不接地系统允许短时运行，保护不动作。\n请设置第二点故障以演示异地两相短路。";
      }
      return res;
    }

    if (fault1 === fault2) {
      res.explanation = "同相接地：属于同相多点接地，非典型异地两相故障。\n请在 k1 和 k2 选择不同相位的故障点。";
      return res;
    }

    const hasCT = (p: string) => {
      if (wiringMode === 'ThreePhaseStar') return true;
      if (wiringMode === 'TwoPhaseStar') return p === 'A' || p === 'C';
      return false;
    };

    if (topology === 'Series') {
      res.activePhasesL2 = [fault2];
      res.activePhasesL1 = [fault1, fault2];

      const relay2Sees = hasCT(fault2);
      const relay1Sees = hasCT(fault1) || hasCT(fault2);

      res.line1SeesCurrent = relay1Sees;
      res.line2SeesCurrent = relay2Sees;

      if (relay2Sees) {
        res.trippedBreaker2 = true;
        res.explanation = `线路 II 监测到 ${fault2} 相故障，断路器 QF2 正确跳闸。\n保护具有 100% 选择性，切除末端故障，保证线路 I 供电。`;
      } else if (relay1Sees) {
        res.trippedBreaker1 = true;
        res.explanation = `线路 II 在 ${fault2} 相（B相）无TA(死区)拒动。\n线路 I 保护作为后备检测到电流，越级跳闸切除全线。`;
      }
    } else {
      res.activePhasesL1 = [fault1];
      res.activePhasesL2 = [fault2];

      const relay1Sees = hasCT(fault1);
      const relay2Sees = hasCT(fault2);

      res.line1SeesCurrent = relay1Sees;
      res.line2SeesCurrent = relay2Sees;

      if (relay1Sees) res.trippedBreaker1 = true;
      if (relay2Sees) res.trippedBreaker2 = true;

      if (relay1Sees && relay2Sees) {
        res.explanation = `两条线路保护均动作，QF1和QF2同时跳闸。\n后果：非故障相也失去电源，保护失去选择性。`;
      } else if (relay1Sees) {
        res.explanation = `QF1跳闸切除故障，QF2无TA不动作。成功隔离故障线路。`;
      } else if (relay2Sees) {
        res.explanation = `QF2跳闸切除故障，QF1无TA不动作。成功隔离故障线路。`;
      }
    }

    return res;
  }, [topology, wiringMode, fault1, fault2]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 p-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">电网结构类型</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button 
                  onClick={() => setTopology('Series')}
                  className={cn("py-2 text-xs font-bold rounded-lg transition-all", topology === 'Series' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}
                >
                  串联线路
                </button>
                <button 
                  onClick={() => setTopology('Parallel')}
                  className={cn("py-2 text-xs font-bold rounded-lg transition-all", topology === 'Parallel' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}
                >
                  并联线路
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">TA 接线方式</label>
              <div className="space-y-2">
                {[
                  { id: 'ThreePhaseStar', name: '三相星形 (A, B, C)', desc: '完全保护，无死区' },
                  { id: 'TwoPhaseStar', name: '两相星形 (A, C)', desc: 'B相不设TA，存在死区' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setWiringMode(mode.id as any)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center",
                      wiringMode === mode.id ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div>
                      <p className="text-xs font-bold">{mode.name}</p>
                      <p className="text-[10px] opacity-70">{mode.desc}</p>
                    </div>
                    {wiringMode === mode.id && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={() => { setFault1(null); setFault2(null); }}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition-colors"
            >
              清除所有故障点
            </button>
          </div>

          <div className="bg-blue-600 p-5 rounded-2xl shadow-xl text-white space-y-4">
             <div className="flex items-center gap-2 border-b border-white/20 pb-2">
               <ShieldAlert size={18} />
               <h3 className="text-sm font-bold uppercase tracking-tight">仿真运行结论</h3>
             </div>
             <p className="text-xs leading-relaxed font-medium opacity-90 italic">
               {result.explanation}
             </p>
          </div>
        </div>

        {/* Dynamic SVG Diagram */}
        <div className="lg:col-span-9 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-4">
            <svg viewBox="0 0 1000 380" className="w-full h-full max-h-[400px]">
               {/* Definitions */}
               <defs>
                 <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                   <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                 </marker>
               </defs>

               {/* Bus M */}
               <g transform="translate(180, 0)">
                 {['A', 'B', 'C'].map((p, i) => (
                    <line key={p} x1={-20 + i*20} y1={30} x2={-20 + i*20} y2={350} stroke={COLORS[p]} strokeWidth={STROKE_WIDTH.BUS} />
                 ))}
                 <text x="0" y="370" textAnchor="middle" className="text-sm font-black fill-slate-400">母线 M</text>
               </g>

               {/* Source G */}
               <g transform="translate(60, 190)">
                 <circle r="25" fill="white" stroke="#94a3b8" strokeWidth="2.5" />
                 <path d="M -12 0 Q -6 -12, 0 0 T 12 0" stroke="#94a3b8" fill="none" strokeWidth="2.5" />
                 <line x1="25" y1="0" x2="100" y2="0" stroke="#cbd5e1" strokeWidth="2" />
               </g>

               {/* Circuit logic */}
               {topology === 'Series' ? (
                 <>
                   {/* Line 1 segments and components */}
                   {['A', 'B', 'C'].map((p, i) => {
                     const y = 120 + i * 70;
                     const active = result.activePhasesL1.includes(p);
                     const faultLine = p === fault1;
                     return (
                       <g key={p}>
                         <line x1={180 - 20 + i*20} y1={y} x2={400} y2={y} stroke={active ? COLORS.WireActive : COLORS[p]} strokeWidth={active ? 3 : 2} strokeDasharray={active ? "6,2" : "none"} />
                         <line x1={400} y1={y} x2={550} y2={y} stroke={active && !faultLine ? COLORS.WireActive : COLORS[p]} strokeWidth={active && !faultLine ? 3 : 2} opacity={faultLine ? 0.3 : 1} />
                         {/* Breaker QF1 */}
                         <rect x={260} y={y-12} width={24} height={24} fill="white" stroke="#94a3b8" rx="4" />
                         <line x1={265} y1={y} x2={279} y2={y} stroke={result.trippedBreaker1 ? COLORS.C : "#10b981"} strokeWidth="4" transform={result.trippedBreaker1 ? `rotate(45, 272, ${y})` : ""} />
                         {/* TA1 */}
                         { (wiringMode === 'ThreePhaseStar' || (wiringMode === 'TwoPhaseStar' && (p === 'A' || p === 'C'))) && (
                           <circle cx={320} cy={y} r="8" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
                         )}
                         {/* Fault k1 marker */}
                         <g 
                          className="cursor-pointer group" 
                          onClick={() => { setFault1(fault1 === p ? null : p as any); }}
                         >
                           <circle cx={400} cy={y} r={fault1 === p ? 6 : 14} fill={fault1 === p ? COLORS.C : "transparent"} stroke={fault1 === p ? "white" : "#cbd5e1"} strokeWidth="2" strokeDasharray={fault1 === p ? "none" : "3,3"} />
                           {fault1 === p && <path d={`M 400 ${y} v 25 m -8 -10 l 8 10 l 8 -10`} stroke={COLORS.C} strokeWidth="3" fill="none" />}
                         </g>
                       </g>
                     )
                   })}

                   {/* Bus P */}
                   <g transform="translate(560, 0)">
                     {['A', 'B', 'C'].map((p, i) => (
                        <line key={p} x1={-10 + i*10} y1={100} x2={-10 + i*10} y2={280} stroke={COLORS[p]} strokeWidth="4" />
                     ))}
                     <text x="0" y="300" textAnchor="middle" className="text-[10px] font-black fill-slate-400 uppercase">Bus P</text>
                   </g>

                   {/* Line 2 segments */}
                   {['A', 'B', 'C'].map((p, i) => {
                     const y = 120 + i * 70;
                     const active = result.activePhasesL2.includes(p);
                     const faultLine = p === fault2;
                     return (
                       <g key={p}>
                         <line x1={570} y1={y} x2={740} y2={y} stroke={active ? COLORS.WireActive : COLORS[p]} strokeWidth={active ? 3 : 2} />
                         <line x1={740} y1={y} x2={880} y2={y} stroke={COLORS[p]} strokeWidth="2" opacity={faultLine ? 0.3 : 1} />
                         {/* Breaker QF2 */}
                         <rect x={640} y={y-12} width={24} height={24} fill="white" stroke="#94a3b8" rx="4" />
                         <line x1={645} y1={y} x2={659} y2={y} stroke={result.trippedBreaker2 ? COLORS.C : "#10b981"} strokeWidth="4" transform={result.trippedBreaker2 ? `rotate(45, 652, ${y})` : ""} />
                         {/* TA2 */}
                         { (wiringMode === 'ThreePhaseStar' || (wiringMode === 'TwoPhaseStar' && (p === 'A' || p === 'C'))) && (
                           <circle cx={690} cy={y} r="8" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
                         )}
                         {/* Fault k2 marker */}
                         <g 
                          className="cursor-pointer group" 
                          onClick={() => { setFault2(fault2 === p ? null : p as any); }}
                         >
                           <circle cx={740} cy={y} r={fault2 === p ? 6 : 14} fill={fault2 === p ? COLORS.C : "transparent"} stroke={fault2 === p ? "white" : "#cbd5e1"} strokeWidth="2" strokeDasharray={fault2 === p ? "none" : "3,3"} />
                           {fault2 === p && <path d={`M 740 ${y} v 25 m -8 -10 l 8 10 l 8 -10`} stroke={COLORS.C} strokeWidth="3" fill="none" />}
                         </g>
                       </g>
                     )
                   })}
                 </>
               ) : (
                 <>
                   {/* Parallel implementation simplified */}
                   <text x="500" y="200" className="text-xl font-black fill-slate-200 uppercase tracking-[2em]">Parallel Mode</text>
                 </>
               )}
            </svg>
          </div>

          <div className="h-16 bg-slate-50 border-t border-slate-100 flex items-center px-6 gap-8">
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-slate-400 uppercase">QF1 状态</span>
               <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm transition-all", result.trippedBreaker1 ? "bg-red-500 scale-110" : "bg-green-500")}>
                 {result.trippedBreaker1 ? 'TRIPPED (跳闸)' : 'CLOSED (合闸)'}
               </div>
             </div>
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-slate-400 uppercase">QF2 状态</span>
               <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm transition-all", result.trippedBreaker2 ? "bg-red-500 scale-110" : "bg-green-500")}>
                 {result.trippedBreaker2 ? 'TRIPPED (跳闸)' : 'CLOSED (合闸)'}
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
