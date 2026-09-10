import { scopedStorageKey, type AccountScope } from './accountScope';
import type { Planet, SeedNote, SyncSnapshot } from './types';

export type SyncMutationDraft =
  | { entity: 'note'; action: 'upsert'; entityId: string; value: SeedNote; baseVersion?: number | null }
  | { entity: 'note'; action: 'delete'; entityId: string; baseVersion?: number | null }
  | { entity: 'planet'; action: 'upsert'; entityId: string; value: Planet; baseVersion?: number | null }
  | { entity: 'planet'; action: 'delete'; entityId: string; baseVersion?: number | null };

export type SyncMutation = SyncMutationDraft & {
  baseVersion: number | null;
  mutationId: string;
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number;
};

export type SyncTombstone = {
  entity: 'note' | 'planet';
  entityId: string;
  syncVersion: number;
};

type StoredQueue = { version: 1; mutations: SyncMutation[] };
let mutationSequence = 0;

function queueKey(scope: AccountScope) {
  if (!scope.userId) throw new Error('El jardín invitado no tiene cola de sincronización.');
  return scopedStorageKey(scope, 'sync-queue-v1');
}

function entityKey(mutation: Pick<SyncMutationDraft, 'entity' | 'entityId'>) {
  return `${mutation.entity}:${mutation.entityId}`;
}

function versionsKey(scope: AccountScope) {
  return scopedStorageKey(scope, 'sync-versions-v1');
}

function loadKnownVersions(scope: AccountScope) {
  const raw = localStorage.getItem(versionsKey(scope));
  if (!raw) return {} as Record<string, number>;
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {} as Record<string, number>;
	return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isSafeInteger(entry[1]) && entry[1] >= 0));
  } catch {
    return {} as Record<string, number>;
  }
}

function knownVersion(scope: AccountScope, mutation: Pick<SyncMutationDraft, 'entity' | 'entityId'>) {
  return loadKnownVersions(scope)[entityKey(mutation)] ?? 0;
}

function saveKnownVersion(scope: AccountScope, mutation: Pick<SyncMutationDraft, 'entity' | 'entityId'>, revision: number) {
  const versions = loadKnownVersions(scope);
  versions[entityKey(mutation)] = Math.max(versions[entityKey(mutation)] || 0, revision);
  localStorage.setItem(versionsKey(scope), JSON.stringify(versions));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isMutation(value: unknown): value is SyncMutation {
  if (!isRecord(value)) return false;
  const entity = value.entity;
  const action = value.action;
  if ((entity !== 'note' && entity !== 'planet') || (action !== 'upsert' && action !== 'delete')) return false;
  if (typeof value.entityId !== 'string' || !value.entityId || typeof value.mutationId !== 'string') return false;
  if (typeof value.queuedAt !== 'number' || typeof value.attempts !== 'number' || typeof value.nextAttemptAt !== 'number') return false;
	if (value.baseVersion !== undefined && value.baseVersion !== null
	  && (typeof value.baseVersion !== 'number' || !Number.isSafeInteger(value.baseVersion) || value.baseVersion < 0)) return false;
  if (action === 'upsert') return isRecord(value.value) && value.value.id === value.entityId;
  return value.value === undefined;
}

function persistSyncQueue(scope: AccountScope, mutations: SyncMutation[]) {
  const key = queueKey(scope);
  if (mutations.length === 0) {
    localStorage.removeItem(key);
    return;
  }
  const stored: StoredQueue = { version: 1, mutations };
  localStorage.setItem(key, JSON.stringify(stored));
}

export function loadSyncQueue(scope: AccountScope): SyncMutation[] {
  const raw = localStorage.getItem(queueKey(scope));
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('La cola de sincronización local está dañada y no se sobrescribió.');
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.mutations) || !parsed.mutations.every(isMutation)) {
    throw new Error('La cola de sincronización local no tiene un formato válido y no se sobrescribió.');
  }
  return parsed.mutations
    .map(mutation => ({ ...mutation, baseVersion: mutation.baseVersion ?? null }))
    .sort((a, b) => a.queuedAt - b.queuedAt);
}

function newMutation(draft: SyncMutationDraft, baseVersion: number | null, now: number): SyncMutation {
  mutationSequence += 1;
  return {
    ...draft,
    baseVersion,
    mutationId: `${now}-${mutationSequence}-${Math.random().toString(36).slice(2, 9)}`,
    queuedAt: now,
    attempts: 0,
    nextAttemptAt: 0,
  };
}

/** Keeps only the newest intended state for each entity while preserving cross-entity order. */
export function enqueueSyncMutations(scope: AccountScope, drafts: SyncMutationDraft[], now = Date.now()) {
  if (drafts.length === 0) return loadSyncQueue(scope);
  const queue = loadSyncQueue(scope);
  for (const draft of drafts) {
    const key = entityKey(draft);
    const previousIndex = queue.findIndex(item => entityKey(item) === key);
	const previous = previousIndex >= 0 ? queue[previousIndex] : undefined;
    if (previousIndex >= 0) queue.splice(previousIndex, 1);
	const baseVersion = previous?.baseVersion ?? Math.max(draft.baseVersion ?? 0, knownVersion(scope, draft));
	    queue.push(newMutation(draft, baseVersion, now + mutationSequence));
  }
  persistSyncQueue(scope, queue);
  return queue;
}

/** Removes only the exact operation sent; a newer edit of the same entity survives. */
export function completeSyncMutation(scope: AccountScope, mutation: SyncMutation, revision: number) {
  const queue = loadSyncQueue(scope);
	  const next = queue
	    .filter(item => item.mutationId !== mutation.mutationId)
	    .map(item => entityKey(item) === entityKey(mutation) ? { ...item, baseVersion: revision } : item);
	  saveKnownVersion(scope, mutation, revision);
	  persistSyncQueue(scope, next);
  return next;
}

export function deferSyncMutation(
  scope: AccountScope,
  mutationId: string,
  now = Date.now(),
  random = Math.random,
) {
  const queue = loadSyncQueue(scope);
  let retryAt = 0;
  const next = queue.map(item => {
    if (item.mutationId !== mutationId) return item;
    const attempts = item.attempts + 1;
    const baseDelay = Math.min(5 * 60_000, 1_000 * (2 ** Math.min(attempts - 1, 8)));
    const jitter = Math.round(baseDelay * 0.2 * random());
    retryAt = now + baseDelay + jitter;
    return { ...item, attempts, nextAttemptAt: retryAt };
  });
  persistSyncQueue(scope, next);
  return retryAt;
}

function changed<T>(before: T, after: T) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function diffSyncSnapshots(previous: SyncSnapshot, current: SyncSnapshot): SyncMutationDraft[] {
  const drafts: SyncMutationDraft[] = [];
  const previousPlanets = new Map(previous.planets.map(planet => [planet.id, planet]));
  const currentPlanets = new Map(current.planets.map(planet => [planet.id, planet]));
  const previousNotes = new Map(previous.notes.map(note => [note.id, note]));
  const currentNotes = new Map(current.notes.map(note => [note.id, note]));

  for (const planet of current.planets) {
    const before = previousPlanets.get(planet.id);
	    if (!before || changed(before, planet)) drafts.push({ entity: 'planet', action: 'upsert', entityId: planet.id, value: planet, baseVersion: before?.syncVersion ?? 0 });
  }
  for (const note of current.notes) {
    const before = previousNotes.get(note.id);
	    if (!before || changed(before, note)) drafts.push({ entity: 'note', action: 'upsert', entityId: note.id, value: note, baseVersion: before?.syncVersion ?? 0 });
  }
  for (const note of previous.notes) {
	    if (!currentNotes.has(note.id)) drafts.push({ entity: 'note', action: 'delete', entityId: note.id, baseVersion: note.syncVersion ?? 0 });
  }
  for (const planet of previous.planets) {
	    if (!currentPlanets.has(planet.id)) drafts.push({ entity: 'planet', action: 'delete', entityId: planet.id, baseVersion: planet.syncVersion ?? 0 });
  }
  return drafts;
}

function updatedAt(value: Planet | SeedNote) {
  return value.updatedAt || value.createdAt || 0;
}

function isLocalNewer<T extends Planet | SeedNote>(local: T, remote: T) {
  const localVersion = local.syncVersion;
  const remoteVersion = remote.syncVersion;
  if (localVersion !== undefined && remoteVersion !== undefined && localVersion !== remoteVersion) {
    return localVersion > remoteVersion;
  }
  if (localVersion === undefined && remoteVersion !== undefined) return false;
  if (localVersion !== undefined && remoteVersion === undefined) return true;
  return updatedAt(local) > updatedAt(remote);
}

function mergeEntities<T extends Planet | SeedNote>(local: T[], remote: T[]) {
  const merged = new Map(remote.map(value => [value.id, value]));
  for (const value of local) {
    const remoteValue = merged.get(value.id);
	    if (!remoteValue || isLocalNewer(value, remoteValue)) merged.set(value.id, value);
  }
  return [...merged.values()];
}

/** Absence is not interpreted as deletion until server tombstones are introduced in DATA-05. */
export function mergeSyncSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  return {
    planets: mergeEntities(local.planets, remote.planets),
    notes: mergeEntities(local.notes, remote.notes),
  };
}

export function applySyncTombstones(snapshot: SyncSnapshot, tombstones: SyncTombstone[]): SyncSnapshot {
  const noteDeletes = new Map(tombstones.filter(item => item.entity === 'note').map(item => [item.entityId, item.syncVersion]));
  const planetDeletes = new Map(tombstones.filter(item => item.entity === 'planet').map(item => [item.entityId, item.syncVersion]));
  return {
    notes: snapshot.notes.filter(note => {
      const tombstoneVersion = noteDeletes.get(note.id) ?? planetDeletes.get(note.planetId || 'personal');
      return tombstoneVersion === undefined || (note.syncVersion ?? 0) > tombstoneVersion;
    }),
    planets: snapshot.planets.filter(planet => {
      const tombstoneVersion = planetDeletes.get(planet.id);
      return tombstoneVersion === undefined || (planet.syncVersion ?? 0) > tombstoneVersion;
    }),
  };
}
