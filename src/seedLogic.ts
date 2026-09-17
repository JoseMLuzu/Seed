import { DailyActivitySnapshot, DailyIntentionOutcome, DailyNextStep, SeedNote } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DAILY_CLOSURE_TAG = 'daily-closure';
export const DAILY_ENTRY_TAG = 'daily-entry';

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
  const tasks = note.tasks.map(task => task.id === taskId
    ? { ...task, completed: !task.completed, completedAt: task.completed ? undefined : now }
    : task);
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
  const safeMinutes = Math.max(0, Math.round(minutes));
  return {
    ...note,
    focusedMinutes: (note.focusedMinutes || 0) + safeMinutes,
    focusHistory: safeMinutes > 0 ? [...(note.focusHistory || []), {
      startedAt: now - safeMinutes * 60 * 1000,
      endedAt: now,
      minutes: safeMinutes,
    }] : note.focusHistory,
    lastWateredAt: now,
  };
}

export function localDateKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailyEntryId(planetId: string, timestamp = Date.now()) {
  return `daily-entry:${encodeURIComponent(planetId)}:${localDateKey(timestamp)}`;
}

export function isSameLocalDay(left: number | undefined, right = Date.now()) {
  return Boolean(left) && localDateKey(left) === localDateKey(right);
}

export function isDailyEntryNote(note: SeedNote) {
  return note.systemKind === 'daily-entry' || note.tags?.includes(DAILY_ENTRY_TAG) || note.tags?.includes(DAILY_CLOSURE_TAG);
}

export function getDailyEntryForDate(notes: SeedNote[], date = Date.now(), planetId?: string) {
  const targetDate = localDateKey(date);
  return notes
    .filter(note => isDailyEntryNote(note))
    .filter(note => !planetId || note.planetId === planetId)
    .filter(note => note.dailyEntry?.date === targetDate || (!note.dailyEntry && isSameLocalDay(note.harvestedAt || note.createdAt, date)))
    .sort((left, right) => (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt))[0];
}

export function getDailyActivitySnapshot(notes: SeedNote[], now = Date.now()): DailyActivitySnapshot {
  const gardenNotes = notes.filter(note => !isDailyEntryNote(note));
  return {
    planted: gardenNotes.filter(note => isSameLocalDay(note.createdAt, now)).length,
    watered: gardenNotes.filter(note => isSameLocalDay(note.lastWateredAt, now)).length,
    steps: gardenNotes.reduce((total, note) => total + note.tasks.filter(task => isSameLocalDay(task.completedAt, now)).length, 0),
    harvests: gardenNotes.filter(note => isSameLocalDay(note.harvestedAt, now)).length,
    focusMinutes: notes.reduce((total, note) => total + (note.focusHistory || [])
      .filter(session => isSameLocalDay(session.endedAt, now))
      .reduce((minutes, session) => minutes + session.minutes, 0), 0),
  };
}

export function createDailyEntryNote({
  id,
  intention,
  linkedNoteId,
  planetId,
  language,
  now = Date.now(),
}: {
  id: string;
  intention: string;
  linkedNoteId?: string;
  planetId: string;
  language: 'en' | 'es';
  now?: number;
}): SeedNote {
  const cleanedIntention = intention.trim();
  return {
    id,
    planetId,
    title: language === 'en' ? `Daily plan · ${localDateKey(now)}` : `Plan diario · ${localDateKey(now)}`,
    content: cleanedIntention,
    createdAt: now,
    updatedAt: now,
    tags: [DAILY_ENTRY_TAG],
    isGrowth: false,
    tasks: [],
    growthStage: 'seed',
    wateringIntervalDays: 36500,
    inbox: false,
    paused: false,
    seedType: 'learning',
    priority: 'normal',
    systemKind: 'daily-entry',
    dailyEntry: {
      version: 1,
      date: localDateKey(now),
      intention: cleanedIntention,
      linkedNoteId,
      startedAt: now,
    },
  };
}

export function updateDailyEntryFocus(note: SeedNote, intention: string, linkedNoteId: string | undefined, now = Date.now(), linkedTaskId?: string): SeedNote {
  const cleanedIntention = intention.trim();
  const changed = cleanedIntention !== note.dailyEntry?.intention || linkedNoteId !== note.dailyEntry?.linkedNoteId || linkedTaskId !== note.dailyEntry?.linkedTaskId;
  return {
    ...note,
    content: cleanedIntention,
    updatedAt: now,
    dailyEntry: {
      ...note.dailyEntry,
      version: 1,
      date: note.dailyEntry?.date || localDateKey(now),
      intention: cleanedIntention,
      linkedNoteId,
      linkedTaskId: cleanedIntention ? linkedTaskId : undefined,
      focusCompletedAt: changed ? undefined : note.dailyEntry?.focusCompletedAt,
      startedAt: note.dailyEntry?.startedAt || note.createdAt || now,
      outcome: note.dailyEntry?.outcome,
      reflection: note.dailyEntry?.reflection,
      nextStep: note.dailyEntry?.nextStep,
      activity: note.dailyEntry?.activity,
      closedAt: note.dailyEntry?.closedAt,
      dismissedAt: note.dailyEntry?.dismissedAt,
      continuedAt: note.dailyEntry?.continuedAt,
    },
  };
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

export function getSuggestedIntentionOutcome(note: SeedNote | undefined, now = Date.now()): DailyIntentionOutcome {
  if (!note) return '';
  if (isSameLocalDay(note.harvestedAt, now)) return 'yes';
  if (
    isSameLocalDay(note.lastWateredAt, now) ||
    isSameLocalDay(note.updatedAt, now) ||
    note.tasks.some(task => isSameLocalDay(task.completedAt, now)) ||
    (note.focusHistory || []).some(session => isSameLocalDay(session.endedAt, now))
  ) return 'some';
  return 'no';
}

export function getDailyActivitySummary(notes: SeedNote[], language: 'en' | 'es', now = Date.now()) {
  const activity = getDailyActivitySnapshot(notes, now);

  return language === 'en'
    ? `${activity.planted} planted · ${activity.watered} watered · ${activity.steps} steps · ${activity.harvests} harvested · ${activity.focusMinutes} min focused`
    : `${activity.planted} plantadas · ${activity.watered} riegos · ${activity.steps} pasos · ${activity.harvests} cosechas · ${activity.focusMinutes} min de foco`;
}

export function createDailyClosureNote({
  id,
  notes,
  reflection,
  intention,
  intentionOutcome = '',
  linkedNoteId,
  nextStep = '',
  existingEntry,
  defaultWateringInterval,
  planetId,
  language,
  now = Date.now(),
}: {
  id: string;
  notes: SeedNote[];
  reflection: string;
  intention: string;
  intentionOutcome?: DailyIntentionOutcome;
  linkedNoteId?: string;
  nextStep?: DailyNextStep;
  existingEntry?: SeedNote;
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
  const activity = getDailyActivitySnapshot(notes, now);
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
    ...existingEntry,
    id: existingEntry?.id || id,
    title: language === 'en' ? 'Today closure' : 'Cierre del día',
    content,
    createdAt: existingEntry?.createdAt || now,
    updatedAt: now,
    tags: [DAILY_ENTRY_TAG, DAILY_CLOSURE_TAG],
    isGrowth: false,
    tasks: [],
    growthStage: 'bloom',
    lastWateredAt: now,
    wateringIntervalDays: defaultWateringInterval,
    inbox: false,
    seedType: 'learning',
    priority: 'normal',
    reflection: cleanedReflection || content,
    takeaway: cleanedReflection || outcomeText || cleanedIntention || summary,
    harvestedAt: now,
    planetId,
    systemKind: 'daily-entry',
    dailyEntry: {
      ...existingEntry?.dailyEntry,
      version: 1,
      date: localDateKey(now),
      intention: cleanedIntention,
      linkedNoteId,
      outcome: intentionOutcome,
      reflection: cleanedReflection,
      nextStep,
      activity,
      startedAt: existingEntry?.dailyEntry?.startedAt || existingEntry?.createdAt || now,
      closedAt: now,
    },
  };
}
