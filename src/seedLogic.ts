import { SeedNote } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DAILY_CLOSURE_TAG = 'daily-closure';

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

function dateKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isSameLocalDay(left: number | undefined, right = Date.now()) {
  return Boolean(left) && dateKey(left) === dateKey(right);
}

export function isDailyClosureForDate(note: SeedNote, date = Date.now()) {
  const noteDate = note.harvestedAt || note.createdAt;
  const legacyDailyClosure = note.title === 'Cierre del día' || note.title === 'Today closure';
  return (
    note.seedType === 'learning' &&
    note.growthStage === 'bloom' &&
    isSameLocalDay(noteDate, date) &&
    (note.tags?.includes(DAILY_CLOSURE_TAG) || legacyDailyClosure)
  );
}

export function getDailyActivitySummary(notes: SeedNote[], language: 'en' | 'es', now = Date.now()) {
  const todayNotes = notes.filter(note => isSameLocalDay(note.createdAt, now));
  const todayWatered = notes.filter(note => isSameLocalDay(note.lastWateredAt, now));
  const todayHarvests = notes.filter(note => isSameLocalDay(note.harvestedAt, now));
  const todaySteps = notes.filter(note =>
    isSameLocalDay(note.updatedAt, now) &&
    note.tasks.some(task => task.completed)
  );

  return language === 'en'
    ? `${todayNotes.length} planted · ${todayWatered.length} watered · ${todaySteps.length} moved · ${todayHarvests.length} harvested`
    : `${todayNotes.length} plantadas · ${todayWatered.length} riegos · ${todaySteps.length} avances · ${todayHarvests.length} cosechas`;
}

export function createDailyClosureNote({
  id,
  notes,
  reflection,
  intention,
  intentionOutcome = '',
  defaultWateringInterval,
  planetId,
  language,
  now = Date.now(),
}: {
  id: string;
  notes: SeedNote[];
  reflection: string;
  intention: string;
  intentionOutcome?: 'yes' | 'some' | 'no' | '';
  defaultWateringInterval: number;
  planetId: string;
  language: 'en' | 'es';
  now?: number;
}): SeedNote {
  const cleanedReflection = reflection.trim();
  const cleanedIntention = intention.trim();
  const outcomeText = intentionOutcome === 'yes'
    ? language === 'en' ? 'Intention moved: yes' : 'Intención lograda: sí'
    : intentionOutcome === 'some'
      ? language === 'en' ? 'Intention moved: a little' : 'Intención lograda: un poco'
      : intentionOutcome === 'no'
        ? language === 'en' ? 'Intention moved: not today' : 'Intención lograda: no hoy'
        : '';
  const summary = getDailyActivitySummary(notes, language, now);
  const content = [
    cleanedIntention
      ? language === 'en'
        ? `Intention: ${cleanedIntention}`
        : `Intención: ${cleanedIntention}`
      : null,
    outcomeText || null,
    summary,
    cleanedReflection,
  ].filter(Boolean).join('\n\n');

  return {
    id,
    title: language === 'en' ? 'Today closure' : 'Cierre del día',
    content,
    createdAt: now,
    updatedAt: now,
    tags: [DAILY_CLOSURE_TAG],
    isGrowth: false,
    tasks: [],
    growthStage: 'bloom',
    lastWateredAt: now,
    wateringIntervalDays: defaultWateringInterval,
    inbox: false,
    seedType: 'learning',
    priority: 'normal',
    reflection: cleanedReflection || content,
    takeaway: outcomeText || cleanedIntention || summary,
    harvestedAt: now,
    planetId,
  };
}
