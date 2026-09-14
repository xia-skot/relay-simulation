import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  Settings2, 
  Download, 
  Info, 
  PenLine, 
  Trash2, 
  X, 
  Zap, 
  ChevronRight, 
  ChevronLeft,
  CircleCheck,
  BookmarkPlus
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Types from the original software
interface Bus {
  id: string;
  name: string;
  x: number;
  y: number;
  hasSource?: boolean;
  sourceName?: string;
}

interface Line {
  id: string;
  fromBus: string;
  toBus: string;
  relays: number[];
}

interface Relay {
  id: number;
  name: string;
  busId: string;
  direction: 'left' | 'right';
  fixedTime?: number;
  calculatedTime?: number;
  isDirectional?: boolean;
}

interface AppState {
  deltaT: number;
  buses: Bus[];
  lines: Line[];
  relays: Relay[];
  description?: string;
}

const INITIAL_STATE: AppState = {
  deltaT: 0.5,
  buses: [
    { id: "A", name: "A", x: 120, y: 150, hasSource: true, sourceName: "E1" },
    { id: "B", name: "B", x: 360, y: 150 },
    { id: "C", name: "C", x: 600, y: 150 },
    { id: "D", name: "D", x: 840, y: 150, hasSource: true, sourceName: "E2" }
  ],
  lines: [
    { id: "L1", fromBus: "A", toBus: "B", relays: [1, 2] },
    { id: "L2", fromBus: "B", toBus: "C", relays: [3, 4] },
    { id: "L3", fromBus: "C", toBus: "D", relays: [5, 6] }
  ],
  relays: [
    { id: 1, name: "1", busId: "A", direction: "right" },
    { id: 2, name: "2", busId: "B", direction: "left" },
    { id: 3, name: "3", busId: "B", direction: "right" },
    { id: 4, name: "4", busId: "C", direction: "left" },
    { id: 5, name: "5", busId: "C", direction: "right" },
    { id: 6, name: "6", busId: "D", direction: "left" },
    { id: 7, name: "7", busId: "A", fixedTime: 0.5, direction: "left" },
    { id: 8, name: "8", busId: "B", fixedTime: 0.5, direction: "left" },
    { id: 9, name: "9", busId: "B", fixedTime: 1.3, direction: "right" },
    { id: 10, name: "10", busId: "C", fixedTime: 0.8, direction: "left" },
    { id: 11, name: "11", busId: "D", fixedTime: 1.0, direction: "left" },
    { id: 12, name: "12", busId: "D", fixedTime: 0.6, direction: "right" }
  ]
};

export default function SingleLineModule() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [problemBank, setProblemBank] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [problemName, setProblemName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [answerColor, setAnswerColor] = useState("#2563eb");
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Logic calculation for answer
  const calculateAnswer = useCallback(() => {
    let newRelays = state.relays.map(r => ({ ...r, calculatedTime: undefined, isDirectional: false }));
    const dt = state.deltaT;

    // From Source 1 (Bus[0])
    if (state.buses[0].hasSource) {
      for (let i = state.lines.length - 1; i >= 0; i--) {
        const line = state.lines[i];
        const relay = newRelays.find(r => r.id === line.relays[0]);
        if (!relay) continue;
        
        const nextBus = line.toBus;
        const nextRelaysOnSameBus = newRelays.filter(r => r.busId === nextBus && r.fixedTime !== undefined);
        const nextLine = state.lines[i + 1];
        const nextRelayOnNextLine = nextLine ? newRelays.find(r => r.id === nextLine.relays[0]) : null;
        
        const times = [...nextRelaysOnSameBus.map(r => r.fixedTime || 0)];
        if (nextRelayOnNextLine?.calculatedTime !== undefined) {
          times.push(nextRelayOnNextLine.calculatedTime);
        }
        
        relay.calculatedTime = Math.round((Math.max(...(times.length > 0 ? times : [0])) + dt) * 10) / 10;
      }
    }

    // From Source 2 (Last Bus)
    if (state.buses[state.buses.length - 1].hasSource) {
      for (let i = 0; i < state.lines.length; i++) {
        const line = state.lines[i];
        const relay = newRelays.find(r => r.id === line.relays[1]);
        if (!relay) continue;

        const prevBus = line.fromBus;
        const prevRelaysOnSameBus = newRelays.filter(r => r.busId === prevBus && r.fixedTime !== undefined);
        const prevLine = state.lines[i - 1];
        const prevRelayOnPrevLine = prevLine ? newRelays.find(r => r.id === prevLine.relays[1]) : null;
        
        const times = [...prevRelaysOnSameBus.map(r => r.fixedTime || 0)];
        if (prevRelayOnPrevLine?.calculatedTime !== undefined) {
          times.push(prevRelayOnPrevLine.calculatedTime);
        }
        
        relay.calculatedTime = Math.round((Math.max(...(times.length > 0 ? times : [0])) + dt) * 10) / 10;
      }
    }

    // Directional check
    const relaysByBus: Record<string, Relay[]> = {};
    newRelays.forEach(r => {
      if (r.calculatedTime !== undefined) {
        if (!relaysByBus[r.busId]) relaysByBus[r.busId] = [];
        relaysByBus[r.busId].push(r);
      }
    });

    newRelays = newRelays.map(r => {
      if (r.calculatedTime === undefined) return r;
      const busRelays = relaysByBus[r.busId];
      if (!busRelays || busRelays.length === 0) return r;
      
      const maxTime = Math.max(...busRelays.map(br => br.calculatedTime as number));
      const isMax = r.calculatedTime === maxTime;
      const multipleMax = busRelays.filter(br => br.calculatedTime === maxTime).length > 1;
      
      return {
        ...r,
        isDirectional: !(isMax && !multipleMax)
      };
    });

    setState(prev => ({ ...prev, relays: newRelays }));
    setShowAnswer(true);
  }, [state, setState]);

  const updateRelayTime = (id: number, time: number) => {
    const newRelays = state.relays.map(r => r.id === id ? { ...r, fixedTime: time } : r);
    setState(prev => ({ ...prev, relays: newRelays }));
  };

  const handleExportSVG = () => {
    if (svgRef.current) {
      try {
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svgRef.current);
        const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `拓扑图_${new Date().getTime()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setToast("SVG导出成功");
      } catch (e) {
        setToast("导出失败");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* Action Bar */}
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/30 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportSVG}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download size={14} /> 导出SVG
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm",
              isEditing ? "bg-slate-950 text-white" : "bg-white border border-slate-200 text-slate-700"
            )}
          >
            <PenLine size={14} /> {isEditing ? "停止编辑" : "自定义参数"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (showAnswer) setShowAnswer(false);
              else calculateAnswer();
            }}
            className={cn(
              "flex items-center gap-2 px-6 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 text-white",
              showAnswer ? "bg-red-500" : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {showAnswer ? <><X size={14} /> 隐藏答案</> : <><Play size={14} /> 显示答案</>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main SVG Area */}
        <div className="flex-1 relative overflow-auto p-8 flex items-center justify-center">
          <svg 
            ref={svgRef}
            width={state.buses.length * 260 + 100} 
            height={600} 
            viewBox={`0 0 ${state.buses.length * 260 + 100} 600`}
            className="drop-shadow-lg"
          >
            <rect width="100%" height="100%" fill="transparent" />
            
            {/* Lines */}
            {state.lines.map(line => {
              const fromBus = state.buses.find(b => b.id === line.fromBus)!;
              const toBus = state.buses.find(b => b.id === line.toBus)!;
              return (
                <g key={line.id}>
                  <line x1={fromBus.x} y1={fromBus.y} x2={fromBus.x + 35} y2={fromBus.y} stroke="#334155" strokeWidth="2" />
                  <line x1={fromBus.x + 65} y1={fromBus.y} x2={toBus.x - 65} y2={toBus.y} stroke="#334155" strokeWidth="2" />
                  <line x1={toBus.x - 35} y1={toBus.y} x2={toBus.x} y2={toBus.y} stroke="#334155" strokeWidth="2" />
                </g>
              );
            })}

            {/* Buses and Source Labels */}
            {state.buses.map(bus => (
              <g key={bus.id}>
                <line 
                  x1={bus.x} y1={bus.y - 80} 
                  x2={bus.x} y2={bus.y + 300} 
                  stroke="#0f172a" strokeWidth="3" 
                />
                <text x={bus.x} y={bus.y - 100} textAnchor="middle" className="text-[42px] font-bold fill-slate-900">{bus.name}</text>
                
                {bus.hasSource && (
                  <g>
                    <circle cx={bus.id === state.buses[0].id ? bus.x - 70 : bus.x + 70} cy={bus.y} r="25" fill="white" stroke="#334155" strokeWidth="2" />
                    <path d="M -16 0 Q -8 -20 0 0 Q 8 20 16 0" fill="none" stroke="#334155" strokeWidth="2" transform={`translate(${bus.id === state.buses[0].id ? bus.x - 70 : bus.x + 70}, ${bus.y})`} />
                  </g>
                )}

                {/* Relays on Bus */}
                {(() => {
                  const busRelays = state.relays.filter(r => r.busId === bus.id && r.fixedTime !== undefined);
                  const leftRelays = busRelays.filter(r => r.direction === 'left');
                  const rightRelays = busRelays.filter(r => r.direction === 'right');
                  
                  return busRelays.map(relay => {
                    const index = (relay.direction === 'left' ? leftRelays : rightRelays).indexOf(relay);
                    const y = bus.y + 220 + index * 80;
                    const isLeft = relay.direction === 'left';
                    const xLen = 100;
                    const endX = isLeft ? bus.x - xLen : bus.x + xLen;
                    const gateX = isLeft ? bus.x - 50 : bus.x + 50;

                    return (
                      <g key={relay.id}>
                        <line x1={bus.x} y1={y} x2={isLeft ? gateX + 15 : gateX - 15} y2={y} stroke="#64748b" strokeWidth="1.5" />
                        <line x1={isLeft ? gateX - 15 : gateX + 15} y1={y} x2={endX} y2={y} stroke="#64748b" strokeWidth="1.5" />
                        <path d={isLeft ? `M ${endX} ${y} l 15 -4 l 0 8 z` : `M ${endX} ${y} l -15 -4 l 0 8 z`} fill="#475569" />
                        
                        {/* Relay Symbol */}
                        <g transform={`translate(${gateX}, ${y})`}>
                          <g transform="translate(-15, 0)">
                             <line x1="-5" y1="-5" x2="5" y2="5" stroke="#334155" strokeWidth="1.5" />
                             <line x1="5" y1="-5" x2="-5" y2="5" stroke="#334155" strokeWidth="1.5" />
                          </g>
                          <line x1="15" y1="0" x2="-18" y2="-23" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                          <text x="0" y="-35" textAnchor="middle" className="text-xl font-bold fill-slate-800">{relay.id}</text>
                        </g>

                        <text x={isLeft ? bus.x - 55 : bus.x + 55} y={y + 35} textAnchor="middle" className="text-2xl font-bold fill-slate-600">{relay.fixedTime}s</text>
                        
                        {isEditing && (
                          <foreignObject x={isLeft ? bus.x - 90 : bus.x - 10} y={y - 30} width="100" height="100">
                            <input 
                              type="number" step="0.1" 
                              value={relay.fixedTime} 
                              onChange={(e) => updateRelayTime(relay.id, parseFloat(e.target.value))}
                              className="w-20 h-10 text-xl border border-blue-200 rounded text-center bg-white shadow-md focus:ring-2 focus:ring-blue-500 outline-none" 
                            />
                          </foreignObject>
                        )}
                      </g>
                    );
                  })
                })()}
              </g>
            ))}

            {/* Line Relays (The ones being coordinated) */}
            {state.lines.map(line => {
              const bStart = state.buses.find(b => b.id === line.fromBus)!;
              const bEnd = state.buses.find(b => b.id === line.toBus)!;
              const r1 = state.relays.find(r => r.id === line.relays[0])!;
              const r2 = state.relays.find(r => r.id === line.relays[1])!;

              return (
                <Fragment key={line.id}>
                  {/* Relay 1 */}
                  <g transform={`translate(${bStart.x + 50}, ${bStart.y})`}>
                    <g transform="translate(-15, 0)">
                      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#334155" strokeWidth="1.5" />
                      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#334155" strokeWidth="1.5" />
                    </g>
                    <line x1="15" y1="0" x2="-18" y2="-23" stroke="#0f172a" strokeWidth="2" />
                    <text x="0" y="-35" textAnchor="middle" className="text-xl font-bold fill-slate-800">{r1.id}</text>
                    {showAnswer && (
                      <g>
                        <text x="0" y="55" textAnchor="middle" className="text-[28px] font-black" style={{ fill: answerColor }}>{r1.calculatedTime}s</text>
                        {r1.isDirectional && (
                           <g transform="translate(0, 0)">
                              <path d="M -15 -70 L 15 -70 M 5 -78 L 15 -70 L 5 -62" fill="none" stroke={answerColor} strokeWidth="2.5" />
                              <text x="0" y="-85" textAnchor="middle" className="text-sm font-black" style={{ fill: answerColor }}>KW</text>
                           </g>
                        )}
                      </g>
                    )}
                  </g>

                  {/* Relay 2 */}
                  <g transform={`translate(${bEnd.x - 50}, ${bEnd.y})`}>
                    <g transform="translate(-15, 0)">
                      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#334155" strokeWidth="1.5" />
                      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#334155" strokeWidth="1.5" />
                    </g>
                    <line x1="15" y1="0" x2="-18" y2="-23" stroke="#0f172a" strokeWidth="2" />
                    <text x="0" y="-35" textAnchor="middle" className="text-xl font-bold fill-slate-800">{r2.id}</text>
                    {showAnswer && (
                      <g>
                        <text x="0" y="55" textAnchor="middle" className="text-[28px] font-black" style={{ fill: answerColor }}>{r2.calculatedTime}s</text>
                        {r2.isDirectional && (
                           <g transform="translate(0, 0)">
                              <path d="M 15 -70 L -15 -70 M -5 -78 L -15 -70 L -5 -62" fill="none" stroke={answerColor} strokeWidth="2.5" />
                              <text x="0" y="-85" textAnchor="middle" className="text-sm font-black" style={{ fill: answerColor }}>KW</text>
                           </g>
                        )}
                      </g>
                    )}
                  </g>
                </Fragment>
              );
            })}
          </svg>
        </div>

        {/* Sidebar Info & Docs */}
        <div className="w-96 border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto p-8 space-y-8">
           <section className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Info size={14} /> 题目说明
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 italic text-sm text-slate-600 leading-relaxed shadow-inner">
                {state.description || "如图所示，电网配置了定时限过流保护。试确定所有过流保护的动作时限，并在必须装设方向元件（KW）的过流保护上标注正方向。"}
              </div>
           </section>

           <section className="space-y-4">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Settings2 size={14} /> 全局参数
             </h3>
             <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-tighter">阶梯级差 Δt</label>
                  <div className="flex gap-2">
                    {[0.3, 0.4, 0.5].map(val => (
                      <button
                        key={val}
                        onClick={() => setState(prev => ({ ...prev, deltaT: val }))}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-xs font-black transition-all border shadow-sm",
                          state.deltaT === val ? "bg-slate-900 text-white border-slate-950 scale-105" : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                        )}
                      >
                        {val}s
                      </button>
                    ))}
                  </div>
                </div>
             </div>
           </section>

           <section className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 space-y-4">
              <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                <BookmarkPlus size={14} /> 理工科知识点
              </h3>
              <ul className="space-y-3 text-[13px] text-blue-800/80 leading-relaxed font-medium">
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <span><strong>阶梯原则：</strong> 动作时限应从受端向送端方向逐级增加。</span>
                </li>
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <span><strong>方向性：</strong> 双侧电源供电时，需装设方向元件以保证选择性。</span>
                </li>
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <span><strong>坐标配合：</strong> 保护 11 需与相邻线路上的所有出口保护（如 7、8、10）配合。</span>
                </li>
              </ul>
           </section>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl z-[100] flex items-center gap-3"
          >
            <CircleCheck className="text-green-400" size={18} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
