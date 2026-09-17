import type { SeedNote } from './types';
import { isDailyEntryNote } from './seedLogic';

export interface UpcomingItem {
  note: SeedNote;
  daysUntilDue: number | null;
  dueSoon: boolean;
  important: boolean;
}

// Compare calendar days in the user's timezone, not 24-hour periods (DST).
function calendarDay(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

export function getUpcomingItems(notes: readonly SeedNote[], now = Date.now()): UpcomingItem[] {
  const today = calendarDay(now);
  return notes
    .filter(note => !note.paused && note.growthStage !== 'bloom' && note.growthStage !== 'withered' && !isDailyEntryNote(note))
    .filter(note => !(note.isGrowth && note.tasks.length > 0 && note.tasks.every(task => task.completed)))
    .map(note => {
      const validDate = typeof note.dueDate === 'number' && Number.isFinite(new Date(note.dueDate).getTime());
      const daysUntilDue = validDate ? calendarDay(note.dueDate!) - today : null;
      return { note, daysUntilDue, dueSoon: daysUntilDue !== null && daysUntilDue <= 7, important: note.priority === 'important' };
    })
    .filter(item => item.dueSoon || item.important)
    .sort((a, b) =>
      Number(b.dueSoon) - Number(a.dueSoon) ||
      (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity) ||
      Number(b.important) - Number(a.important) ||
      (b.note.updatedAt || b.note.createdAt) - (a.note.updatedAt || a.note.createdAt) ||
      a.note.id.localeCompare(b.note.id));
}
