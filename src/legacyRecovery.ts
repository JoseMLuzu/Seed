import type { AccountScope } from './accountScope';
import type { SyncSnapshot } from './types';

const OWNER_KEY = 'seed-legacy-recovery-owner-v2';

export function assertLegacyRecoveryOwner(scope: AccountScope) {
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner && owner !== scope.key) throw new Error('Los datos anteriores ya se asignaron a otro espacio local.');
}

/** Called only after the user confirms ownership. Retain the originals for recovery. */
export function reserveLegacyRecovery(scope: AccountScope) {
  assertLegacyRecoveryOwner(scope);
  localStorage.setItem(OWNER_KEY, scope.key);
}

/** Retrying recovery never overwrites an existing note or garden. */
export function mergeLegacyGarden(current: SyncSnapshot, legacy: SyncSnapshot): SyncSnapshot {
  const planets = new Map(legacy.planets.map(planet => [planet.id, planet]));
  current.planets.forEach(planet => planets.set(planet.id, planet));
  const notes = new Map(legacy.notes.map(note => [note.id, note]));
  current.notes.forEach(note => notes.set(note.id, note));
  return { planets: [...planets.values()], notes: [...notes.values()] };
}
