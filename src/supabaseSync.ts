import { User } from '@supabase/supabase-js';
import { Planet, SeedNote, SyncSnapshot } from './types';
import { supabase } from './supabase';

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

function normalizeRemoteNote(row: NoteRow): SeedNote {
  return {
    ...row.data,
    planetId: row.data.planetId || row.planet_id || 'personal',
  };
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

export async function fetchGardenFromSupabase(): Promise<SyncSnapshot> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data: remotePlanets, error: planetsError } = await supabase
    .from('seed_planets')
    .select('id,user_id,name,description,theme,created_at_ms')
    .order('created_at_ms', { ascending: true });

  if (planetsError) throw planetsError;

  const { data: remoteNotes, error: notesError } = await supabase
    .from('seed_notes')
    .select('id,user_id,planet_id,data');

  if (notesError) throw notesError;

  return {
    planets: (remotePlanets || []).map(row => normalizeRemotePlanet(row as PlanetRow)),
    notes: dedupeNotes((remoteNotes || []).map(row => normalizeRemoteNote(row as NoteRow))),
  };
}

export async function pushGardenToSupabase(snapshot: SyncSnapshot, user: User) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const planetRows: PlanetRow[] = snapshot.planets.map(planet => ({
    id: planet.id,
    user_id: user.id,
    name: planet.name,
    description: planet.description || '',
    theme: planet.theme,
    created_at_ms: planet.createdAt || Date.now(),
  }));

  const noteRows: NoteRow[] = snapshot.notes.map(note => ({
    id: note.id,
    user_id: user.id,
    planet_id: note.planetId || 'personal',
    data: note,
  }));

  if (planetRows.length > 0) {
    const { error } = await supabase.from('seed_planets').upsert(planetRows, { onConflict: 'id,user_id' });
    if (error) throw error;
  }

  if (noteRows.length > 0) {
    const { error } = await supabase.from('seed_notes').upsert(noteRows, { onConflict: 'id,user_id' });
    if (error) throw error;
  }
}

export async function syncGardenWithSupabase(snapshot: SyncSnapshot, user: User): Promise<SyncSnapshot> {
  const remote = await fetchGardenFromSupabase();
  const remoteNotesById = new Map(remote.notes.map(note => [note.id, note]));
  const notesToPush = snapshot.notes.filter(note => {
    const remoteNote = remoteNotesById.get(note.id);
    return !remoteNote || noteUpdatedAt(note) >= noteUpdatedAt(remoteNote);
  });

  await pushGardenToSupabase({ planets: snapshot.planets, notes: notesToPush }, user);
  return fetchGardenFromSupabase();
}

export async function deleteNoteFromSupabase(id: string, user: User) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase
    .from('seed_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function deletePlanetFromSupabase(id: string, user: User) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error: notesError } = await supabase
    .from('seed_notes')
    .delete()
    .eq('planet_id', id)
    .eq('user_id', user.id);
  if (notesError) throw notesError;

  const { error } = await supabase
    .from('seed_planets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}
