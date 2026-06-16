import { SeedNote } from './types';

export type FocusNoteMap = Record<string, string>;

export function normalizeFocusNoteMap(value: unknown): FocusNoteMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<FocusNoteMap>((memo, [id, note]) => {
    if (typeof id === 'string' && typeof note === 'string' && note.trim()) {
      memo[id] = note;
    }
    return memo;
  }, {});
}

export function migrateFocusNotesIntoSeeds(notes: SeedNote[], focusNotes: FocusNoteMap, timestamp = Date.now()) {
  if (Object.keys(focusNotes).length === 0) return notes;

  let changed = false;
  const migrated = notes.map(note => {
    const focusNote = focusNotes[note.id]?.trim();
    if (!focusNote || note.focusNote?.trim()) return note;

    changed = true;
    return {
      ...note,
      focusNote,
      updatedAt: Math.max(note.updatedAt || note.createdAt || 0, timestamp),
    };
  });

  return changed ? migrated : notes;
}
