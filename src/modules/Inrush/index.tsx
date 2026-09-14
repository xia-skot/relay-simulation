import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ComposedChart, ReferenceDot, ReferenceLine, 
  Legend, BarChart, Bar, Cell 
} from 'recharts';
import { 
  Activity, 
  Zap, 
  Play, 
  Pause, 
  RotateCcw,
  Info,
  Settings2
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function InrushModule() {
  const [alpha, setAlpha] = useState(0);
  const [phiRes, setPhiRes] = useState(0.8);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFFT, setShowFFT] = useState(false);

  const maxTime = 8 * Math.PI; 
  const numPoints = 400;
  const dt = maxTime / numPoints;
  const tau = 50; 

  const PHI_S = 1.2; 
  const I_S = 0.5;   
  const K_SAT = 10;  

  useEffect(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
  }, [alpha, phiRes]);

  useEffect(() => {
    let animationFrameId: number;
    if (isPlaying) {
      const render = () => {
        setCurrentFrame((prev) => {
          if (prev >= numPoints) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 2; 
        });
        animationFrameId = requestAnimationFrame(render);
      };
      animationFrameId = requestAnimationFrame(render);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, numPoints]);

  const getExcitationCurrent = (phi: number) => {
    if (Math.abs(phi) <= PHI_S) {
      return (I_S / PHI_S) * phi;
    } else {
      const sign = Math.sign(phi);
      return sign * I_S + (phi - sign * PHI_S) * K_SAT;
    }
  };

  const fullData = useMemo(() => {
    const data = [];
    const alphaRad = (alpha * Math.PI) / 180;

    for (let i = 0; i <= numPoints; i++) {
      const t = i * dt;
      const u = Math.sin(t + alphaRad);
      const phiSteady = -Math.cos(t + alphaRad);
      const phiTransient = (phiRes + Math.cos(alphaRad)) * Math.exp(-t / tau);
      const phi = phiSteady + phiTransient;
      const current = getExcitationCurrent(phi);
      data.push({ t, u, phi, phiSteady, phiTransient, i: current });
    }
    return data;
  }, [alpha, phiRes, dt, numPoints]);

  const phi_p = useMemo(() => {
    if (fullData.length === 0) return 0;
    return Math.max(...fullData.map(d => d.phi));
  }, [fullData]);
  const i_p = getExcitationCurrent(phi_p);

  const phiICurveData = useMemo(() => {
    const data = [];
    for (let phi = -3; phi <= 3; phi += 0.05) {
      data.push({ phi, i: getExcitationCurrent(phi) });
    }
    return data;
  }, []);

  const harmonicsData = useMemo(() => {
    if (fullData.length === 0) return [];
    const N = numPoints;
    const cycles = 4;
    const harmonics = [];

    for (let h = 0; h <= 7; h++) {
      const k = h * cycles;
      let sumRe = 0;
      let sumIm = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        sumRe += fullData[n].i * Math.cos(angle);
        sumIm -= fullData[n].i * Math.sin(angle);
      }
      const magnitude = Math.sqrt(sumRe * sumRe + sumIm * sumIm);
      const amplitude = h === 0 ? magnitude / N : (2 * magnitude) / N;
      harmonics.push({
        name: h === 0 ? 'DC' : `${h}次`,
        amplitude: amplitude
      });
    }
    return harmonics;
  }, [fullData, numPoints]);

  const currentData = fullData.slice(0, currentFrame + 1);
  const currentPoint = fullData[currentFrame] || fullData[0];

  const formatTime = (val: number) => (val / Math.PI).toFixed(1) + 'π';

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 p-4 font-sans text-slate-900">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2 border-b pb-2">
              <Settings2 size={16} className="text-blue-600" /> 参数设置
            </h2>
            
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">合闸角 α (度)</label>
                <span className="text-xs text-blue-600 font-mono font-bold bg-blue-50 px-2 rounded">{alpha}°</span>
              </div>
              <input
                type="range" min="0" max="360" value={alpha}
                onChange={(e) => setAlpha(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="mb-6">
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">剩磁 Φr (标幺值)</label>
                <span className="text-xs text-red-600 font-mono font-bold bg-red-50 px-2 rounded">{phiRes.toFixed(2)}</span>
              </div>
              <input
                type="range" min="-0.8" max="0.8" step="0.01" value={phiRes}
                onChange={(e) => setPhiRes(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95",
                  isPlaying ? "bg-amber-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
                {isPlaying ? "暂停过程" : "启动合闸"}
              </button>
              <button
                onClick={() => { setIsPlaying(false); setCurrentFrame(0); }}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                title="重置"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
             <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Info size={14} /> 涌流典型特征
             </h3>
             <ul className="space-y-3 text-xs text-blue-800/80 leading-relaxed font-semibold">
                <li>• 含有大量的非周期分量和高次谐波（以二次为主）。</li>
                <li>• 波形偏向时间轴的一侧，出现间断角。</li>
                <li>• 前几个周波的幅值很大。</li>
             </ul>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 relative">
            <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
               <Activity size={16} className="text-amber-500" /> 稳态磁通曲线
            </h2>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="t" type="number" domain={[0, maxTime]} tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                <YAxis domain={[-1.5, 1.5]} tick={{ fontSize: 10 }} />
                <Tooltip 
                  labelFormatter={formatTime} 
                  contentStyle={{ fontSize: '11px', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                />
                <Legend verticalAlign="top" iconType="circle" />
                <Line type="monotone" dataKey="u" name="电压 u*" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="phiSteady" name="磁通 Φm*" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
            <h2 className="text-sm font-bold mb-2 text-slate-800">基本磁化特性 (i-Φ)</h2>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 5, right: 10, left: -20, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="i" domain={[-10, 10]} hide />
                <YAxis type="number" dataKey="phi" domain={[-3, 3]} tick={{ fontSize: 10 }} />
                <ReferenceLine x={0} stroke="#cbd5e1" />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Line data={phiICurveData} dataKey="phi" type="monotone" stroke="#94a3b8" strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceDot x={currentPoint.i} y={currentPoint.phi} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-[1.2] flex flex-col min-h-0">
            <h2 className="text-sm font-bold text-slate-800 mb-2">暂态合成磁通波形</h2>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="t" type="number" domain={[0, maxTime]} tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                <YAxis domain={[-3, 3]} tick={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="phiSteady" name="稳态磁通" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="phiTransient" name="直流分量" stroke="#000" strokeWidth={1} strokeDasharray="6 6" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="phi" name="合成磁通" stroke="#ef4444" strokeWidth={3} dot={false} isAnimationActive={false} />
                <ReferenceLine y={PHI_S} stroke="#000" strokeWidth={1.5} label={{ value: 'Φs (饱和点)', position: 'left', fontSize: 10, fill: '#000' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-800">
                {showFFT ? '电流频域频谱 (二次谐波分析)' : '励磁涌流时域波形 i*'}
              </h2>
              <button
                onClick={() => setShowFFT(!showFFT)}
                className="text-[10px] font-black uppercase px-2 py-1 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
              >
                {showFFT ? '查看时域' : '查看频谱'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              {showFFT ? (
                <BarChart data={harmonicsData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Bar dataKey="amplitude" name="幅值" radius={[4, 4, 0, 0]}>
                    {harmonicsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 2 ? '#ef4444' : index === 1 ? '#10b981' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <LineChart data={currentData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="t" type="number" domain={[0, maxTime]} tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                  <YAxis domain={[-10, 10]} tick={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="i" name="励磁电流" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
                  <ReferenceLine y={I_S} stroke="#ef4444" strokeDasharray="3 3" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
