import { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Text, ContactShadows, Environment, PerspectiveCamera, Center, Line, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { SeedNote } from '../types';

const PLANET_RADIUS = 15;

function Plant3D({ note, position, onClick }: { note: SeedNote; position: [number, number, number]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { growthStage, isGrowth, tasks } = note;

  // Stagger entrance state
  const [spawned, setSpawned] = useState(false);
  useMemo(() => {
    setTimeout(() => setSpawned(true), 100 + (note.id.length % 10) * 50);
  }, [note.id]);

  const progress = useMemo(() => {
    if (!tasks.length) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return (completed / tasks.length) * 100;
  }, [tasks]);

  // Compute orientation: face away from center (0,0,0)
  const quaternion = useMemo(() => {
    const posVector = new THREE.Vector3(...position).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, posVector);
    return q;
  }, [position]);

  const targetScale = useMemo(() => (spawned ? (hovered ? 1.5 : 1) : 0), [spawned, hovered]);

  useFrame((state) => {
    if (meshRef.current) {
      // Smooth scale transition
      const s = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.1);
      meshRef.current.scale.set(s, s, s);
      
      if (growthStage !== 'withered') {
        const t = state.clock.elapsedTime + (note.id.length % 10);
        // Floating effect
        const offset = Math.sin(t * 1.5) * 0.15 + Math.cos(t * 0.8) * 0.05;
        meshRef.current.position.y = offset;
        
        // Subtle rotation oscillation
        meshRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
        meshRef.current.rotation.x = Math.cos(t * 0.4) * 0.1;
      }
    }
  });

  const renderModel = () => {
    if (growthStage === 'bloom') {
      return (
        <group scale={[0.8, 0.8, 0.8]}>
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.25, 2, 8]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <group position={[0, 3, 0]}>
            <mesh position={[0, 0, 0]} castShadow>
              <coneGeometry args={[1.2, 3.5, 8]} />
              <meshStandardMaterial color="#1b5e20" />
            </mesh>
            <mesh position={[0, -1, 0]} castShadow>
              <coneGeometry args={[1.4, 3, 8]} />
              <meshStandardMaterial color="#2e7d32" />
            </mesh>
          </group>
          {/* Fruit/Harvested indicators */}
          {[...Array(5)].map((_, i) => (
             <mesh key={i} position={[Math.sin(i) * 0.8, 2.5 + Math.cos(i) * 0.5, Math.cos(i * 2) * 0.8]}>
               <sphereGeometry args={[0.1, 8, 8]} />
               <meshStandardMaterial color="#f44336" emissive="#f44336" emissiveIntensity={0.2} />
             </mesh>
          ))}
        </group>
      );
    }

    if (growthStage === 'withered') {
      return (
        <group rotation={[1.2, 0, 0.3]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.03, 0.06, 1.2, 6]} />
            <meshStandardMaterial color="#8d6e63" metalness={0} roughness={1} />
          </mesh>
          <mesh position={[-0.3, 0.8, 0]} rotation={[0, 0, 1]}>
            <capsuleGeometry args={[0.08, 0.3, 2, 6]} />
            <meshStandardMaterial color="#795548" />
          </mesh>
        </group>
      );
    }

    if (isGrowth) {
      const height = 0.5 + (progress * 0.012);
      return (
        <group>
          <mesh position={[0, height / 2, 0]}>
            <cylinderGeometry args={[0.04, 0.06, height, 8]} />
            <meshStandardMaterial color="#81c784" />
          </mesh>
          <mesh position={[0.2, height, 0]} rotation={[0.4, 0, -0.6]}>
            <capsuleGeometry args={[0.1, 0.3, 4, 8]} />
            <meshStandardMaterial color="#66bb6a" />
          </mesh>
          <mesh position={[-0.2, height - 0.2, 0]} rotation={[-0.4, 0, 0.6]}>
            <capsuleGeometry args={[0.1, 0.3, 4, 8]} />
            <meshStandardMaterial color="#66bb6a" />
          </mesh>
        </group>
      );
    }

    // Seed
    return (
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={hovered ? "#a1887f" : "#8d6e63"} roughness={0.8} />
      </mesh>
    );
  };

  return (
    <group 
      position={position}
      quaternion={quaternion}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <group ref={meshRef}>
        {renderModel()}
      </group>
    </group>
  );
}

function ConnectionLine({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const points = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    
    // Create an arc: midpoint pushed outwards
    const midPoint = new THREE.Vector3()
      .addVectors(startVec, endVec)
      .normalize()
      .multiplyScalar(PLANET_RADIUS * 1.5); // Push arc out
    
    const curve = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
    return curve.getPoints(20);
  }, [start, end]);
  
  return (
    <group>
      <Line
        points={points}
        color="#81c784"
        opacity={0.4}
        transparent
        lineWidth={1.5}
      />
      <Line
        points={points}
        color="#ffffff"
        opacity={0.1}
        transparent
        lineWidth={4}
      />
    </group>
  );
}

function Atmosphere({ isDay }: { isDay: boolean }) {
  const atmosphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (atmosphereRef.current) {
      const t = state.clock.getElapsedTime();
      const scale = 1 + Math.sin(t * 0.5) * 0.02;
      atmosphereRef.current.scale.set(scale, scale, scale);
      
      if (atmosphereRef.current.material instanceof THREE.MeshStandardMaterial) {
        atmosphereRef.current.material.opacity = (isDay ? 0.3 : 0.4) + Math.sin(t * 0.8) * 0.1;
      }
    }
  });

  return (
    <mesh ref={atmosphereRef}>
      <sphereGeometry args={[PLANET_RADIUS + 1, 64, 64]} />
      <meshStandardMaterial 
        color={isDay ? "#81c784" : "#40916c"} 
        transparent 
        opacity={0.3} 
        side={THREE.BackSide} 
      />
    </mesh>
  );
}

export default function Garden3D({ notes, onSelectNote }: { notes: SeedNote[]; onSelectNote: (id: string) => void }) {
  const isDay = useMemo(() => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 19;
  }, []);

  const plants = useMemo(() => {
    return notes.map((note) => {
      // Spherical distribution
      const seed = note.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const phi = Math.acos(-1 + (2 * (seed % 100)) / 100);
      const theta = Math.sqrt(100 * Math.PI) * phi;
      
      const x = PLANET_RADIUS * Math.sin(phi) * Math.cos(theta);
      const y = PLANET_RADIUS * Math.sin(phi) * Math.sin(theta);
      const z = PLANET_RADIUS * Math.cos(phi);
      
      return { note, position: [x, y, z] as [number, number, number] };
    });
  }, [notes]);

  return (
    <div className={`w-full h-[75vh] rounded-[3rem] overflow-hidden shadow-2xl relative border-[12px] border-white/10 backdrop-blur-md transition-colors duration-1000 ${isDay ? 'bg-[#caf0f8]' : 'bg-[#0a0a0a]'}`}>
      <Canvas shadows camera={{ position: [40, 30, 40], fov: 45 }}>
        <color attach="background" args={[isDay ? '#caf0f8' : '#050505']} />
        
        <ambientLight intensity={isDay ? 1.2 : 0.8} />
        <pointLight position={[50, 50, 50]} intensity={2} castShadow />
        <directionalLight position={[-50, 50, -50]} intensity={1.5} color={isDay ? "#ffffff" : "#48cae4"} />
        <hemisphereLight intensity={1} color="#ffffff" groundColor="#000000" />
        
        {!isDay && <Stars radius={150} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
        
        <group>
          {/* Planet Core */}
          <mesh receiveShadow castShadow>
            <sphereGeometry args={[PLANET_RADIUS, 64, 64]} />
            <meshStandardMaterial 
              color={isDay ? "#4caf50" : "#1b4332"} 
              emissive={isDay ? "#2e7d32" : "#1b4332"} 
              emissiveIntensity={isDay ? 0.3 : 0.8}
              roughness={0.7} 
              metalness={0.1} 
            />
          </mesh>
          
          {/* Atmosphere Glow */}
          <Atmosphere isDay={isDay} />

          <Sparkles 
            count={isDay ? 100 : 300} 
            scale={PLANET_RADIUS * 3.5} 
            size={5} 
            speed={0.4} 
            opacity={0.6} 
            color="#ffffff" 
          />
          
          {/* Neural Seeds (Plants/Trees) */}
          {plants.map(({ note, position }) => (
            <Plant3D 
              key={note.id} 
              note={note} 
              position={position} 
              onClick={() => onSelectNote(note.id)} 
            />
          ))}
        </group>

        <Suspense fallback={null}>
          <Environment preset={isDay ? "park" : "city"} />
        </Suspense>

        <OrbitControls 
          enablePan={false} 
          enableZoom={true} 
          enableRotate={true}
          autoRotate
          autoRotateSpeed={0.5}
          minDistance={25}
          maxDistance={90}
          makeDefault
        />
      </Canvas>
      
      <div className="absolute top-12 left-12 pointer-events-none">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)] animate-pulse" />
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-200/40">Galaxy Garden</p>
        </div>
        <h4 className="text-5xl font-serif text-white tracking-tight leading-none drop-shadow-xl">Planeta<br/><span className="text-green-400/50 italic">Cerebro</span></h4>
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-white/10 backdrop-blur-2xl px-10 py-5 rounded-[2rem] border border-white/20 shadow-2xl pointer-events-none text-white/80">
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-50">Exploración</span>
          <span className="text-[10px] font-bold">ÓRBITA 360°</span>
        </div>
        <div className="w-px h-8 bg-white/20" />
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-50">Enfoque</span>
          <span className="text-[10px] font-bold">CLICK EN IDEA</span>
        </div>
      </div>
    </div>
  );
}
