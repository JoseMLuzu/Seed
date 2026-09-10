import { Planet, SeedNote, SyncSnapshot } from './types';
import { supabase } from './supabase';
import { normalizeNote } from './normalize';
import type { AccountScope, SyncAccess } from './accountScope';
import {
	applySyncTombstones,
  completeSyncMutation,
  deferSyncMutation,
  diffSyncSnapshots,
  enqueueSyncMutations,
  loadSyncQueue,
  mergeSyncSnapshots,
  type SyncMutation,
	type SyncTombstone,
} from './syncQueue';

type GardenClient = Pick<NonNullable<typeof supabase>, 'from'>;
type AccountClient = Pick<NonNullable<typeof supabase>, 'rpc'>;
type SyncClient = Pick<NonNullable<typeof supabase>, 'from' | 'rpc'>;

export type OwnedSyncSnapshot = SyncSnapshot & { ownerId: string };

function checkAccess(access: SyncAccess, ownerId = access.userId) {
  access.signal.throwIfAborted();
  if (!access.userId || !access.accessToken || ownerId !== access.userId) {
    throw new Error('La operación no pertenece a la cuenta activa.');
  }
}


type PlanetRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  theme: Planet['theme'];
  created_at_ms: number;
  updated_at?: string;
	server_revision?: number;
};

type NoteRow = {
  id: string;
  user_id: string;
  planet_id: string;
  data: SeedNote;
  updated_at?: string;
	server_revision?: number;
};

function noteUpdatedAt(note: SeedNote) {
  return note.updatedAt || note.createdAt || 0;
}

function normalizeRemoteNote(row: NoteRow): SeedNote | null {
  return normalizeNote({
    ...row.data,
    id: row.data?.id || row.id,
    planetId: row.data?.planetId || row.planet_id || 'personal',
	  syncVersion: row.server_revision ?? row.data?.syncVersion,
  });
}

function normalizeRemotePlanet(row: PlanetRow): Planet {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    theme: row.theme,
    createdAt: row.created_at_ms || Date.now(),
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
	  syncVersion: row.server_revision,
  };
}

function dedupeNotes(notes: SeedNote[]) {
  const byId = new Map<string, SeedNote>();
  notes.forEach(note => {
    const existing = byId.get(note.id);
    if (!existing || noteUpdatedAt(note) >= noteUpdatedAt(existing)) byId.set(note.id, note);
  });
  return [...byId.values()];
}

export async function fetchGardenFromSupabase(access: SyncAccess, client: GardenClient | null = supabase): Promise<SyncSnapshot> {
  if (!client) throw new Error('Supabase no está configurado.');
  checkAccess(access);

  const { data: remotePlanets, error: planetsError } = await client
    .from('seed_planets')
	    .select('id,user_id,name,description,theme,created_at_ms,updated_at,server_revision')
    .eq('user_id', access.userId)
    .order('created_at_ms', { ascending: true })
    .setHeader('Authorization', `Bearer ${access.accessToken}`)
    .abortSignal(access.signal);

  checkAccess(access);
  if (planetsError) throw planetsError;

  const { data: remoteNotes, error: notesError } = await client
    .from('seed_notes')
	    .select('id,user_id,planet_id,data,updated_at,server_revision')
    .eq('user_id', access.userId)
    .setHeader('Authorization', `Bearer ${access.accessToken}`)
    .abortSignal(access.signal);

  checkAccess(access);
  if (notesError) throw notesError;

  return {
    planets: (remotePlanets || []).filter(row => row.user_id === access.userId).map(row => normalizeRemotePlanet(row as PlanetRow)),
    notes: dedupeNotes((remoteNotes || []).filter(row => row.user_id === access.userId).flatMap(row => {
      const note = normalizeRemoteNote(row as NoteRow);
      return note ? [note] : [];
    })),
  };
}

export async function fetchTombstonesFromSupabase(access: SyncAccess, client: GardenClient | null = supabase): Promise<SyncTombstone[]> {
  if (!client) throw new Error('Supabase no está configurado.');
  checkAccess(access);
  const { data, error } = await client
    .from('seed_tombstones')
    .select('user_id,entity_type,entity_id,server_revision')
    .eq('user_id', access.userId)
    .order('server_revision', { ascending: true })
    .setHeader('Authorization', `Bearer ${access.accessToken}`)
    .abortSignal(access.signal);
  checkAccess(access);
  if (error) throw error;
  return (data || []).flatMap(row => {
    if (row.user_id !== access.userId || (row.entity_type !== 'note' && row.entity_type !== 'planet')
      || typeof row.entity_id !== 'string' || typeof row.server_revision !== 'number') return [];
    return [{ entity: row.entity_type, entityId: row.entity_id, syncVersion: row.server_revision } satisfies SyncTombstone];
  });
}

export async function pushGardenToSupabase(snapshot: OwnedSyncSnapshot, access: SyncAccess, client: GardenClient | null = supabase) {
  if (!client) throw new Error('Supabase no está configurado.');
  checkAccess(access);

  checkAccess(access, snapshot.ownerId);
  const planetRows: PlanetRow[] = snapshot.planets.map(planet => ({
    id: planet.id,
    user_id: access.userId,
    name: planet.name,
    description: planet.description || '',
    theme: planet.theme,
    created_at_ms: planet.createdAt || Date.now(),
    updated_at: new Date(planet.updatedAt || planet.createdAt || Date.now()).toISOString(),
  }));

  const noteRows: NoteRow[] = snapshot.notes.map(note => ({
    id: note.id,
    user_id: access.userId,
    planet_id: note.planetId || 'personal',
    data: note,
    updated_at: new Date(noteUpdatedAt(note) || Date.now()).toISOString(),
  }));

  if (planetRows.length > 0) {
    const { error } = await client.from('seed_planets').upsert(planetRows, { onConflict: 'id,user_id' })
      .setHeader('Authorization', `Bearer ${access.accessToken}`).abortSignal(access.signal);
    checkAccess(access);
    if (error) throw error;
  }

  if (noteRows.length > 0) {
    const { error } = await client.from('seed_notes').upsert(noteRows, { onConflict: 'id,user_id' })
      .setHeader('Authorization', `Bearer ${access.accessToken}`).abortSignal(access.signal);
    checkAccess(access);
    if (error) throw error;
  }
}

export async function syncGardenWithSupabase(snapshot: OwnedSyncSnapshot, access: SyncAccess, client: GardenClient | null = supabase): Promise<SyncSnapshot> {
  checkAccess(access, snapshot.ownerId);
  const remote = await fetchGardenFromSupabase(access, client);
  const remoteNotesById = new Map(remote.notes.map(note => [note.id, note]));
  const notesToPush = snapshot.notes.filter(note => {
    const remoteNote = remoteNotesById.get(note.id);
    return !remoteNote || noteUpdatedAt(note) >= noteUpdatedAt(remoteNote);
  });

  await pushGardenToSupabase({ ...snapshot, notes: notesToPush }, access, client);
  return fetchGardenFromSupabase(access, client);
}

export async function deleteNoteFromSupabase(id: string, access: SyncAccess, client: GardenClient | null = supabase) {
  if (!client) throw new Error('Supabase no está configurado.');
  checkAccess(access);
  const { error } = await client
    .from('seed_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', access.userId)
    .setHeader('Authorization', `Bearer ${access.accessToken}`).abortSignal(access.signal);
  checkAccess(access);
  if (error) throw error;
}

export async function deletePlanetFromSupabase(id: string, access: SyncAccess, client: GardenClient | null = supabase) {
  if (!client) throw new Error('Supabase no está configurado.');
  checkAccess(access);
  const { error: notesError } = await client
    .from('seed_notes')
    .delete()
    .eq('planet_id', id)
    .eq('user_id', access.userId)
    .setHeader('Authorization', `Bearer ${access.accessToken}`).abortSignal(access.signal);
  checkAccess(access);
  if (notesError) throw notesError;

  const { error } = await client
    .from('seed_planets')
    .delete()
    .eq('id', id)
    .eq('user_id', access.userId)
    .setHeader('Authorization', `Bearer ${access.accessToken}`).abortSignal(access.signal);
  checkAccess(access);
  if (error) throw error;
}

export type FlushSyncQueueResult = {
  processed: number;
  pending: number;
  nextRetryAt: number;
	conflicts: number;
  error?: Error;
};

const activeFlushes = new Map<string, Promise<FlushSyncQueueResult>>();

async function executeSyncMutation(mutation: SyncMutation, access: SyncAccess, client: SyncClient) {
  checkAccess(access);
	  const { data, error } = await client.rpc('apply_seed_mutation', {
	    p_mutation_id: mutation.mutationId,
	    p_entity_type: mutation.entity,
	    p_action: mutation.action,
	    p_entity_id: mutation.entityId,
	    p_payload: mutation.action === 'upsert' ? mutation.value : null,
	    p_base_revision: mutation.baseVersion,
	  }).setHeader('Authorization', `Bearer ${access.accessToken}`).abortSignal(access.signal);
  checkAccess(access);
  if (error) throw error;
	  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.revision !== 'number') {
	    throw new Error('Supabase no confirmó la versión del cambio.');
	  }
	  return { revision: data.revision, conflict: data.conflict === true };
}

async function performQueueFlush(
  scope: AccountScope,
  access: SyncAccess,
	  client: SyncClient | null,
  force: boolean,
): Promise<FlushSyncQueueResult> {
  if (!client) throw new Error('Supabase no está configurado.');
  checkAccess(access, scope.userId || '');
  let processed = 0;
	let conflicts = 0;

  while (true) {
    checkAccess(access, scope.userId || '');
    const queue = loadSyncQueue(scope);
    const mutation = queue[0];
	    if (!mutation) return { processed, pending: 0, nextRetryAt: 0, conflicts };
    if (!force && mutation.nextAttemptAt > Date.now()) {
	      return { processed, pending: queue.length, nextRetryAt: mutation.nextAttemptAt, conflicts };
    }

    try {
	      const applied = await executeSyncMutation(mutation, access, client);
	      completeSyncMutation(scope, mutation, applied.revision);
	      if (applied.conflict) conflicts += 1;
      processed += 1;
    } catch (cause) {
      if (access.signal.aborted) throw cause;
      const error = cause instanceof Error ? cause : new Error('No se pudo enviar un cambio pendiente.');
      const nextRetryAt = deferSyncMutation(scope, mutation.mutationId);
	      return { processed, pending: loadSyncQueue(scope).length, nextRetryAt, conflicts, error };
    }
  }
}

/** Serializes flushes per account so two UI triggers cannot send the same queue concurrently. */
export function flushSyncQueue(
  scope: AccountScope,
  access: SyncAccess,
	  client: SyncClient | null = supabase,
  options: { force?: boolean } = {},
) {
	  const previous = activeFlushes.get(scope.key) || Promise.resolve({ processed: 0, pending: loadSyncQueue(scope).length, nextRetryAt: 0, conflicts: 0 });
	  const run = previous.catch(() => ({ processed: 0, pending: loadSyncQueue(scope).length, nextRetryAt: 0, conflicts: 0 }))
    .then(() => performQueueFlush(scope, access, client, options.force === true));
  activeFlushes.set(scope.key, run);
  void run.finally(() => {
    if (activeFlushes.get(scope.key) === run) activeFlushes.delete(scope.key);
  }).catch(() => {});
  return run;
}

/** Flushes durable edits first, then reconciles initial/local data without treating absence as deletion. */
export async function syncGardenIncrementally(
  scope: AccountScope,
  snapshot: OwnedSyncSnapshot,
  access: SyncAccess,
	  client: SyncClient | null = supabase,
) {
  checkAccess(access, snapshot.ownerId);
  checkAccess(access, scope.userId || '');
  const queued = await flushSyncQueue(scope, access, client, { force: true });
  if (queued.pending > 0) throw queued.error || new Error('Quedan cambios pendientes por sincronizar.');

	  const [remote, tombstones] = await Promise.all([
	    fetchGardenFromSupabase(access, client),
	    fetchTombstonesFromSupabase(access, client),
	  ]);
	  const remoteState = applySyncTombstones(remote, tombstones);
	  const merged = applySyncTombstones(mergeSyncSnapshots(snapshot, remoteState), tombstones);
	  const bootstrapMutations = diffSyncSnapshots(remoteState, merged).filter(mutation => mutation.action === 'upsert');
  enqueueSyncMutations(scope, bootstrapMutations);
  const pushed = await flushSyncQueue(scope, access, client, { force: true });
  if (pushed.pending > 0) throw pushed.error || new Error('Quedan cambios pendientes por sincronizar.');
	  const [finalSnapshot, finalTombstones] = await Promise.all([
	    fetchGardenFromSupabase(access, client),
	    fetchTombstonesFromSupabase(access, client),
	  ]);
	  return {
	    ...applySyncTombstones(finalSnapshot, finalTombstones),
	    tombstones: finalTombstones,
	    conflicts: queued.conflicts + pushed.conflicts,
	  };
}

export async function deleteOwnAccountFromSupabase(access: SyncAccess, client: AccountClient | null = supabase) {
  if (!client) throw new Error('Supabase no está configurado.');
  checkAccess(access);
  const { data, error } = await client
    .rpc('delete_own_account')
    .setHeader('Authorization', `Bearer ${access.accessToken}`)
    .abortSignal(access.signal);
  checkAccess(access);
  if (error) throw error;
  if (data !== true) throw new Error('Supabase no confirmó la eliminación de la cuenta.');
}
