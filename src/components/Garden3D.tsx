import { useRef, useMemo, useState, Suspense, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Line, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { SeedNote, Theme } from '../types';
import { daysSince, wateringDue } from '../seedLogic';

const PLANET_RADIUS = 15;
type GardenFilter = 'all' | 'water' | 'progress' | 'harvest';
type GardenPalette = {
  label: string;
  skyDay: string;
  skyNight: string;
  planet: string;
  planetNight: string;
  planetOverlay: string;
  patchColors: string[];
  water: string;
  waterNight: string;
  rock: string;
  trunk: string;
  trunkLight: string;
  seed: string;
  seedHover: string;
  leaf: string;
  leafAlt: string;
  leafDark: string;
  fruit: string[];
  withered: string;
  atmosphere: string;
  sparkles: string;
  connection: string;
  moon: string;
  treeStyle: 'broadleaf' | 'pine' | 'cherry' | 'moon' | 'palm' | 'mushroom' | 'cactus' | 'ice';
};

const GARDEN_PALETTES: Record<Theme, GardenPalette> = {
  earth: {
    label: 'Pradera',
    skyDay: '#8fd3ff',
    skyNight: '#10150f',
    planet: '#6b9f4f',
    planetNight: '#263b25',
    planetOverlay: '#b5c879',
    patchColors: ['#8eb65f', '#b7a46a', '#6f9e52', '#c4b071'],
    water: '#69b6d7',
    waterNight: '#285d73',
    rock: '#827866',
    trunk: '#79533c',
    trunkLight: '#8a6447',
    seed: '#8d6e52',
    seedHover: '#b48a63',
    leaf: '#6faa4f',
    leafAlt: '#8fc76a',
    leafDark: '#487b3d',
    fruit: ['#e36f3f', '#d95545', '#f0b742'],
    withered: '#6f5a4f',
    atmosphere: '#c8efb0',
    sparkles: '#fff8d8',
    connection: '#9fd27a',
    moon: '#d8d2bf',
    treeStyle: 'broadleaf',
  },
  forest: {
    label: 'Bosque',
    skyDay: '#8fb3c2',
    skyNight: '#071116',
    planet: '#1c3f3a',
    planetNight: '#0a1f22',
    planetOverlay: '#355a4b',
    patchColors: ['#254f42', '#183d37', '#42614a', '#65764f'],
    water: '#4f8da2',
    waterNight: '#163543',
    rock: '#67716a',
    trunk: '#3f3228',
    trunkLight: '#584638',
    seed: '#5c503f',
    seedHover: '#837255',
    leaf: '#3f7254',
    leafAlt: '#78935c',
    leafDark: '#1d4a3a',
    fruit: ['#b99a4e', '#8f5e3d', '#c7b66b'],
    withered: '#504841',
    atmosphere: '#7fa58c',
    sparkles: '#d7ead4',
    connection: '#9fbf88',
    moon: '#cfd8cf',
    treeStyle: 'pine',
  },
  bloom: {
    label: 'Floración',
    skyDay: '#a9ddff',
    skyNight: '#1b101a',
    planet: '#8eaf55',
    planetNight: '#3b2a3e',
    planetOverlay: '#f0a9bc',
    patchColors: ['#f2a7bd', '#d96a8c', '#a7be64', '#ffd1a6'],
    water: '#8bbfe3',
    waterNight: '#4b5e83',
    rock: '#b58993',
    trunk: '#7a4d45',
    trunkLight: '#98675c',
    seed: '#9a6552',
    seedHover: '#c88474',
    leaf: '#7fae4f',
    leafAlt: '#f08aad',
    leafDark: '#5f8d43',
    fruit: ['#f45b8c', '#ff9fb8', '#ffd166'],
    withered: '#8a6468',
    atmosphere: '#ffd1df',
    sparkles: '#ffd6e6',
    connection: '#f08aad',
    moon: '#f2d9df',
    treeStyle: 'cherry',
  },
  night: {
    label: 'Nocturno',
    skyDay: '#7ea7d8',
    skyNight: '#050814',
    planet: '#1c3651',
    planetNight: '#0d1d34',
    planetOverlay: '#2a5278',
    patchColors: ['#203f62', '#315d6f', '#2e4f7d', '#3a6670'],
    water: '#355f9e',
    waterNight: '#142a54',
    rock: '#596179',
    trunk: '#3b3140',
    trunkLight: '#5b4964',
    seed: '#6c5d8f',
    seedHover: '#9a82d8',
    leaf: '#6fa8dc',
    leafAlt: '#9b8cff',
    leafDark: '#385f9a',
    fruit: ['#a78bfa', '#60a5fa', '#f0abfc'],
    withered: '#514a61',
    atmosphere: '#6da8ff',
    sparkles: '#d8e8ff',
    connection: '#8cbcff',
    moon: '#d9dded',
    treeStyle: 'moon',
  },
  jungle: {
    label: 'Jungla',
    skyDay: '#72e6b2',
    skyNight: '#031a12',
    planet: '#12a15b',
    planetNight: '#073b2a',
    planetOverlay: '#b7f35a',
    patchColors: ['#18b86a', '#8bd943', '#0d7f53', '#ffd166'],
    water: '#28d8c2',
    waterNight: '#0c6b65',
    rock: '#526f58',
    trunk: '#5a3d25',
    trunkLight: '#7a5734',
    seed: '#8e673c',
    seedHover: '#c08d50',
    leaf: '#1fcf68',
    leafAlt: '#b7f35a',
    leafDark: '#087a4f',
    fruit: ['#ffb703', '#ff5a3d', '#b7f35a'],
    withered: '#5b5140',
    atmosphere: '#8effa8',
    sparkles: '#fff7a8',
    connection: '#ffd166',
    moon: '#dce8c8',
    treeStyle: 'palm',
  },
  alien: {
    label: 'Alien',
    skyDay: '#b39cff',
    skyNight: '#0a0718',
    planet: '#513a86',
    planetNight: '#1d1538',
    planetOverlay: '#65e0b2',
    patchColors: ['#6d4bb3', '#36c9a7', '#9d4edd', '#3b82f6'],
    water: '#72f5d1',
    waterNight: '#155e68',
    rock: '#635184',
    trunk: '#3b275a',
    trunkLight: '#5c3f86',
    seed: '#8b5cf6',
    seedHover: '#c084fc',
    leaf: '#72f5d1',
    leafAlt: '#d46cff',
    leafDark: '#38bdf8',
    fruit: ['#f0abfc', '#67e8f9', '#a7f3d0'],
    withered: '#514166',
    atmosphere: '#a78bfa',
    sparkles: '#d9f99d',
    connection: '#79f2c0',
    moon: '#e9d5ff',
    treeStyle: 'mushroom',
  },
  desert: {
    label: 'Desierto',
    skyDay: '#f6c177',
    skyNight: '#1a1110',
    planet: '#c98946',
    planetNight: '#4c2f1e',
    planetOverlay: '#e8b86d',
    patchColors: ['#d79b55', '#b97838', '#e6c06f', '#a76f3f'],
    water: '#5aa6b0',
    waterNight: '#224c55',
    rock: '#9b7653',
    trunk: '#6d4a2f',
    trunkLight: '#8b623d',
    seed: '#9c6a3f',
    seedHover: '#c89056',
    leaf: '#6f8b52',
    leafAlt: '#9caf5f',
    leafDark: '#4f6f3d',
    fruit: ['#ef7d45', '#f59e0b', '#eab308'],
    withered: '#7b6048',
    atmosphere: '#ffd08a',
    sparkles: '#fff1b8',
    connection: '#f0b75a',
    moon: '#ead7b5',
    treeStyle: 'cactus',
  },
  arctic: {
    label: 'Ártico',
    skyDay: '#bfefff',
    skyNight: '#061626',
    planet: '#d7f3f8',
    planetNight: '#14334c',
    planetOverlay: '#8bd3e6',
    patchColors: ['#eefcff', '#b8e6f2', '#d6f5ff', '#a7d8ea'],
    water: '#78c6df',
    waterNight: '#1b5873',
    rock: '#87a9b8',
    trunk: '#6b8794',
    trunkLight: '#93b7c8',
    seed: '#7ab9d6',
    seedHover: '#aee8ff',
    leaf: '#7bc7df',
    leafAlt: '#dff9ff',
    leafDark: '#4f9bbb',
    fruit: ['#a5f3fc', '#e0f2fe', '#bae6fd'],
    withered: '#7d9099',
    atmosphere: '#c9f3ff',
    sparkles: '#ffffff',
    connection: '#9adff0',
    moon: '#f3fbff',
    treeStyle: 'ice',
  },
};
const BRANCHES = [
  { position: [0.18, 1.05, 0] as [number, number, number], rotation: [0, 0, -0.82] as [number, number, number], length: 0.72, radius: 0.035 },
  { position: [-0.2, 1.34, 0.05] as [number, number, number], rotation: [0.18, 0.25, 0.88] as [number, number, number], length: 0.76, radius: 0.032 },
  { position: [0.1, 1.62, -0.12] as [number, number, number], rotation: [-0.18, -0.55, -0.64] as [number, number, number], length: 0.58, radius: 0.026 },
];
const CANOPY_CLUSTERS = [
  { position: [0, 2.38, 0] as [number, number, number], scale: [1.05, 0.86, 1.02] as [number, number, number], color: '#2f7d32' },
  { position: [-0.46, 2.05, 0.06] as [number, number, number], scale: [0.76, 0.66, 0.7] as [number, number, number], color: '#3f9a45' },
  { position: [0.48, 2.08, -0.04] as [number, number, number], scale: [0.78, 0.68, 0.72] as [number, number, number], color: '#277034' },
  { position: [0.08, 1.84, 0.42] as [number, number, number], scale: [0.68, 0.56, 0.64] as [number, number, number], color: '#56a85b' },
  { position: [-0.08, 1.78, -0.42] as [number, number, number], scale: [0.62, 0.52, 0.58] as [number, number, number], color: '#2d8737' },
];
const PLANET_PATCHES = [
  { lat: 22, lon: 18, radius: 2.6, color: '#6faa56', stretch: 1.45, twist: 0.4 },
  { lat: -18, lon: 72, radius: 2.1, color: '#8ba85d', stretch: 1.25, twist: -0.8 },
  { lat: 38, lon: 148, radius: 1.8, color: '#4f8f45', stretch: 1.7, twist: 0.2 },
  { lat: -42, lon: 210, radius: 2.4, color: '#9a8b5e', stretch: 1.35, twist: 1.1 },
  { lat: 8, lon: 286, radius: 2.8, color: '#5c9b50', stretch: 1.55, twist: -0.2 },
  { lat: 54, lon: 316, radius: 1.5, color: '#91b36b', stretch: 1.1, twist: 0.7 },
  { lat: -58, lon: 36, radius: 1.6, color: '#b39b67', stretch: 1.4, twist: -1.0 },
];
const PLANET_LAKES = [
  { lat: 3, lon: 112, radius: 1.35, stretch: 1.85, twist: 0.2 },
  { lat: -31, lon: 328, radius: 1.05, stretch: 1.45, twist: -0.6 },
  { lat: 47, lon: 246, radius: 0.9, stretch: 1.3, twist: 0.9 },
];
const PLANET_ROCKS = [
  { lat: 17, lon: 240, scale: 0.34 },
  { lat: -24, lon: 156, scale: 0.26 },
  { lat: 62, lon: 80, scale: 0.22 },
  { lat: -48, lon: 92, scale: 0.3 },
  { lat: 28, lon: 332, scale: 0.24 },
  { lat: -8, lon: 28, scale: 0.28 },
];
const CLOUD_PATCHES = [
  { lat: 36, lon: 58, radius: 1.55, stretch: 2.3, twist: 0.6 },
  { lat: -6, lon: 190, radius: 1.9, stretch: 2.7, twist: -0.4 },
  { lat: -42, lon: 274, radius: 1.25, stretch: 2.1, twist: 0.8 },
];

function getSurfaceTransform(lat: number, lon: number, radius = PLANET_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);
  const normal = new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ).normalize();
  const position = normal.clone().multiplyScalar(radius);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

  return { position, quaternion };
}

function TreeBranch({ position, rotation, length, radius, color = '#6d4c41' }: {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  radius: number;
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={[radius * 0.55, radius, length, 8]} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  );
}

function getPotStyle(palette: GardenPalette, stage: SeedNote['growthStage']) {
  const stageScale = stage === 'bloom' ? 1.16 : stage === 'sprout' ? 1.04 : stage === 'withered' ? 0.98 : 0.9;
  const styles: Record<GardenPalette['treeStyle'], { body: string; rim: string; soil: string; accent: string; roughness: number; metalness?: number; opacity?: number }> = {
    broadleaf: { body: '#b66a3c', rim: '#d28a55', soil: '#4a3022', accent: '#f1b36c', roughness: 0.86 },
    pine: { body: '#5d4634', rim: '#7a5b3f', soil: '#2d241c', accent: '#9fbf88', roughness: 0.94 },
    cherry: { body: '#f1b3c2', rim: '#ffd1dc', soil: '#5f3a3c', accent: palette.leafAlt, roughness: 0.72 },
    moon: { body: '#2d3556', rim: '#55628d', soil: '#181f36', accent: palette.sparkles, roughness: 0.58, metalness: 0.12 },
    palm: { body: '#9b7042', rim: '#c89a5c', soil: '#3d2b18', accent: '#ffd166', roughness: 0.88 },
    mushroom: { body: '#6d4bb3', rim: '#72f5d1', soil: '#2b1e4f', accent: '#d46cff', roughness: 0.42, metalness: 0.08 },
    cactus: { body: '#c8854b', rim: '#e2aa66', soil: '#6f4a2d', accent: '#f0b75a', roughness: 0.96 },
    ice: { body: '#bfefff', rim: '#ffffff', soil: '#86b9ca', accent: '#e0f2fe', roughness: 0.22, metalness: 0.04, opacity: 0.72 },
  };

  return { ...styles[palette.treeStyle], stageScale };
}

function IdeaPotModel({
  palette,
  stage,
  selected,
  needsWater,
}: {
  palette: GardenPalette;
  stage: SeedNote['growthStage'];
  selected: boolean;
  needsWater: boolean;
}) {
  const style = getPotStyle(palette, stage);
  const crackColor = stage === 'withered' ? '#2f241d' : style.accent;

  return (
    <group scale={[style.stageScale, style.stageScale, style.stageScale]}>
      <mesh position={[0, -0.13, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.28, 0.34, 28, 1, false]} />
        <meshStandardMaterial
          color={style.body}
          roughness={style.roughness}
          metalness={style.metalness || 0}
          transparent={Boolean(style.opacity)}
          opacity={style.opacity || 1}
        />
      </mesh>
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.43, 0.39, 0.11, 28]} />
        <meshStandardMaterial color={style.rim} roughness={style.roughness} metalness={style.metalness || 0} />
      </mesh>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.035, 28]} />
        <meshStandardMaterial color={needsWater ? '#8a684d' : style.soil} roughness={1} />
      </mesh>
      <mesh position={[0, -0.33, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.25, 0.31, 0.08, 28]} />
        <meshStandardMaterial color={style.body} roughness={style.roughness} metalness={style.metalness || 0} />
      </mesh>

      {palette.treeStyle === 'pine' && (
        <>
          <TreeBranch position={[0.28, 0.04, 0.08]} rotation={[0.2, 0.2, -1.2]} length={0.18} radius={0.012} color={style.accent} />
          <TreeBranch position={[-0.26, -0.03, 0.09]} rotation={[0.1, -0.2, 1.1]} length={0.16} radius={0.011} color={style.accent} />
        </>
      )}

      {palette.treeStyle === 'cherry' && (
        [0, 1, 2].map((dot) => {
          const angle = dot * 2.1;
          return (
            <mesh key={dot} position={[Math.cos(angle) * 0.32, -0.02 + dot * 0.04, Math.sin(angle) * 0.32]} scale={[0.05, 0.025, 0.05]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={style.accent} roughness={0.65} />
            </mesh>
          );
        })
      )}

      {palette.treeStyle === 'moon' && (
        <mesh position={[0.29, 0.0, 0.2]} rotation={[0.2, 0.1, 0.35]} scale={[0.11, 0.02, 0.11]}>
          <torusGeometry args={[1, 0.18, 8, 24, Math.PI * 1.35]} />
          <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.35} roughness={0.4} />
        </mesh>
      )}

      {palette.treeStyle === 'palm' && (
        <mesh position={[0, 0.05, 0]} rotation={[0, 0.55, 0]}>
          <torusGeometry args={[0.36, 0.018, 8, 36]} />
          <meshStandardMaterial color={style.accent} roughness={0.8} />
        </mesh>
      )}

      {palette.treeStyle === 'mushroom' && (
        <mesh position={[0.33, 0.02, 0.1]} scale={[0.07, 0.07, 0.07]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.35} roughness={0.35} />
        </mesh>
      )}

      {palette.treeStyle === 'cactus' && (
        [0, 1, 2, 3].map((rib) => {
          const angle = rib * Math.PI / 2;
          return (
            <mesh key={rib} position={[Math.cos(angle) * 0.39, -0.08, Math.sin(angle) * 0.39]} rotation={[0, -angle, 0]} scale={[0.012, 0.18, 0.012]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={style.accent} roughness={0.9} />
            </mesh>
          );
        })
      )}

      {palette.treeStyle === 'ice' && (
        <mesh position={[0, 0.08, 0]} rotation={[0, 0.2, 0]}>
          <torusGeometry args={[0.38, 0.018, 8, 36]} />
          <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.18} roughness={0.24} transparent opacity={0.78} />
        </mesh>
      )}

      {stage === 'withered' && (
        <>
          <TreeBranch position={[0.16, -0.04, 0.31]} rotation={[0.2, 0.35, -0.55]} length={0.2} radius={0.01} color={crackColor} />
          <TreeBranch position={[-0.2, -0.15, 0.28]} rotation={[0.15, -0.25, 0.65]} length={0.18} radius={0.01} color={crackColor} />
        </>
      )}

      {selected && (
        <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.015, 8, 40]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.45} transparent opacity={0.72} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function SeedModel({ hovered, palette }: { hovered: boolean; palette: GardenPalette }) {
  return (
    <group>
      <mesh position={[0, 0.11, 0]} scale={[1.15, 0.76, 0.92]} castShadow>
        <sphereGeometry args={[0.22, 24, 16]} />
        <meshStandardMaterial color={hovered ? palette.seedHover : palette.seed} roughness={0.82} />
      </mesh>
      <mesh position={[0.08, 0.2, 0.14]} rotation={[0.75, 0.2, -0.4]}>
        <capsuleGeometry args={[0.025, 0.16, 4, 8]} />
        <meshStandardMaterial color={palette.trunkLight} roughness={0.7} />
      </mesh>
    </group>
  );
}

function SproutTreeModel({ progress, palette }: { progress: number; palette: GardenPalette }) {
  const height = 0.62 + progress * 0.014;
  const leafScale = 0.72 + progress * 0.006;

  if (palette.treeStyle === 'pine') {
    return (
      <group>
        <mesh position={[0, height / 2, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.075, height, 8]} />
          <meshStandardMaterial color={palette.trunk} roughness={0.9} />
        </mesh>
        {[0, 1, 2].map((tier) => (
          <mesh key={tier} position={[0, height * 0.55 + tier * 0.28, 0]} rotation={[0, tier * 0.4, 0]} castShadow>
            <coneGeometry args={[0.38 - tier * 0.08, 0.46, 8]} />
            <meshStandardMaterial color={[palette.leafDark, palette.leaf, palette.leafAlt][tier]} roughness={0.84} flatShading />
          </mesh>
        ))}
      </group>
    );
  }

  if (palette.treeStyle === 'cherry') {
    return (
      <group>
        <mesh position={[0, height / 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, height, 10]} />
          <meshStandardMaterial color={palette.trunk} roughness={0.9} />
        </mesh>
        <mesh position={[0, height + 0.1, 0]} scale={[leafScale, leafScale * 0.64, leafScale]} castShadow>
          <dodecahedronGeometry args={[0.34, 0]} />
          <meshStandardMaterial color={palette.leafAlt} roughness={0.76} />
        </mesh>
        <mesh position={[0.24, height * 0.72, 0]} rotation={[0.2, 0, -0.65]} scale={[0.72, 0.32, 0.52]} castShadow>
          <sphereGeometry args={[0.2, 12, 8]} />
          <meshStandardMaterial color={palette.fruit[0]} roughness={0.78} />
        </mesh>
        <mesh position={[-0.24, height * 0.62, 0]} rotation={[0.2, 0, 0.65]} scale={[0.72, 0.32, 0.52]} castShadow>
          <sphereGeometry args={[0.2, 12, 8]} />
          <meshStandardMaterial color={palette.fruit[1]} roughness={0.78} />
        </mesh>
      </group>
    );
  }

  if (palette.treeStyle === 'palm') {
    return (
      <group>
        <mesh position={[0, height / 2, 0]} rotation={[0.08, 0, 0.08]} castShadow>
          <cylinderGeometry args={[0.055, 0.09, height, 8]} />
          <meshStandardMaterial color={palette.trunk} roughness={0.9} />
        </mesh>
        {[0, 1, 2, 3].map((leaf) => {
          const angle = leaf * Math.PI / 2;
          return (
            <mesh key={leaf} position={[Math.cos(angle) * 0.22, height + 0.16, Math.sin(angle) * 0.22]} rotation={[0.2, -angle, leaf % 2 ? -0.7 : 0.7]} scale={[0.95, 0.24, 0.46]} castShadow>
              <sphereGeometry args={[0.26, 16, 10]} />
              <meshStandardMaterial color={leaf % 2 ? palette.leafAlt : palette.leaf} roughness={0.78} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (palette.treeStyle === 'mushroom') {
    return (
      <group>
        <mesh position={[0, height * 0.34, 0]} scale={[0.65, 1, 0.65]} castShadow>
          <capsuleGeometry args={[0.12, height * 0.55, 6, 12]} />
          <meshStandardMaterial color={palette.trunkLight} emissive={palette.trunkLight} emissiveIntensity={0.12} roughness={0.7} />
        </mesh>
        <mesh position={[0, height + 0.06, 0]} scale={[leafScale * 1.1, leafScale * 0.42, leafScale * 1.1]} castShadow>
          <sphereGeometry args={[0.42, 20, 12]} />
          <meshStandardMaterial color={palette.leafAlt} emissive={palette.leafAlt} emissiveIntensity={0.22} roughness={0.62} />
        </mesh>
      </group>
    );
  }

  if (palette.treeStyle === 'cactus') {
    return (
      <group>
        <mesh position={[0, height / 2, 0]} castShadow>
          <capsuleGeometry args={[0.13, height, 6, 12]} />
          <meshStandardMaterial color={palette.leafDark} roughness={0.86} />
        </mesh>
        <mesh position={[0.22, height * 0.62, 0]} rotation={[0, 0, -0.65]} castShadow>
          <capsuleGeometry args={[0.07, height * 0.34, 6, 10]} />
          <meshStandardMaterial color={palette.leaf} roughness={0.86} />
        </mesh>
        <mesh position={[-0.2, height * 0.46, 0]} rotation={[0, 0, 0.68]} castShadow>
          <capsuleGeometry args={[0.06, height * 0.28, 6, 10]} />
          <meshStandardMaterial color={palette.leafAlt} roughness={0.86} />
        </mesh>
      </group>
    );
  }

  if (palette.treeStyle === 'ice') {
    return (
      <group>
        <mesh position={[0, height * 0.5, 0]} rotation={[0.1, 0.2, 0]} scale={[0.45, 1.05, 0.45]} castShadow>
          <octahedronGeometry args={[0.42, 1]} />
          <meshStandardMaterial color={palette.leafAlt} emissive={palette.leaf} emissiveIntensity={0.2} roughness={0.28} metalness={0.08} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0.22, height * 0.36, 0.06]} rotation={[0.4, 0, -0.55]} scale={[0.24, 0.62, 0.24]} castShadow>
          <octahedronGeometry args={[0.35, 1]} />
          <meshStandardMaterial color={palette.leaf} emissive={palette.leaf} emissiveIntensity={0.16} roughness={0.32} transparent opacity={0.82} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.08, height, 10]} />
        <meshStandardMaterial color={palette.trunk} roughness={0.9} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]} scale={[leafScale, leafScale * 0.72, leafScale]} castShadow>
        <dodecahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color={palette.leafAlt} roughness={0.78} />
      </mesh>
      {[
        { x: 0.22, y: height * 0.72, z: 0.02, rz: -0.68, color: palette.leafAlt },
        { x: -0.24, y: height * 0.58, z: -0.02, rz: 0.72, color: palette.leaf },
      ].map((leaf) => (
        <mesh key={leaf.x} position={[leaf.x, leaf.y, leaf.z]} rotation={[0.2, 0, leaf.rz]} scale={[0.9, 0.38, 0.6]} castShadow>
          <sphereGeometry args={[0.22, 16, 10]} />
          <meshStandardMaterial color={leaf.color} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function BloomTreeModel({ seed, palette }: { seed: number; palette: GardenPalette }) {
  const fruitColor = palette.fruit[seed % palette.fruit.length];

  if (palette.treeStyle === 'pine') {
    return (
      <group scale={[0.92, 0.92, 0.92]}>
        <mesh position={[0, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.24, 1.9, 10]} />
          <meshStandardMaterial color={palette.trunk} roughness={0.95} />
        </mesh>
        {[
          { y: 1.35, r: 1.28, h: 1.25, color: palette.leafDark },
          { y: 2.0, r: 1.05, h: 1.18, color: palette.leaf },
          { y: 2.62, r: 0.78, h: 1.05, color: palette.leafAlt },
          { y: 3.14, r: 0.48, h: 0.78, color: palette.leaf },
        ].map((tier, index) => (
          <mesh key={index} position={[0, tier.y, 0]} rotation={[0, seed * 0.01 + index * 0.25, 0]} castShadow>
            <coneGeometry args={[tier.r, tier.h, 9]} />
            <meshStandardMaterial color={tier.color} roughness={0.86} flatShading />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((cone) => {
          const angle = cone * 1.7 + seed * 0.03;
          return (
            <mesh key={cone} position={[Math.cos(angle) * 0.45, 1.75 + cone * 0.22, Math.sin(angle) * 0.45]} rotation={[0.4, angle, 0.2]} castShadow>
              <coneGeometry args={[0.08, 0.18, 7]} />
              <meshStandardMaterial color={palette.fruit[cone % palette.fruit.length]} roughness={0.9} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (palette.treeStyle === 'cherry') {
    return (
      <group scale={[0.9, 0.9, 0.9]}>
        <mesh position={[0, 0.9, 0]} rotation={[0.08, 0, -0.06]} castShadow>
          <cylinderGeometry args={[0.11, 0.23, 1.8, 12]} />
          <meshStandardMaterial color={palette.trunk} roughness={0.94} />
        </mesh>
        {BRANCHES.map((branch, index) => (
          <TreeBranch key={index} {...branch} color={palette.trunkLight} />
        ))}
        {[
          { position: [0, 2.34, 0] as [number, number, number], scale: [1.08, 0.78, 1.02] as [number, number, number], color: palette.leafAlt },
          { position: [-0.55, 2.04, 0.04] as [number, number, number], scale: [0.82, 0.62, 0.76] as [number, number, number], color: palette.fruit[0] },
          { position: [0.54, 2.08, -0.08] as [number, number, number], scale: [0.82, 0.62, 0.76] as [number, number, number], color: palette.fruit[1] },
          { position: [0.08, 1.82, 0.46] as [number, number, number], scale: [0.68, 0.5, 0.64] as [number, number, number], color: '#ffd1df' },
          { position: [-0.08, 1.78, -0.46] as [number, number, number], scale: [0.64, 0.48, 0.58] as [number, number, number], color: palette.leafAlt },
        ].map((cluster, index) => (
          <mesh key={index} position={cluster.position} scale={cluster.scale} rotation={[0.1 * index, seed * 0.02 + index, 0.08 * index]} castShadow>
            <dodecahedronGeometry args={[0.78, 1]} />
            <meshStandardMaterial color={cluster.color} roughness={0.72} />
          </mesh>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((petal) => {
          const angle = petal * 0.9 + seed * 0.04;
          return (
            <mesh key={petal} position={[Math.cos(angle) * 0.75, 1.65 + (petal % 4) * 0.22, Math.sin(angle) * 0.62]} scale={[0.16, 0.07, 0.12]} rotation={[0.3, angle, 0.2]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={palette.fruit[petal % palette.fruit.length]} roughness={0.7} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (palette.treeStyle === 'moon') {
    return (
      <group scale={[0.9, 0.9, 0.9]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.2, 1.8, 8]} />
          <meshStandardMaterial color={palette.trunk} roughness={0.82} metalness={0.08} />
        </mesh>
        {[0, 1, 2].map((tier) => (
          <mesh key={tier} position={[0, 1.55 + tier * 0.55, 0]} rotation={[0.15 * tier, seed * 0.02 + tier * 0.6, 0.1]} scale={[1 - tier * 0.18, 0.78 - tier * 0.08, 1 - tier * 0.18]} castShadow>
            <octahedronGeometry args={[0.9, 1]} />
            <meshStandardMaterial color={[palette.leafDark, palette.leaf, palette.leafAlt][tier]} emissive={[palette.leafDark, palette.leaf, palette.leafAlt][tier]} emissiveIntensity={0.18} roughness={0.55} />
          </mesh>
        ))}
        {[0, 1, 2, 3, 4].map((glow) => {
          const angle = glow * 1.25 + seed * 0.03;
          return (
            <mesh key={glow} position={[Math.cos(angle) * 0.64, 1.85 + (glow % 3) * 0.28, Math.sin(angle) * 0.64]}>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshStandardMaterial color={palette.fruit[glow % palette.fruit.length]} emissive={palette.fruit[glow % palette.fruit.length]} emissiveIntensity={0.55} roughness={0.4} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (palette.treeStyle === 'palm') {
    return (
      <group scale={[0.9, 0.9, 0.9]}>
        <mesh position={[0, 1.08, 0]} rotation={[0.12, 0, 0.08]} castShadow>
          <cylinderGeometry args={[0.12, 0.24, 2.16, 9]} />
          <meshStandardMaterial color={palette.trunk} roughness={0.92} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((leaf) => {
          const angle = leaf * Math.PI / 3 + seed * 0.01;
          return (
            <mesh key={leaf} position={[Math.cos(angle) * 0.48, 2.34, Math.sin(angle) * 0.48]} rotation={[0.25, -angle, leaf % 2 ? -0.75 : 0.75]} scale={[1.55, 0.28, 0.62]} castShadow>
              <sphereGeometry args={[0.34, 18, 10]} />
              <meshStandardMaterial color={[palette.leaf, palette.leafAlt, palette.leafDark][leaf % 3]} roughness={0.78} />
            </mesh>
          );
        })}
        {[0, 1, 2].map((fruit) => {
          const angle = fruit * 2.1 + seed * 0.02;
          return (
            <mesh key={fruit} position={[Math.cos(angle) * 0.22, 2.05, Math.sin(angle) * 0.22]} castShadow>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial color={palette.fruit[fruit % palette.fruit.length]} roughness={0.55} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (palette.treeStyle === 'mushroom') {
    return (
      <group scale={[0.95, 0.95, 0.95]}>
        {[0, 1, 2].map((cap) => {
          const angle = cap * 2.2 + seed * 0.01;
          const size = 1 - cap * 0.22;
          return (
            <group key={cap} position={[Math.cos(angle) * cap * 0.28, cap * 0.18, Math.sin(angle) * cap * 0.28]} scale={[size, size, size]}>
              <mesh position={[0, 0.78, 0]} scale={[0.72, 1.25, 0.72]} castShadow>
                <capsuleGeometry args={[0.18, 0.92, 8, 14]} />
                <meshStandardMaterial color={palette.trunkLight} emissive={palette.trunkLight} emissiveIntensity={0.16} roughness={0.7} />
              </mesh>
              <mesh position={[0, 1.52, 0]} scale={[1.32, 0.5, 1.32]} castShadow>
                <sphereGeometry args={[0.58, 24, 14]} />
                <meshStandardMaterial color={cap % 2 ? palette.leaf : palette.leafAlt} emissive={cap % 2 ? palette.leaf : palette.leafAlt} emissiveIntensity={0.28} roughness={0.54} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (palette.treeStyle === 'cactus') {
    return (
      <group scale={[0.95, 0.95, 0.95]}>
        <mesh position={[0, 1.05, 0]} castShadow>
          <capsuleGeometry args={[0.28, 1.72, 8, 16]} />
          <meshStandardMaterial color={palette.leafDark} roughness={0.86} />
        </mesh>
        {[
          { x: 0.42, y: 1.28, r: -0.72 },
          { x: -0.4, y: 0.94, r: 0.72 },
        ].map((arm, index) => (
          <mesh key={index} position={[arm.x, arm.y, 0]} rotation={[0, 0, arm.r]} castShadow>
            <capsuleGeometry args={[0.13, 0.82, 8, 14]} />
            <meshStandardMaterial color={index ? palette.leafAlt : palette.leaf} roughness={0.86} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((flower) => {
          const angle = flower * 1.55 + seed * 0.02;
          return (
            <mesh key={flower} position={[Math.cos(angle) * 0.18, 1.95 + (flower % 2) * 0.12, Math.sin(angle) * 0.18]} scale={[0.18, 0.08, 0.18]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={palette.fruit[flower % palette.fruit.length]} roughness={0.6} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (palette.treeStyle === 'ice') {
    return (
      <group scale={[0.95, 0.95, 0.95]}>
        {[0, 1, 2, 3].map((crystal) => {
          const angle = crystal * 1.4 + seed * 0.01;
          return (
            <mesh key={crystal} position={[Math.cos(angle) * crystal * 0.12, 0.78 + crystal * 0.26, Math.sin(angle) * crystal * 0.12]} rotation={[0.2, angle, 0.15]} scale={[0.55 - crystal * 0.06, 1.25 - crystal * 0.12, 0.55 - crystal * 0.06]} castShadow>
              <octahedronGeometry args={[0.72, 1]} />
              <meshStandardMaterial color={[palette.leafAlt, palette.leaf, '#ffffff'][crystal % 3]} emissive={palette.leaf} emissiveIntensity={0.18} roughness={0.22} metalness={0.08} transparent opacity={0.84} />
            </mesh>
          );
        })}
      </group>
    );
  }

  return (
    <group scale={[0.9, 0.9, 0.9]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.24, 1.7, 12]} />
        <meshStandardMaterial color={palette.trunk} roughness={0.94} />
      </mesh>
      <mesh position={[0.02, 1.72, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.15, 1.2, 10]} />
        <meshStandardMaterial color={palette.trunkLight} roughness={0.94} />
      </mesh>

      {BRANCHES.map((branch, index) => (
        <TreeBranch key={index} {...branch} color={palette.trunk} />
      ))}

      {CANOPY_CLUSTERS.map((cluster, index) => (
        <mesh
          key={index}
          position={cluster.position}
          scale={cluster.scale}
          rotation={[0.18 * index, seed * 0.02 + index * 0.7, 0.08 * index]}
          castShadow
        >
          <dodecahedronGeometry args={[0.78, 1]} />
          <meshStandardMaterial color={[palette.leaf, palette.leafAlt, palette.leafDark][index % 3]} roughness={0.76} />
        </mesh>
      ))}

      {[0, 1, 2, 3, 4, 5].map((fruit) => {
        const angle = fruit * 1.16 + seed * 0.04;
        const radius = 0.48 + (fruit % 2) * 0.18;
        return (
          <mesh
            key={fruit}
            position={[Math.cos(angle) * radius, 1.9 + (fruit % 3) * 0.18, Math.sin(angle) * radius]}
            castShadow
          >
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshStandardMaterial color={fruitColor} emissive={fruitColor} emissiveIntensity={0.12} roughness={0.55} />
          </mesh>
        );
      })}
    </group>
  );
}

function WitheredTreeModel({ palette }: { palette: GardenPalette }) {
  return (
    <group rotation={[0.18, 0, 0.38]}>
      <mesh position={[0, 0.65, 0]} rotation={[0.15, 0, -0.12]} castShadow>
        <cylinderGeometry args={[0.045, 0.13, 1.3, 8]} />
        <meshStandardMaterial color={palette.withered} roughness={1} />
      </mesh>
      <TreeBranch position={[0.18, 1.05, 0]} rotation={[0.08, 0, -0.96]} length={0.62} radius={0.024} color={palette.trunk} />
      <TreeBranch position={[-0.2, 0.9, -0.04]} rotation={[-0.15, 0.2, 0.92]} length={0.5} radius={0.02} color={palette.trunk} />
      <mesh position={[0.44, 1.25, 0.02]} rotation={[0.4, 0, -0.3]} scale={[0.42, 0.12, 0.26]}>
        <sphereGeometry args={[0.18, 12, 8]} />
        <meshStandardMaterial color={palette.withered} roughness={1} />
      </mesh>
      <mesh position={[-0.18, 0.04, 0.22]} rotation={[0.2, 0.3, -0.9]} scale={[0.5, 0.08, 0.28]}>
        <sphereGeometry args={[0.22, 12, 8]} />
        <meshStandardMaterial color={palette.withered} roughness={1} />
      </mesh>
    </group>
  );
}

function SurfacePatch({
  lat,
  lon,
  radius,
  color,
  stretch = 1,
  twist = 0,
  opacity = 1,
  altitude = 0.035,
}: {
  lat: number;
  lon: number;
  radius: number;
  color: string;
  stretch?: number;
  twist?: number;
  opacity?: number;
  altitude?: number;
}) {
  const { position, quaternion } = useMemo(() => getSurfaceTransform(lat, lon, PLANET_RADIUS + altitude), [lat, lon, altitude]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh rotation={[0, 0, twist]} scale={[radius * stretch, radius, 1]}>
        <circleGeometry args={[1, 28]} />
        <meshStandardMaterial color={color} roughness={0.88} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
      </mesh>
    </group>
  );
}

function SurfaceRock({ lat, lon, scale, color }: { lat: number; lon: number; scale: number; color: string }) {
  const { position, quaternion } = useMemo(() => getSurfaceTransform(lat, lon, PLANET_RADIUS + 0.14), [lat, lon]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh scale={[scale * 1.2, scale * 0.7, scale]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} roughness={0.96} />
      </mesh>
    </group>
  );
}

function PlanetSurface({ isDay, palette }: { isDay: boolean; palette: GardenPalette }) {
  return (
    <>
      <mesh receiveShadow castShadow>
        <icosahedronGeometry args={[PLANET_RADIUS, 5]} />
        <meshStandardMaterial 
          color={isDay ? palette.planet : palette.planetNight} 
          emissive={isDay ? palette.planet : palette.planetNight} 
          emissiveIntensity={isDay ? 0.18 : 0.58}
          roughness={0.92} 
          metalness={0.02}
          flatShading
        />
      </mesh>

      <mesh scale={[1.004, 1.004, 1.004]} receiveShadow>
        <icosahedronGeometry args={[PLANET_RADIUS, 4]} />
        <meshStandardMaterial
          color={palette.planetOverlay}
          transparent
          opacity={isDay ? 0.18 : 0.12}
          roughness={1}
          depthWrite={false}
          flatShading
        />
      </mesh>

      {PLANET_PATCHES.map((patch, index) => (
        <SurfacePatch
          key={`${patch.lat}-${patch.lon}`}
          lat={patch.lat}
          lon={patch.lon}
          radius={patch.radius}
          color={isDay ? palette.patchColors[index % palette.patchColors.length] : palette.planetNight}
          stretch={patch.stretch}
          twist={patch.twist}
        />
      ))}

      {PLANET_LAKES.map((lake) => (
        <SurfacePatch
          key={`${lake.lat}-${lake.lon}`}
          lat={lake.lat}
          lon={lake.lon}
          radius={lake.radius}
          color={isDay ? palette.water : palette.waterNight}
          stretch={lake.stretch}
          twist={lake.twist}
          opacity={0.86}
          altitude={0.055}
        />
      ))}

      {PLANET_ROCKS.map((rock) => (
        <SurfaceRock key={`${rock.lat}-${rock.lon}`} lat={rock.lat} lon={rock.lon} scale={rock.scale} color={palette.rock} />
      ))}

      {CLOUD_PATCHES.map((cloud) => (
        <SurfacePatch
          key={`${cloud.lat}-${cloud.lon}`}
          lat={cloud.lat}
          lon={cloud.lon}
          radius={cloud.radius}
          color="#ffffff"
          stretch={cloud.stretch}
          twist={cloud.twist}
          opacity={isDay ? 0.2 : 0.12}
          altitude={0.42}
        />
      ))}
    </>
  );
}

function CompanionMoon({ palette }: { palette: GardenPalette }) {
  const moonRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (moonRef.current) {
      moonRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      moonRef.current.position.y = 16 + Math.sin(state.clock.elapsedTime * 0.22) * 0.35;
    }
  });

  return (
    <group ref={moonRef} position={[-34, 16, -44]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[4.2, 48, 48]} />
        <meshStandardMaterial
          color={palette.moon}
          emissive={palette.moon}
          emissiveIntensity={0.16}
          roughness={0.95}
        />
      </mesh>

      {[
        { position: [1.6, 1.1, 3.7] as [number, number, number], scale: [0.82, 0.42, 0.16] as [number, number, number], rotation: [0.1, -0.18, 0.5] as [number, number, number] },
        { position: [-1.3, -0.7, 3.9] as [number, number, number], scale: [0.58, 0.34, 0.12] as [number, number, number], rotation: [0.04, 0.12, -0.4] as [number, number, number] },
        { position: [0.2, -1.9, 3.6] as [number, number, number], scale: [0.44, 0.26, 0.1] as [number, number, number], rotation: [0.12, -0.08, 0.2] as [number, number, number] },
        { position: [-2.2, 1.5, 3.2] as [number, number, number], scale: [0.38, 0.24, 0.08] as [number, number, number], rotation: [0.2, 0.2, -0.1] as [number, number, number] },
      ].map((crater, index) => (
        <mesh
          key={index}
          position={crater.position}
          rotation={crater.rotation}
          scale={crater.scale}
        >
          <sphereGeometry args={[1, 20, 12]} />
          <meshStandardMaterial color="#aaa28e" roughness={1} />
        </mesh>
      ))}

      <mesh scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[4.2, 48, 48]} />
        <meshStandardMaterial
          color="#f5eed8"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <pointLight color="#d8f3ff" intensity={1.2} distance={80} />
    </group>
  );
}

function DaySun({ raining }: { raining: boolean }) {
  const sunRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (sunRef.current) {
      const t = state.clock.elapsedTime;
      const pulse = 1 + Math.sin(t * 0.6) * 0.025;
      sunRef.current.scale.set(pulse, pulse, pulse);
      sunRef.current.rotation.z = t * 0.04;
    }
  });

  return (
    <group ref={sunRef} position={[38, 30, -42]}>
      <mesh>
        <sphereGeometry args={[5.4, 48, 48]} />
        <meshStandardMaterial
          color={raining ? '#ffe1a6' : '#ffd166'}
          emissive={raining ? '#ffc86b' : '#ffb703'}
          emissiveIntensity={raining ? 0.38 : 0.72}
          roughness={0.45}
        />
      </mesh>
      <mesh scale={[1.55, 1.55, 1.55]}>
        <sphereGeometry args={[5.4, 48, 48]} />
        <meshStandardMaterial
          color="#fff3b0"
          transparent
          opacity={raining ? 0.05 : 0.09}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#ffdca3" intensity={raining ? 0.55 : 1.15} distance={120} />
    </group>
  );
}

function RainClouds({ palette }: { palette: GardenPalette }) {
  const cloudRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.08;
      cloudRef.current.position.y = 24 + Math.sin(state.clock.elapsedTime * 0.35) * 0.35;
    }
  });

  return (
    <group ref={cloudRef} position={[0, 24, -8]}>
      {[
        { position: [-9, 0, 0] as [number, number, number], scale: [5.2, 1.45, 2.1] as [number, number, number] },
        { position: [-4.5, 1, 1.2] as [number, number, number], scale: [4.8, 1.8, 2.4] as [number, number, number] },
        { position: [1.5, 0.35, 0] as [number, number, number], scale: [5.8, 1.55, 2.2] as [number, number, number] },
        { position: [7, 0.8, 1.1] as [number, number, number], scale: [4.4, 1.35, 2] as [number, number, number] },
      ].map((cloud, index) => (
        <mesh key={index} position={cloud.position} scale={cloud.scale}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={palette.skyNight} transparent opacity={0.28} roughness={0.9} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function AmbientClouds({ palette, compact }: { palette: GardenPalette; compact: boolean }) {
  const cloudRef = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const base = [
      { position: [-30, 23, -34] as [number, number, number], scale: 1.1, speed: 0.07 },
      { position: [28, 18, -38] as [number, number, number], scale: 0.82, speed: 0.05 },
      { position: [-18, 30, -46] as [number, number, number], scale: 0.7, speed: 0.045 },
      { position: [8, 27, -50] as [number, number, number], scale: 0.95, speed: 0.058 },
      { position: [38, 31, -30] as [number, number, number], scale: 0.62, speed: 0.04 },
    ];
    return compact ? base.slice(0, 3) : base;
  }, [compact]);

  useFrame((state) => {
    if (!cloudRef.current) return;
    const t = state.clock.elapsedTime;
    cloudRef.current.children.forEach((child, index) => {
      const cloud = clouds[index];
      child.position.x = cloud.position[0] + Math.sin(t * cloud.speed + index) * 1.2;
      child.position.y = cloud.position[1] + Math.cos(t * cloud.speed * 1.4 + index) * 0.35;
    });
  });

  return (
    <group ref={cloudRef}>
      {clouds.map((cloud, index) => (
        <group key={index} position={cloud.position} scale={[cloud.scale, cloud.scale, cloud.scale]}>
          {[
            { position: [-2.1, 0, 0] as [number, number, number], scale: [2.8, 0.78, 1] as [number, number, number] },
            { position: [0, 0.35, 0] as [number, number, number], scale: [3.4, 1.05, 1.15] as [number, number, number] },
            { position: [2.2, 0.05, 0] as [number, number, number], scale: [2.6, 0.72, 0.95] as [number, number, number] },
          ].map((part, partIndex) => (
            <mesh key={partIndex} position={part.position} scale={part.scale}>
              <sphereGeometry args={[1, 16, 10]} />
              <meshStandardMaterial
                color={palette.sparkles}
                transparent
                opacity={0.18}
                roughness={1}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function RainField({ palette, compact }: { palette: GardenPalette; compact: boolean }) {
  const rainRef = useRef<THREE.Group>(null);
  const drops = useMemo(() => {
    return Array.from({ length: compact ? 70 : 130 }, (_, index) => {
      const angle = index * 2.399963;
      const radius = 14 + ((index * 17) % 24);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = -5 + ((index * 19) % 42);
      const length = 0.8 + ((index * 7) % 8) * 0.08;
      return { x, y, z, length };
    });
  }, [compact]);

  useFrame((state) => {
    if (rainRef.current) {
      const fall = (state.clock.elapsedTime * 8) % 18;
      rainRef.current.position.y = -fall;
    }
  });

  return (
    <group ref={rainRef}>
      {drops.map((drop, index) => (
        <Line
          key={index}
          points={[
            [drop.x, drop.y, drop.z],
            [drop.x - 0.22, drop.y - drop.length, drop.z + 0.12],
          ]}
          color={palette.water}
          opacity={0.34}
          transparent
          lineWidth={1.2}
        />
      ))}
    </group>
  );
}

function Plant3D({
  note,
  position,
  palette,
  selected,
  needsWater,
  nourished,
  routeActive,
  dimmed,
  showLabel,
  onClick,
}: {
  note: SeedNote;
  position: [number, number, number];
  palette: GardenPalette;
  selected: boolean;
  needsWater: boolean;
  nourished: boolean;
  routeActive: boolean;
  dimmed: boolean;
  showLabel: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const { growthStage, isGrowth, tasks } = note;

  const [spawned, setSpawned] = useState(false);
  useEffect(() => {
    setSpawned(false);
    const timer = window.setTimeout(() => setSpawned(true), 100 + (note.id.length % 10) * 50);
    return () => window.clearTimeout(timer);
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

  const targetScale = useMemo(() => {
    if (!spawned) return 0;
    if (nourished) return 1.72;
    if (selected) return 1.58;
    if (hovered) return 1.42;
    if (routeActive) return 1.26;
    if (dimmed) return 0.72;
    return 1;
  }, [spawned, hovered, selected, routeActive, dimmed, nourished]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const scaleDamping = 1 - Math.exp(-delta * 9);
      const s = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, scaleDamping);
      meshRef.current.scale.set(s, s, s);
      
      if (growthStage !== 'withered') {
        const t = state.clock.elapsedTime + (note.id.length % 10);
        const offset = Math.sin(t * 1.5) * 0.15 + Math.cos(t * 0.8) * 0.05;
        meshRef.current.position.y = offset;
        
        meshRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
        meshRef.current.rotation.x = Math.cos(t * 0.4) * 0.1;
      }
    }

    if (haloRef.current) {
      const t = state.clock.elapsedTime + note.id.length;
      const pulse = nourished ? 1.25 + Math.sin(t * 5) * 0.16 : selected ? 1.12 : 1 + Math.sin(t * 2.6) * 0.1;
      haloRef.current.scale.set(pulse, pulse, pulse);
      if (haloRef.current.material instanceof THREE.MeshStandardMaterial) {
        haloRef.current.material.opacity = nourished ? 0.92 : selected ? 0.82 : 0.42 + Math.sin(t * 2.6) * 0.14;
      }
    }
  });

  const renderModel = () => {
    const seedValue = note.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    if (growthStage === 'bloom') {
      return <BloomTreeModel seed={seedValue} palette={palette} />;
    }

    if (growthStage === 'withered') {
      return <WitheredTreeModel palette={palette} />;
    }

    if (isGrowth) {
      return <SproutTreeModel progress={progress} palette={palette} />;
    }

    return <SeedModel hovered={hovered} palette={palette} />;
  };

  return (
    <group 
      position={position}
      quaternion={quaternion}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {(needsWater || selected || routeActive || nourished) && (
        <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <torusGeometry args={[nourished ? 0.82 : selected ? 0.7 : routeActive ? 0.62 : 0.52, nourished ? 0.035 : 0.025, 8, 48]} />
          <meshStandardMaterial
            color={nourished ? palette.water : selected ? '#ffffff' : routeActive ? palette.sparkles : palette.connection}
            emissive={nourished ? palette.water : selected ? '#ffffff' : routeActive ? palette.sparkles : palette.connection}
            emissiveIntensity={nourished ? 1.1 : selected ? 0.8 : 0.45}
            transparent
            opacity={0.54}
            depthWrite={false}
          />
        </mesh>
      )}
      {nourished && (
        <Sparkles count={18} scale={2.4} size={4} speed={1.8} opacity={0.85} color={palette.water} />
      )}
      {needsWater && (
        <mesh position={[0, 0.72, 0]} scale={[0.16, 0.16, 0.16]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={palette.water} emissive={palette.water} emissiveIntensity={0.45} roughness={0.35} />
        </mesh>
      )}
      <group ref={meshRef}>
        <IdeaPotModel palette={palette} stage={growthStage} selected={selected} needsWater={needsWater} />
        {renderModel()}
      </group>
      {showLabel && (
        <Html position={[0, growthStage === 'bloom' ? 3.45 : growthStage === 'sprout' ? 2.45 : 1.75, 0]} center distanceFactor={compactLabelDistance(growthStage)}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
            className={`max-w-32 rounded-full border px-2.5 py-1 text-[10px] font-black leading-tight shadow-xl backdrop-blur-xl transition ${
              selected
                ? 'border-white bg-white text-slate-950'
                : routeActive
                  ? 'border-yellow-200/80 bg-yellow-100/90 text-yellow-950'
                  : needsWater
                    ? 'border-sky-200/80 bg-sky-100/90 text-sky-950'
                    : 'border-white/25 bg-black/35 text-white'
            }`}
          >
            <span className="block truncate">{note.title}</span>
          </button>
        </Html>
      )}
    </group>
  );
}

function compactLabelDistance(stage: SeedNote['growthStage']) {
  if (stage === 'bloom') return 13;
  if (stage === 'sprout') return 15;
  return 17;
}

function ConnectionLine({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  const pulseRef = useRef<THREE.Group>(null);
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

  useFrame((state) => {
    if (pulseRef.current) {
      const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 1.6) * 0.5;
      pulseRef.current.children.forEach((child) => {
        if (child instanceof THREE.Line && child.material instanceof THREE.LineBasicMaterial) {
          child.material.opacity = 0.12 + pulse * 0.18;
        }
      });
    }
  });
  
  return (
    <group ref={pulseRef}>
      <Line
        points={points}
        color={color}
        opacity={0.32}
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

function Atmosphere({ isDay, palette }: { isDay: boolean; palette: GardenPalette }) {
  const atmosphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (atmosphereRef.current) {
      const t = state.clock.getElapsedTime();
      const scale = 1 + Math.sin(t * 0.5) * 0.02;
      atmosphereRef.current.scale.set(scale, scale, scale);
      
      if (atmosphereRef.current.material instanceof THREE.MeshStandardMaterial) {
        atmosphereRef.current.material.opacity = (isDay ? 0.18 : 0.28) + Math.sin(t * 0.8) * 0.055;
      }
    }
  });

  return (
    <mesh ref={atmosphereRef}>
      <sphereGeometry args={[PLANET_RADIUS + 1, 64, 64]} />
      <meshStandardMaterial 
        color={palette.atmosphere} 
        transparent 
        opacity={0.18} 
        side={THREE.BackSide} 
      />
    </mesh>
  );
}

function PlanetSystem({
  plants,
  connections,
  isDay,
  palette,
  selectedId,
  routeIds,
  recentlyWateredId,
  compact,
  showLabels,
  controlsRef,
  onSelectNote,
}: {
  plants: { note: SeedNote; position: [number, number, number] }[];
  connections: { start: [number, number, number]; end: [number, number, number]; id: string }[];
  isDay: boolean;
  palette: GardenPalette;
  selectedId: string | null;
  routeIds: string[];
  recentlyWateredId?: string | null;
  compact: boolean;
  showLabels: boolean;
  controlsRef: MutableRefObject<any>;
  onSelectNote: (id: string) => void;
}) {
  const planetRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const selectedPlant = useMemo(() => plants.find(plant => plant.note.id === selectedId), [plants, selectedId]);

  useFrame((state, delta) => {
    if (planetRef.current) {
      if (!selectedId) {
        planetRef.current.rotation.y += delta * 0.025;
        planetRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.45) * 0.015;
        if (controlsRef.current && controlsRef.current.target.lengthSq() > 0.01) {
          const damping = 1 - Math.exp(-delta * 2.4);
          controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), damping);
          controlsRef.current.update();
        }
      }

      if (selectedPlant) {
        const worldTarget = planetRef.current.localToWorld(new THREE.Vector3(...selectedPlant.position));
        const normal = worldTarget.clone().normalize();
        const cameraTarget = worldTarget.clone().add(normal.multiplyScalar(compact ? 19 : 17)).add(new THREE.Vector3(0, compact ? 3 : 4, 0));
        const damping = 1 - Math.exp(-delta * 3.5);

        camera.position.lerp(cameraTarget, damping);
        if (controlsRef.current) {
          controlsRef.current.target.lerp(worldTarget, damping);
          controlsRef.current.update();
        } else {
          camera.lookAt(worldTarget);
        }
      }
    }
  });

  return (
    <group ref={planetRef}>
      <PlanetSurface isDay={isDay} palette={palette} />
      
      <Atmosphere isDay={isDay} palette={palette} />

      <Sparkles 
        count={compact ? (isDay ? 45 : 120) : (isDay ? 100 : 300)} 
        scale={PLANET_RADIUS * 3.5} 
        size={5} 
        speed={0.4} 
        opacity={0.6} 
        color={palette.sparkles} 
      />

      {connections.map((connection) => (
        <ConnectionLine
          key={connection.id}
          start={connection.start}
          end={connection.end}
          color={palette.connection}
        />
      ))}
      
      {plants.map(({ note, position }) => (
        <Plant3D
          key={note.id}
          note={note}
          position={position}
          palette={palette}
          selected={selectedId === note.id}
          needsWater={wateringDue(note) && note.growthStage !== 'bloom' && !note.paused}
          nourished={recentlyWateredId === note.id}
          routeActive={routeIds.includes(note.id)}
          dimmed={routeIds.length > 0 && !routeIds.includes(note.id)}
          showLabel={
            showLabels && (
              plants.length <= 18
              || selectedId === note.id
              || routeIds.includes(note.id)
              || wateringDue(note)
              || note.growthStage === 'bloom'
            )
          }
          onClick={() => onSelectNote(note.id)}
        />
      ))}
    </group>
  );
}

function progressFor(note: SeedNote) {
  if (!note.tasks.length) return 0;
  return Math.round((note.tasks.filter(task => task.completed).length / note.tasks.length) * 100);
}

function nextOpenTask(note: SeedNote) {
  return note.tasks.find(task => !task.completed)?.text || 'Define el siguiente paso';
}

function formatDue(date?: number) {
  if (!date) return 'Sin fecha';
  return new Date(date).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function formatWatered(note: SeedNote) {
  const source = note.lastWateredAt || note.updatedAt || note.createdAt;
  const days = daysSince(source);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} dias`;
}

function stageLabel(note: SeedNote) {
  if (note.paused) return 'Pausada';
  if (wateringDue(note) && note.growthStage !== 'bloom') return 'Pide riego';
  if (note.growthStage === 'bloom') return 'Lista para cosechar';
  if (note.growthStage === 'sprout') return 'En crecimiento';
  if (note.growthStage === 'withered') return 'Marchita';
  return 'Semilla nueva';
}

function seedTypeLabel(note: SeedNote) {
  if (note.seedType === 'project') return 'Proyecto';
  if (note.seedType === 'goal') return 'Meta';
  if (note.seedType === 'learning') return 'Aprendizaje';
  return 'Idea';
}

export default function Garden3D({
  notes,
  theme,
  planetName,
  onSelectNote,
  onReviewNote,
  onFocusNote,
  recentlyWateredId,
  variant = 'app',
  fullscreen = false,
}: {
  notes: SeedNote[];
  theme: Theme;
  planetName?: string;
  onSelectNote: (id: string) => void;
  onReviewNote?: (id: string) => void;
  onFocusNote?: (id: string) => void;
  recentlyWateredId?: string | null;
  variant?: 'app' | 'preview';
  fullscreen?: boolean;
}) {
  const palette = GARDEN_PALETTES[theme];
  const isPreview = variant === 'preview';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<GardenFilter>('all');
  const [routeIds, setRouteIds] = useState<string[]>([]);
  const [showLabels, setShowLabels] = useState(true);
  const [compact3D, setCompact3D] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const update = () => setCompact3D(window.innerWidth < 760);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isDay = useMemo(() => {
    if (theme === 'night') return false;
    const hour = new Date().getHours();
    return hour >= 6 && hour < 19;
  }, [theme]);

  const stats = useMemo(() => ({
    water: notes.filter(note => wateringDue(note) && note.growthStage !== 'bloom' && !note.paused).length,
    progress: notes.filter(note => note.isGrowth && note.growthStage !== 'bloom' && !note.paused).length,
    harvest: notes.filter(note => note.growthStage === 'bloom').length,
  }), [notes]);

  const isRaining = !isPreview && (stats.water >= 3 || (stats.progress >= 4 && stats.water / stats.progress >= 0.45));
  const skyColor = isDay ? (isRaining ? '#6fa6c9' : palette.skyDay) : palette.skyNight;
  const weatherCopy = isRaining
    ? 'Lluvia suave: revisa solo lo esencial'
    : isDay
      ? 'Sol activo: buen momento para avanzar'
      : 'Noche tranquila: enfoca sin ruido';

  const visibleNotes = useMemo(() => {
    return notes.filter((note) => {
      if (filter === 'water') return wateringDue(note) && note.growthStage !== 'bloom' && !note.paused;
      if (filter === 'progress') return note.isGrowth && note.growthStage !== 'bloom' && !note.paused;
      if (filter === 'harvest') return note.growthStage === 'bloom';
      return true;
    });
  }, [filter, notes]);

  const routeCandidates = useMemo(() => {
    const picked: SeedNote[] = [];
    const add = (note?: SeedNote) => {
      if (note && !picked.some(item => item.id === note.id)) picked.push(note);
    };

    add(notes.find(note => wateringDue(note) && note.growthStage !== 'bloom' && !note.paused));
    add(notes.find(note => note.isGrowth && note.growthStage !== 'bloom' && !note.paused && note.tasks.some(task => !task.completed)));
    add([...notes]
      .filter(note => note.dueDate && note.growthStage !== 'bloom' && !note.paused)
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))[0]);

    if (isRaining) {
      const rainyEssentials = [...notes]
        .filter(note => wateringDue(note) && note.growthStage !== 'bloom' && !note.paused)
        .sort((a, b) => daysSince(b.lastWateredAt || b.createdAt) - daysSince(a.lastWateredAt || a.createdAt));
      return rainyEssentials.slice(0, 3);
    }

    return picked.slice(0, 3);
  }, [isRaining, notes]);

  const selectedNote = useMemo(() => notes.find(note => note.id === selectedId) || null, [notes, selectedId]);

  useEffect(() => {
    if (selectedId && !notes.some(note => note.id === selectedId)) setSelectedId(null);
  }, [notes, selectedId]);

  const plants = useMemo(() => {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const count = Math.max(visibleNotes.length, 1);

    return visibleNotes.map((note, index) => {
      const seed = note.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const jitter = ((seed % 37) / 37 - 0.5) * 0.16;
      const yUnit = THREE.MathUtils.clamp(1 - (2 * (index + 0.5)) / count + jitter, -0.96, 0.96);
      const radiusAtY = Math.sqrt(1 - yUnit * yUnit);
      const theta = index * goldenAngle + ((seed % 997) / 997) * Math.PI * 2;

      const x = PLANET_RADIUS * radiusAtY * Math.cos(theta);
      const y = PLANET_RADIUS * yUnit;
      const z = PLANET_RADIUS * radiusAtY * Math.sin(theta);
      
      return { note, position: [x, y, z] as [number, number, number] };
    });
  }, [visibleNotes]);

  const connections = useMemo(() => {
    const byId = new Map(plants.map((plant) => [plant.note.id, plant.position]));
    return plants.flatMap(({ note, position }) => {
      return (note.connections || [])
        .map((targetId) => {
          const targetPosition = byId.get(targetId);
          return targetPosition ? { start: position, end: targetPosition, id: `${note.id}-${targetId}` } : null;
        })
        .filter((connection): connection is { start: [number, number, number]; end: [number, number, number]; id: string } => Boolean(connection));
    });
  }, [plants]);

  return (
    <div className={`w-full overflow-hidden shadow-2xl relative border-white/10 backdrop-blur-md transition-colors duration-1000 ${
      fullscreen
        ? 'h-screen min-h-screen rounded-none border-0'
        : isPreview
          ? 'h-[31rem] min-h-[31rem] rounded-[2.5rem] border-[8px]'
          : 'h-[68vh] min-h-[520px] sm:h-[75vh] rounded-[2rem] sm:rounded-[3rem] border-[8px] sm:border-[12px]'
    }`}>
      <Canvas shadows camera={{ position: [40, 30, 40], fov: 45 }}>
        <color attach="background" args={[skyColor]} />
        
        <ambientLight intensity={isDay ? (isRaining ? 0.78 : 0.92) : 0.62} />
        <pointLight position={[50, 50, 50]} intensity={isRaining ? 0.92 : 1.35} castShadow />
        <directionalLight position={[-50, 50, -50]} intensity={isRaining ? 0.72 : 1.05} color={isDay ? "#fff1c7" : "#48cae4"} />
        <hemisphereLight intensity={0.78} color={isRaining ? "#cfefff" : "#ffffff"} groundColor="#11170f" />
        
        {isDay && <DaySun raining={isRaining} />}
        {isDay && !isRaining && <AmbientClouds palette={palette} compact={compact3D} />}
        {!isDay && (
          <>
            <Stars radius={150} depth={50} count={compact3D ? 1800 : 5000} factor={4} saturation={0} fade speed={1} />
            <CompanionMoon palette={palette} />
          </>
        )}
        {isRaining && (
          <>
            <RainClouds palette={palette} />
            <RainField palette={palette} compact={compact3D} />
          </>
        )}
        
        <PlanetSystem
          plants={plants}
          connections={connections}
          isDay={isDay}
          palette={palette}
          selectedId={selectedId}
          routeIds={routeIds}
          recentlyWateredId={recentlyWateredId}
          compact={compact3D}
          showLabels={showLabels}
          controlsRef={controlsRef}
          onSelectNote={(id) => setSelectedId(id)}
        />

        <Suspense fallback={null}>
          <Environment preset={isDay ? "park" : "city"} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={!isPreview}
          enableRotate={true}
          autoRotate={!selectedId}
          autoRotateSpeed={0.5}
          minDistance={25}
          maxDistance={90}
          makeDefault
        />
      </Canvas>
      
      <div className={`absolute pointer-events-none max-w-[55%] ${isPreview ? 'left-6 top-6' : 'top-5 left-5 sm:top-10 sm:left-10'}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${isRaining ? 'bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.7)]' : 'bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.7)]'} animate-pulse`} />
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/45">{planetName || 'Galaxy Garden'}</p>
        </div>
        <h4 className={`${isPreview ? 'text-4xl' : 'text-3xl sm:text-5xl'} font-serif text-white tracking-tight leading-none drop-shadow-xl`}>
          {palette.label}<br/><span className={`${isRaining ? 'text-sky-200/70' : 'text-yellow-200/70'} italic`}>{isRaining ? 'Lluvia' : 'Vivo'}</span>
        </h4>
        <p className="mt-3 hidden max-w-xs text-xs font-semibold leading-relaxed text-white/65 drop-shadow sm:block">{weatherCopy}</p>
      </div>

      <div className={`absolute grid grid-cols-3 gap-2 text-white ${isPreview ? 'right-6 top-6' : 'top-5 right-5 sm:top-10 sm:right-10'}`}>
        {[
          { id: 'water', label: 'Riego', value: stats.water },
          { id: 'progress', label: 'Activas', value: stats.progress },
          { id: 'harvest', label: 'Cosechas', value: stats.harvest },
        ].map(item => (
          <button
            key={item.label}
            type="button"
            disabled={isPreview || item.value === 0}
            onClick={() => {
              setFilter(filter === item.id ? 'all' : item.id as GardenFilter);
              setRouteIds([]);
              setSelectedId(null);
            }}
            className={`rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-center shadow-xl backdrop-blur-xl transition ${
              !isPreview && filter === item.id ? 'ring-2 ring-white/70 bg-white/18' : ''
            } ${!isPreview && item.value > 0 ? 'hover:bg-white/12' : 'cursor-default'}`}
          >
            <p className="text-lg font-black leading-none">{item.value}</p>
            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.22em] text-white/55">{item.label}</p>
          </button>
        ))}
      </div>

      {!isPreview && (
      <div className="absolute left-3 right-3 bottom-3 sm:left-1/2 sm:right-auto sm:w-[min(94vw,46rem)] sm:-translate-x-1/2 grid grid-cols-1 gap-2 rounded-[1.35rem] border border-white/20 bg-black/25 p-2 shadow-2xl backdrop-blur-2xl text-white sm:grid-cols-[1fr_auto]">
        <div className="grid min-w-0 grid-cols-4 gap-1">
          {[
            { id: 'all', label: 'Todo' },
            { id: 'water', label: 'Riego' },
            { id: 'progress', label: 'Activas' },
            { id: 'harvest', label: 'Cosecha' },
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFilter(item.id as GardenFilter);
                setRouteIds([]);
              }}
              className={`h-11 min-w-0 rounded-2xl px-2 text-[10px] font-black uppercase leading-none transition ${filter === item.id ? 'bg-white text-slate-950' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
            >
              <span className="block truncate">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 sm:w-56">
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setRouteIds(routeIds.length ? [] : routeCandidates.map(note => note.id));
              setSelectedId(routeIds.length ? null : routeCandidates[0]?.id || null);
            }}
            disabled={routeCandidates.length === 0}
            className={`h-11 min-w-0 rounded-2xl px-2 text-[10px] font-black uppercase leading-none transition ${routeIds.length ? 'bg-[var(--accent)] text-white' : 'bg-white/10 text-white hover:bg-white/18'} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <span className="block truncate">{isRaining ? 'Ruta suave' : 'Ruta hoy'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowLabels(current => !current)}
            className={`h-11 min-w-0 rounded-2xl px-2 text-[10px] font-black uppercase leading-none transition ${showLabels ? 'bg-white text-slate-950' : 'bg-white/10 text-white/65 hover:bg-white/18 hover:text-white'}`}
          >
            <span className="block truncate">Nombres</span>
          </button>
        </div>
      </div>
      )}

      {selectedNote && !isPreview && (
        <div className="absolute left-4 right-4 bottom-32 sm:left-auto sm:right-8 sm:top-28 sm:bottom-auto sm:w-[22rem] sm:max-w-[22rem] rounded-[2rem] border border-white/20 bg-white/92 p-5 shadow-2xl backdrop-blur-2xl text-[var(--earth)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--text-muted)]">
                {seedTypeLabel(selectedNote)} · {stageLabel(selectedNote)}
              </p>
              <h5 className="mt-2 text-2xl font-serif font-bold leading-tight">{selectedNote.title}</h5>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--paper-soft)] text-lg font-black text-[var(--text-muted)]"
              aria-label="Cerrar detalle"
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-[var(--paper-soft)] px-2 py-3">
              <p className="text-lg font-black">{progressFor(selectedNote)}%</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Avance</p>
            </div>
            <div className="rounded-2xl bg-[var(--paper-soft)] px-2 py-3">
              <p className="text-lg font-black">{selectedNote.tasks.filter(task => !task.completed).length}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Pasos</p>
            </div>
            <div className="rounded-2xl bg-[var(--paper-soft)] px-2 py-3">
              <p className="text-sm font-black leading-5">{formatWatered(selectedNote)}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Riego</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-white/70 px-3 py-2">
              <p className="text-xs font-black">{formatDue(selectedNote.dueDate)}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Fecha</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-3 py-2">
              <p className="text-xs font-black">{selectedNote.connections?.length || 0} enlaces</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Mapa</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--soil)]/10 bg-white/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Siguiente paso</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--earth)]">{nextOpenTask(selectedNote)}</p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onSelectNote(selectedNote.id)}
              className="rounded-2xl bg-[var(--earth)] px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white"
            >
              Abrir
            </button>
            <button
              type="button"
              onClick={() => onReviewNote?.(selectedNote.id)}
              className="rounded-2xl bg-[var(--sage)] px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white"
            >
              Revisar
            </button>
            <button
              type="button"
              onClick={() => onFocusNote?.(selectedNote.id)}
              className="rounded-2xl bg-[var(--accent)] px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white"
            >
              Enfocar
            </button>
          </div>
        </div>
      )}

      {!isPreview && (
      <div className="absolute left-5 bottom-24 hidden text-[10px] font-bold uppercase tracking-[0.22em] text-white/45 sm:block">
        {isRaining ? 'La lluvia no riega sola: reduce el ruido y prioriza revisiones' : 'Arrastra para explorar · toca una planta para actuar'}
      </div>
      )}
    </div>
  );
}
