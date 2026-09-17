import { createDailyEntryNote, dailyEntryId, getDailyEntryForDate, isSameLocalDay, toggleTaskForNote, updateDailyEntryFocus } from './seedLogic';
import type { SeedNote } from './types';

export function getDailyFocusState(entry: SeedNote | undefined, notes: SeedNote[]) {
  const data = entry?.dailyEntry;
  const linkedNote = notes.find(note => note.id === data?.linkedNoteId && note.planetId === entry?.planetId);
  const task = linkedNote?.tasks.find(task => task.id === data?.linkedTaskId);
  return {
    intention: data?.intention.trim() || '',
    linkedNote,
    task,
    complete: data?.closedAt ? data.outcome === 'yes' || (!data.outcome && Boolean(data.focusCompletedAt)) : task ? task.completed : Boolean(data?.focusCompletedAt),
    sourceMissing: Boolean(data?.linkedTaskId && !task),
    closed: Boolean(data?.closedAt),
  };
}

export function getDailyFocusOutcome(entry: SeedNote | undefined, notes: SeedNote[], now = Date.now()) {
  const focus = getDailyFocusState(entry, notes);
  if (!focus.intention) return '';
  if (focus.complete) return 'yes';
  if (entry?.focusHistory?.some(session => isSameLocalDay(session.endedAt, now))) return 'some';
  return 'no';
}

export function saveDailyFocusEntry(notes: SeedNote[], { intention, linkedNoteId, linkedTaskId, planetId, language, now = Date.now() }: {
  intention: string; linkedNoteId?: string; linkedTaskId?: string; planetId: string; language: 'es' | 'en'; now?: number;
}): SeedNote[] {
  const existing = getDailyEntryForDate(notes, now, planetId);
  if (existing?.dailyEntry?.closedAt || (!existing && !intention.trim())) return notes;
  const source = notes.find(note => note.id === linkedNoteId && note.planetId === planetId);
  const validTaskId = source?.tasks.some(task => task.id === linkedTaskId) ? linkedTaskId : undefined;
  const validNoteId = intention.trim() && source ? source.id : undefined;
  const base = existing || createDailyEntryNote({ id: dailyEntryId(planetId, now), intention, planetId, language, now });
  const next = updateDailyEntryFocus(base, intention, validNoteId, now, validTaskId);
  // Clearing an intention must never delete the shared journal/day record.
  return existing ? notes.map(note => note.id === existing.id ? next : note) : [next, ...notes];
}

export function toggleDailyFocusCompletion(notes: SeedNote[], entryId: string, now = Date.now()): SeedNote[] {
  const entry = notes.find(note => note.id === entryId);
  const focus = getDailyFocusState(entry, notes);
  if (!entry?.dailyEntry || !focus.intention || focus.closed) return notes;
  const completed = !focus.complete;
  return notes.map(note => {
    if (focus.task && note.id === focus.linkedNote?.id) return { ...toggleTaskForNote(note, focus.task.id, now), updatedAt: now };
    if (note.id !== entryId) return note;
    return { ...note, updatedAt: now, dailyEntry: { ...entry.dailyEntry!, focusCompletedAt: completed ? now : undefined } };
  });
}

export function logDailyFocusSession(notes: SeedNote[], entryId: string, minutes: number, now = Date.now()): SeedNote[] {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  if (!safeMinutes) return notes;
  return notes.map(note => {
    if (note.id !== entryId || !note.dailyEntry?.intention.trim() || note.dailyEntry.closedAt) return note;
    return { ...note, updatedAt: now, focusedMinutes: (note.focusedMinutes || 0) + safeMinutes,
      focusHistory: [...(note.focusHistory || []), { startedAt: now - safeMinutes * 60_000, endedAt: now, minutes: safeMinutes }] };
  });
}
