import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Play, RotateCcw, Info, Settings2, Box as BoxIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

// --- Simulation Steps ---
const STEPS = [
  { id: 0, title: "就绪状态", desc: "线圈断电，衔铁通过弹簧拉力保持张开。", coilOn: false, fluxOn: false, targetAngle: 0 },
  { id: 1, title: "通电激活", desc: "线圈通电产生磁动势，铁芯开始磁化。", coilOn: true, fluxOn: true, targetAngle: 0 },
  { id: 2, title: "电磁吸合", desc: "电磁吸力克服弹簧力，衔铁向下吸合。", coilOn: true, fluxOn: true, targetAngle: 1 },
  { id: 3, title: "断电复位", desc: "线圈失电，磁场消失，衔铁返回初位。", coilOn: false, fluxOn: false, targetAngle: 0 },
];

function Model({ config }: { config: typeof STEPS[0] }) {
  const armatureRef = useRef<THREE.Group>(null);
  const coilRef = useRef<THREE.Mesh>(null);
  
  const OPEN_ANGLE = 0;
  const CLOSED_ANGLE = 0.16;

  useFrame((state, delta) => {
    if (armatureRef.current) {
      const targetAngle = config.targetAngle === 1 ? CLOSED_ANGLE : OPEN_ANGLE;
      armatureRef.current.rotation.z = THREE.MathUtils.lerp(armatureRef.current.rotation.z, targetAngle, delta * 10);
    }
    
    if (coilRef.current) {
      const targetEmissive = config.coilOn ? new THREE.Color("#ff4400") : new THREE.Color("#000");
      (coilRef.current.material as THREE.MeshStandardMaterial).emissive.lerp(targetEmissive, 0.1);
      (coilRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = config.coilOn ? 1.5 : 0;
    }
  });

  return (
    <group position={[0, -1, 0]} scale={1.2}>
      {/* 铁芯 Core */}
      <mesh position={[-1.5, 0, 0]}>
        <cylinderGeometry args={[0.75, 0.75, 4, 32]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* 线圈 Coil */}
      <mesh ref={coilRef} position={[-1.5, 0, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 3.5, 32]} />
        <meshStandardMaterial color="#b45309" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* 底座 Base */}
      <mesh position={[0, -2.2, 0]}>
        <boxGeometry args={[8, 0.4, 3]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* 支架 Frame */}
      <mesh position={[1, 0.5, 0]}>
        <boxGeometry args={[0.4, 5, 0.4]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>

      {/* 衔铁 Armature Block */}
      <group ref={armatureRef} position={[1, 2.5, 0]}>
        <mesh position={[-1.5, 0.1, 0]}>
          <boxGeometry args={[3.2, 0.2, 0.8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} />
        </mesh>
        {/* 接点 Contact */}
        <mesh position={[0.2, -1.5, 0]}>
          <boxGeometry args={[0.1, 3, 0.4]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[0.2, -2.9, 0]}>
           <boxGeometry args={[0.8, 0.3, 1.2]} />
           <meshStandardMaterial color="#f59e0b" metalness={1} roughness={0} />
        </mesh>
      </group>

      {/* 静接点 Fixed Contact */}
      <group position={[1.5, -2, 0]}>
        <mesh position={[0, 0, 0.5]}>
          <boxGeometry args={[0.8, 0.2, 0.4]} />
          <meshStandardMaterial color="#f59e0b" metalness={1} />
        </mesh>
        <mesh position={[0, 0, -0.5]}>
          <boxGeometry args={[0.8, 0.2, 0.4]} />
          <meshStandardMaterial color="#f59e0b" metalness={1} />
        </mesh>
      </group>

      {/* Flux representation */}
      {config.fluxOn && (
        <group position={[-1.5, 0, 0]}>
          <mesh visible={config.fluxOn}>
            <torusGeometry args={[1.5, 0.02, 16, 100]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export default function Relay3DModule() {
  const [stepIdx, setStepIdx] = useState(0);

  return (
    <div className="h-full w-full bg-slate-900 overflow-hidden relative">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[6, 5, 12]} fov={40} />
        <Environment preset="studio" />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} castShadow />
        
        <Model config={STEPS[stepIdx]} />
        
        <OrbitControls enablePan={false} minPolarAngle={0} maxPolarAngle={Math.PI/2} />
      </Canvas>

      <div className="absolute top-6 left-6 w-96 space-y-4 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl pointer-events-auto shadow-2xl">
           <div className="flex items-center gap-3 mb-4">
             <div className="bg-blue-600 p-2 rounded-lg text-white">
               <BoxIcon size={20} />
             </div>
             <h2 className="text-xl font-bold text-white tracking-tight">继电器结构立体分析</h2>
           </div>

           <div className="space-y-4">
              <h3 className="text-lg font-bold text-blue-400">{STEPS[stepIdx].title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed font-medium">{STEPS[stepIdx].desc}</p>
              
              <div className="flex gap-2 pt-4 border-t border-white/10">
                <button 
                  onClick={() => setStepIdx(prev => (prev - 1 + STEPS.length) % STEPS.length)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all border border-slate-600"
                >
                  上一步
                </button>
                <button 
                  onClick={() => setStepIdx(prev => (prev + 1) % STEPS.length)}
                  className="flex-[2] py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black shadow-lg transition-all"
                >
                  下一步分析
                </button>
                <button 
                  onClick={() => setStepIdx(0)}
                  className="px-3 bg-slate-800 hover:bg-red-900/40 rounded-lg text-white border border-slate-600"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
           </div>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 pointer-events-auto">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">知识点卡片</h4>
           <ul className="text-xs text-slate-400 space-y-2">
              <li className="flex gap-2"><span className="text-blue-400">●</span> 动作电流 Iact：使衔铁吸合的最小电流。</li>
              <li className="flex gap-2"><span className="text-blue-400">●</span> 返回电流 Ire：衔铁返回到原始位置的最大电流。</li>
              <li className="flex gap-2"><span className="text-blue-400">●</span> 返回系数 kre = Ire / Iact (通常 &lt; 1)。</li>
           </ul>
        </div>
      </div>
      
      <div className="absolute bottom-6 right-6 text-right opacity-40 pointer-events-none">
         <p className="text-white text-[10px] font-bold">长沙理工大学 夏翊翔 制</p>
      </div>
    </div>
  );
}
