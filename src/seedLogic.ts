import { SeedNote } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(timestamp: number | undefined, now = Date.now()) {
  if (!timestamp) return Infinity;
  return Math.floor((now - timestamp) / DAY_MS);
}

export function wateringDue(note: SeedNote, now = Date.now()) {
  return daysSince(note.lastWateredAt || note.createdAt, now) >= (note.wateringIntervalDays || 1);
}

export function cultivateInboxNote(note: SeedNote, now = Date.now()): SeedNote {
  return { ...note, inbox: false, paused: false, lastWateredAt: now };
}

export function waterNote(note: SeedNote, message = 'Revisada: sigue viva', now = Date.now()): SeedNote {
  return { ...note, lastWateredAt: now, lastWateringNote: message, paused: false };
}

export function toggleTaskForNote(note: SeedNote, taskId: string, now = Date.now()): SeedNote {
  const tasks = note.tasks.map(task => task.id === taskId ? { ...task, completed: !task.completed } : task);
  const allCompleted = tasks.length > 0 && tasks.every(task => task.completed);
  return {
    ...note,
    tasks,
    growthStage: allCompleted ? 'bloom' : 'sprout',
    harvestedAt: allCompleted ? note.harvestedAt || now : undefined,
    lastWateredAt: now,
  };
}

export function addFocusMinutes(note: SeedNote, minutes: number, now = Date.now()): SeedNote {
  return {
    ...note,
    focusedMinutes: (note.focusedMinutes || 0) + minutes,
    lastWateredAt: now,
  };
}
