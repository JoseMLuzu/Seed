import { memo, useEffect, useRef } from 'react';

type Point = { x: number; y: number; z: number };
type Face = { points: Point[]; normal: Point; tint: number };
type TreeFace = { points: Point[]; color: string };

const TAU = Math.PI * 2;
const FRAME_MS = 1000 / 24;
const CANVAS_SCALE = 1.24; // Room for trees extending beyond the planet's silhouette.
const pointOnSphere = (latitude: number, longitude: number): Point => ({
  x: Math.cos(latitude) * Math.cos(longitude),
  y: Math.sin(latitude),
  z: Math.cos(latitude) * Math.sin(longitude),
});

// Small, deterministic mesh: no models, textures, WebGL context or garden simulation.
const faces: Face[] = [];
for (let row = 0; row < 14; row++) {
  for (let col = 0; col < 28; col++) {
    const corner = (r: number, c: number) => pointOnSphere(-Math.PI / 2 + r / 14 * Math.PI, c / 28 * TAU);
    const a = corner(row, col), b = corner(row, col + 1);
    const c = corner(row + 1, col), d = corner(row + 1, col + 1);
    for (const points of [[a, b, c], [b, d, c]]) {
      const center = points.reduce((sum, p) => ({ x: sum.x + p.x / 3, y: sum.y + p.y / 3, z: sum.z + p.z / 3 }), { x: 0, y: 0, z: 0 });
      const length = Math.hypot(center.x, center.y, center.z);
      faces.push({ points, normal: { x: center.x / length, y: center.y / length, z: center.z / length }, tint: Math.sin(row * 73 + col * 37 + points[0].y * 11) * 7 });
    }
  }
}
const pebbles = Array.from({ length: 46 }, (_, i) => pointOnSphere(Math.asin(1 - 2 * (i + 0.5) / 46), i * 2.39996));
const lakes = [
  { center: pointOnSphere(0.3, 0.95), radius: 0.24, color: '#577756' },
  { center: pointOnSphere(-0.2, 2.25), radius: 0.14, color: '#73afbe' },
  { center: pointOnSphere(-0.82, 1.5), radius: 0.18, color: '#3c6147' },
  { center: pointOnSphere(0.55, 4.8), radius: 0.21, color: '#659788' },
];

// A few broadleaf trees, using the garden's trunk and foliage palette.
// Their tiny meshes are built once and rotate with the surface.
const trees = Array.from({ length: 16 }, (_, i) => {
  const latitude = Math.asin(1 - 2 * (i + 0.5) / 16);
  const longitude = i * 2.39996 + 0.7;
  const base = pointOnSphere(latitude, longitude);
  const tangent = { x: -Math.sin(longitude), y: 0, z: Math.cos(longitude) };
  const bitangent = { x: -Math.sin(latitude) * Math.cos(longitude), y: Math.cos(latitude), z: -Math.sin(latitude) * Math.sin(longitude) };
  const scale = 0.85 + i % 3 * 0.12;
  const local = (x: number, height: number, z: number): Point => ({
    x: base.x * (1 + height * scale) + (tangent.x * x + bitangent.x * z) * scale,
    y: base.y * (1 + height * scale) + (tangent.y * x + bitangent.y * z) * scale,
    z: base.z * (1 + height * scale) + (tangent.z * x + bitangent.z * z) * scale,
  });
  const mesh: TreeFace[] = [];
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2, b = (side + 1) * Math.PI / 2;
    mesh.push({
      points: [local(Math.cos(a) * 0.014, 0, Math.sin(a) * 0.014), local(Math.cos(b) * 0.014, 0, Math.sin(b) * 0.014), local(Math.cos(b) * 0.009, 0.13, Math.sin(b) * 0.009), local(Math.cos(a) * 0.009, 0.13, Math.sin(a) * 0.009)],
      color: side % 2 ? '#8a6447' : '#79533c',
    });
  }
  for (const [x, height, z, width] of [[-0.037, 0.125, 0.012, 0.054], [0.037, 0.135, -0.012, 0.058], [0, 0.18, 0, 0.068]]) {
    const top = local(x, height + width * 0.95, z);
    const bottom = local(x, height - width * 0.7, z);
    const ring = Array.from({ length: 5 }, (_, side) => local(x + Math.cos(side / 5 * TAU) * width, height, z + Math.sin(side / 5 * TAU) * width));
    for (let side = 0; side < 5; side++) {
      mesh.push({ points: [top, ring[side], ring[(side + 1) % 5]], color: ['#8fc76a', '#7db85c', '#6faa4f', '#82bd60', '#a0cc79'][side] });
      mesh.push({ points: [bottom, ring[(side + 1) % 5], ring[side]], color: side % 2 ? '#487b3d' : '#5b9245' });
    }
  }
  return { base, mesh };
}).filter(tree => !lakes.some(lake => tree.base.x * lake.center.x + tree.base.y * lake.center.y + tree.base.z * lake.center.z > Math.cos(lake.radius + 0.12)));

function AuthPlanet({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return; // The CSS sphere remains visible if canvas is unavailable.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let size = 1;
    let frame = 0;
    let timer = 0;
    let lastTime = 0;
    let disposed = false;

    const draw = () => {
      const angle = angleRef.current;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const rotate = (p: Point): Point => {
        const x = p.x * cos + p.z * sin;
        const z = p.z * cos - p.x * sin;
        return { x: x * 0.978 - p.y * 0.208, y: x * 0.208 + p.y * 0.978, z };
      };
      const radius = size * 0.455 / CANVAS_SCALE;
      const project = (p: Point) => ({ x: size / 2 + p.x * radius, y: size / 2 - p.y * radius });
      ctx.clearRect(0, 0, size, size);
      const treeFaces = trees.flatMap(tree => {
        const front = rotate(tree.base).z >= 0;
        return tree.mesh.map(face => {
          const points = face.points.map(rotate);
          return { points, front, color: face.color, depth: points.reduce((sum, p) => sum + p.z, 0) / points.length };
        });
      }).sort((a, b) => a.depth - b.depth);
      const drawTrees = (front: boolean) => {
        for (const face of treeFaces) {
          if (face.front !== front) continue;
          ctx.beginPath();
          face.points.forEach((point, i) => {
            const p = project(point);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fillStyle = face.color;
          ctx.fill();
        }
      };
      // The planet occludes trees on its far side; near trees cover the terrain.
      drawTrees(false);
      // Convex faces cannot overlap, so no per-frame depth sorting is needed.
      for (const face of faces) {
        const normal = rotate(face.normal);
        if (normal.z < -0.06) continue;
        const light = Math.max(0, -normal.x * 0.38 + normal.y * 0.62 + normal.z * 0.65);
        const color = `rgb(${Math.round(91 + light * 71 + face.tint)},${Math.round(121 + light * 65 + face.tint)},${Math.round(76 + light * 61 + face.tint)})`;
        ctx.beginPath();
        face.points.forEach((p, i) => {
          const projected = project(rotate(p));
          if (i === 0) ctx.moveTo(projected.x, projected.y);
          else ctx.lineTo(projected.x, projected.y);
        });
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.6;
        ctx.fill();
        ctx.stroke();
      }
      for (const lake of lakes) {
        const center = rotate(lake.center);
        if (center.z < 0.18) continue;
        const p = project(center);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, radius * lake.radius, radius * lake.radius * center.z * 0.8, Math.atan2(center.y, -center.x) + Math.PI / 2, 0, TAU);
        ctx.fillStyle = lake.color;
        ctx.fill();
        ctx.strokeStyle = lake.color === '#73afbe' ? '#d2e8dc' : '#a8be88';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      pebbles.forEach((pebble, index) => {
        const p = rotate(pebble);
        if (p.z < 0.15 || lakes.some(lake => pebble.x * lake.center.x + pebble.y * lake.center.y + pebble.z * lake.center.z > Math.cos(lake.radius + 0.05))) return;
        const screen = project(p);
        const r = radius * (0.014 + index % 3 * 0.004);
        ctx.beginPath();
        for (let side = 0; side < 5; side++) {
          const a = side / 5 * TAU;
          const x = screen.x + Math.cos(a) * r;
          const y = screen.y + Math.sin(a) * r;
          if (side === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = index % 4 === 0 ? '#92ad81' : '#527963';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(screen.x - r, screen.y);
        ctx.lineTo(screen.x, screen.y - r);
        ctx.lineTo(screen.x + r, screen.y);
        ctx.fillStyle = '#a5b99a';
        ctx.fill();
      });
      drawTrees(true);
    };

    const stop = () => { window.clearTimeout(timer); cancelAnimationFrame(frame); lastTime = 0; };
    const canAnimate = () => !disposed && visible && !paused && !document.hidden && !reducedMotion.matches;
    const tick = (now: number) => {
      if (!canAnimate()) return;
      if (lastTime) angleRef.current += Math.min(now - lastTime, 100) * 0.000065;
      lastTime = now;
      draw();
      timer = window.setTimeout(() => { frame = requestAnimationFrame(tick); }, FRAME_MS);
    };
    const update = () => { stop(); if (canAnimate()) frame = requestAnimationFrame(tick); };
    const resize = () => {
      size = canvas.getBoundingClientRect().width;
      if (!size) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(canvas);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', update);
    reducedMotion.addEventListener('change', update);
    resize();
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', update);
      reducedMotion.removeEventListener('change', update);
    };
  }, [paused]);

  return <div className="auth-planet" aria-hidden="true"><div className="auth-planet-fallback" /><canvas ref={canvasRef} style={{ width: `${CANVAS_SCALE * 100}%`, height: `${CANVAS_SCALE * 100}%`, left: `${(1 - CANVAS_SCALE) * 50}%`, top: `${(1 - CANVAS_SCALE) * 50}%` }} /></div>;
}

export default memo(AuthPlanet);
