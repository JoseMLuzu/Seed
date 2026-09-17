import type { JournalMood, SeedNote } from './types';
import { createDailyEntryNote, dailyEntryId, isDailyEntryNote, localDateKey } from './seedLogic';

export const JOURNAL_MOODS: { id: JournalMood; symbol: string; es: string; en: string }[] = [
  { id: 'clear', symbol: '☀️', es: 'Claridad', en: 'Clarity' },
  { id: 'calm', symbol: '🌥', es: 'Calma', en: 'Calm' },
  { id: 'rain', symbol: '🌧', es: 'Dificultad', en: 'Difficulty' },
  { id: 'beginnings', symbol: '🌱', es: 'Comienzos', en: 'Beginnings' },
];

export function journalReflection(note: SeedNote) {
  // An explicitly empty modern reflection must not resurrect generated closure text.
  return (note.dailyEntry ? note.dailyEntry.reflection || '' : note.reflection || '').trim();
}

export function getJournalEntries(notes: SeedNote[]) {
  return notes.filter(note => isDailyEntryNote(note) && Boolean(journalReflection(note) || note.dailyEntry?.journalMood || note.dailyEntry?.journalUpdatedAt || note.dailyEntry?.closedAt || note.tags.includes('daily-closure')))
    .sort((a, b) => (b.dailyEntry?.date || localDateKey(b.harvestedAt || b.createdAt)).localeCompare(a.dailyEntry?.date || localDateKey(a.harvestedAt || a.createdAt)) || (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
}

export function saveJournalEntry({ existing, planetId, reflection, mood, linkedNoteId, language, now = Date.now() }: {
  existing?: SeedNote; planetId: string; reflection: string; mood?: JournalMood; linkedNoteId?: string; language: 'es' | 'en'; now?: number;
}): SeedNote {
  const base = existing || createDailyEntryNote({ id: dailyEntryId(planetId, now), intention: '', planetId, language, now });
  const text = reflection.trim();
  return {
    ...base,
    updatedAt: now,
    title: base.dailyEntry?.closedAt ? base.title : language === 'en' ? 'Gardener’s journal' : 'Diario del jardinero',
    content: text,
    reflection: text,
    takeaway: base.dailyEntry?.closedAt ? text || base.takeaway : base.takeaway,
    systemKind: 'daily-entry',
    dailyEntry: {
      ...base.dailyEntry,
      version: 1,
      date: base.dailyEntry?.date || localDateKey(base.harvestedAt || base.createdAt),
      intention: base.dailyEntry?.intention || '',
      startedAt: base.dailyEntry?.startedAt || base.createdAt,
      reflection: text,
      journalMood: mood,
      journalLinkedNoteId: linkedNoteId,
      journalUpdatedAt: now,
    },
  };
}
