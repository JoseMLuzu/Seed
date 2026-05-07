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

export async function syncGardenWithSupabase(snapshot: SyncSnapshot, user: User): Promise<SyncSnapshot> {
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
    planets: (remotePlanets || []).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      theme: row.theme,
      createdAt: row.created_at_ms || Date.now(),
    })),
    notes: (remoteNotes || []).map(row => ({
      ...row.data,
      planetId: row.data.planetId || row.planet_id || 'personal',
    })),
  };
}
