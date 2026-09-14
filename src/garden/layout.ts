export const GARDEN_LAYOUT_VERSION = 2;
export const GARDEN_PLANET_RADIUS = 15;

export type GardenPosition = [number, number, number];
export type GardenLayoutRole = 'free' | 'path';

export interface GardenLayoutItem {
  id: string;
  createdAt: number;
  footprint: number;
  role?: GardenLayoutRole;
}

export interface GardenReservedZone {
  latitude: number;
  longitude: number;
  radius: number;
}

export interface GardenPlacement {
  id: string;
  position: GardenPosition;
  latitude: number;
  longitude: number;
  layoutVersion: typeof GARDEN_LAYOUT_VERSION;
}

export interface GardenLayoutOptions {
  seed: string;
  radius?: number;
  reservedZones?: GardenReservedZone[];
  candidateCount?: number;
}

// These zones mirror the current lakes and keep the placement API ready for paths/buildings.
export const DEFAULT_GARDEN_RESERVED_ZONES: GardenReservedZone[] = [
  { latitude: 3, longitude: 112, radius: 3.1 },
  { latitude: -31, longitude: 328, radius: 2.2 },
  { latitude: 47, longitude: 246, radius: 2 },
];

export function stableGardenHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(value: number) {
  let state = value >>> 0;
  state += 0x6D2B79F5;
  let result = state;
  result = Math.imul(result ^ result >>> 15, result | 1);
  result ^= result + Math.imul(result ^ result >>> 7, result | 61);
  return ((result ^ result >>> 14) >>> 0) / 4294967296;
}

function candidate(seed: string, id: string, attempt: number, radius: number) {
  const first = randomFrom(stableGardenHash(`${seed}:${id}:${attempt}:latitude`));
  const second = randomFrom(stableGardenHash(`${seed}:${id}:${attempt}:longitude`));
  const yUnit = 1 - 2 * first;
  const longitudeRadians = second * Math.PI * 2;
  const horizontal = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
  const unit: GardenPosition = [
    horizontal * Math.cos(longitudeRadians),
    yUnit,
    horizontal * Math.sin(longitudeRadians),
  ];
  return {
    unit,
    position: unit.map(value => value * radius) as GardenPosition,
    latitude: Math.asin(yUnit) * 180 / Math.PI,
    longitude: (longitudeRadians * 180 / Math.PI + 360) % 360,
  };
}

function surfaceDistance(left: GardenPosition, right: GardenPosition, radius: number) {
  const dot = Math.max(-1, Math.min(1, left[0] * right[0] + left[1] * right[1] + left[2] * right[2]));
  return Math.acos(dot) * radius;
}

function zoneNormal(zone: GardenReservedZone): GardenPosition {
  const latitude = zone.latitude * Math.PI / 180;
  const longitude = zone.longitude * Math.PI / 180;
  return [
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    Math.cos(latitude) * Math.sin(longitude),
  ];
}

function normalize(position: GardenPosition): GardenPosition {
  const length = Math.hypot(...position) || 1;
  return position.map(value => value / length) as GardenPosition;
}

function cross(left: GardenPosition, right: GardenPosition): GardenPosition {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function pathBasis(seed: string) {
  // Paths begin on the hemisphere shown by the default camera, but their exact
  // origin and direction remain unique to each garden seed.
  const latitude = (-4 + randomFrom(stableGardenHash(`${seed}:path:latitude`)) * 28) * Math.PI / 180;
  const longitude = (28 + randomFrom(stableGardenHash(`${seed}:path:longitude`)) * 46) * Math.PI / 180;
  const origin = normalize([
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    Math.cos(latitude) * Math.sin(longitude),
  ]);
  const east = normalize(cross([0, 1, 0], origin));
  const north = normalize(cross(origin, east));
  const heading = randomFrom(stableGardenHash(`${seed}:path:heading`)) * Math.PI * 2;
  const direction = normalize([
    east[0] * Math.cos(heading) + north[0] * Math.sin(heading),
    east[1] * Math.cos(heading) + north[1] * Math.sin(heading),
    east[2] * Math.cos(heading) + north[2] * Math.sin(heading),
  ]);
  return {
    origin,
    direction,
    axis: normalize(cross(origin, direction)),
    phase: randomFrom(stableGardenHash(`${seed}:path:wobble`)) * Math.PI * 2,
  };
}

const GARDEN_PATH_CAPACITY = 48;

function selectPathBasis(seed: string, reservedZones: GardenReservedZone[], radius: number) {
  let best = pathBasis(`${seed}:0`);
  let bestClearance = -Infinity;

  // Pick one coherent route for the garden, rather than moving individual
  // stones away from obstacles and creating visible jumps in the trail.
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const current = pathBasis(`${seed}:${attempt}`);
    let clearance = Infinity;
    for (let index = 0; index < GARDEN_PATH_CAPACITY; index += 1) {
      const point = pathCandidate(current, index, 0, 0, radius);
      for (const zone of reservedZones) {
        clearance = Math.min(clearance, surfaceDistance(point.unit, zoneNormal(zone), radius) - 0.68 - zone.radius);
      }
    }
    if (clearance > bestClearance) {
      best = current;
      bestClearance = clearance;
    }
  }

  return best;
}

function pathCandidate(
  basis: ReturnType<typeof pathBasis>,
  index: number,
  lane: number,
  forwardOffset: number,
  radius: number,
) {
  // Roughly 1.7 world units between stones: close enough to read as stepping
  // stones while leaving their meshes separated.
  const progress = index * 0.112 + forwardOffset;
  const greatCircle: GardenPosition = [
    basis.origin[0] * Math.cos(progress) + basis.direction[0] * Math.sin(progress),
    basis.origin[1] * Math.cos(progress) + basis.direction[1] * Math.sin(progress),
    basis.origin[2] * Math.cos(progress) + basis.direction[2] * Math.sin(progress),
  ];
  const naturalWobble = Math.sin(progress * 1.7 + basis.phase) * 0.035;
  const lateral = lane + naturalWobble;
  const unit = normalize([
    greatCircle[0] * Math.cos(lateral) + basis.axis[0] * Math.sin(lateral),
    greatCircle[1] * Math.cos(lateral) + basis.axis[1] * Math.sin(lateral),
    greatCircle[2] * Math.cos(lateral) + basis.axis[2] * Math.sin(lateral),
  ]);
  const position = unit.map(value => value * radius) as GardenPosition;
  return {
    unit,
    position,
    latitude: Math.asin(unit[1]) * 180 / Math.PI,
    longitude: (Math.atan2(unit[2], unit[0]) * 180 / Math.PI + 360) % 360,
  };
}

function clearanceFor(
  current: { unit: GardenPosition },
  footprint: number,
  assigned: Array<{ unit: GardenPosition; footprint: number }>,
  reservedZones: GardenReservedZone[],
  radius: number,
) {
  const itemClearance = assigned.length === 0
    ? Infinity
    : Math.min(...assigned.map(other => surfaceDistance(current.unit, other.unit, radius) - footprint - other.footprint));
  const zoneClearance = reservedZones.length === 0
    ? Infinity
    : Math.min(...reservedZones.map(zone => surfaceDistance(current.unit, zoneNormal(zone), radius) - footprint - zone.radius));
  return Math.min(itemClearance, zoneClearance);
}

/**
 * Assigns positions in creation order. Adding newer items never moves existing ones,
 * and filters can safely hide items without recomputing the world from visible count.
 */
export function createGardenLayout(items: GardenLayoutItem[], options: GardenLayoutOptions) {
  const radius = options.radius || GARDEN_PLANET_RADIUS;
  // Sparse gardens normally accept one of the first candidates. Dense gardens
  // can keep searching without changing the positions already assigned.
  const candidateCount = Math.max(12, options.candidateCount || (items.length > 75 ? 2048 : 512));
  const reservedZones = options.reservedZones || DEFAULT_GARDEN_RESERVED_ZONES;
  const assigned: Array<{ unit: GardenPosition; footprint: number }> = [];
  const placements = new Map<string, GardenPlacement>();
  const ordered = [...items].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  const freeItems = ordered.filter(item => item.role !== 'path');
  const pathItems = ordered.filter(item => item.role === 'path');
  const basis = selectPathBasis(`${options.seed}:v${GARDEN_LAYOUT_VERSION}`, reservedZones, radius);

  // Once a garden has a learning path, reserve its complete first trail so new
  // stones can extend it without moving existing trees. Gardens without
  // learnings keep the full surface available.
  if (pathItems.length > 0) {
    for (let index = 0; index < GARDEN_PATH_CAPACITY; index += 1) {
      const point = pathCandidate(basis, index, 0, 0, radius);
      assigned.push({ unit: point.unit, footprint: 0.68 });
    }
  }

  for (const item of freeItems) {
    let best: ReturnType<typeof candidate> | null = null;
    let bestClearance = -Infinity;

    for (let attempt = 0; attempt < candidateCount; attempt += 1) {
      const current = candidate(`${options.seed}:v${GARDEN_LAYOUT_VERSION}`, item.id, attempt, radius);
      const clearance = clearanceFor(current, item.footprint, assigned, reservedZones, radius);
      if (clearance > bestClearance) {
        best = current;
        bestClearance = clearance;
      }
      if (clearance >= 0.45) break;
    }

    if (!best) continue;
    assigned.push({ unit: best.unit, footprint: item.footprint });
    placements.set(item.id, {
      id: item.id,
      position: best.position,
      latitude: best.latitude,
      longitude: best.longitude,
      layoutVersion: GARDEN_LAYOUT_VERSION,
    });
  }

  // Learning stones occupy the reserved route in chronological order.
  for (let index = 0; index < pathItems.length; index += 1) {
    const item = pathItems[index];
    const segment = Math.floor(index / GARDEN_PATH_CAPACITY);
    const segmentIndex = index % GARDEN_PATH_CAPACITY;
    const lane = segment === 0 ? 0 : (Math.ceil(segment / 2) * 0.13 * (segment % 2 === 0 ? -1 : 1));
    const placement = pathCandidate(basis, segmentIndex, lane, 0, radius);
    placements.set(item.id, {
      id: item.id,
      position: placement.position,
      latitude: placement.latitude,
      longitude: placement.longitude,
      layoutVersion: GARDEN_LAYOUT_VERSION,
    });
  }

  return placements;
}
