import { Planet, SeedNote, SyncSnapshot } from './types';
import { supabase } from './supabase';
import { normalizeNote } from './normalize';
import type { SyncAccess } from './accountScope';

type GardenClient = Pick<NonNullable<typeof supabase>, 'from'>;

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
};

type NoteRow = {
  id: string;
  user_id: string;
  planet_id: string;
  data: SeedNote;
};

function noteUpdatedAt(note: SeedNote) {
  return note.updatedAt || note.createdAt || 0;
}

function normalizeRemoteNote(row: NoteRow): SeedNote | null {
  return normalizeNote({
    ...row.data,
    id: row.data?.id || row.id,
    planetId: row.data?.planetId || row.planet_id || 'personal',
  });
}

function normalizeRemotePlanet(row: PlanetRow): Planet {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    theme: row.theme,
    createdAt: row.created_at_ms || Date.now(),
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
    .select('id,user_id,name,description,theme,created_at_ms')
    .eq('user_id', access.userId)
    .order('created_at_ms', { ascending: true })
    .setHeader('Authorization', `Bearer ${access.accessToken}`)
    .abortSignal(access.signal);

  checkAccess(access);
  if (planetsError) throw planetsError;

  const { data: remoteNotes, error: notesError } = await client
    .from('seed_notes')
    .select('id,user_id,planet_id,data')
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
  }));

  const noteRows: NoteRow[] = snapshot.notes.map(note => ({
    id: note.id,
    user_id: access.userId,
    planet_id: note.planetId || 'personal',
    data: note,
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
