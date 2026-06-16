import assert from 'node:assert/strict';
import {
  addFocusMinutes,
  createDailyClosureNote,
  cultivateInboxNote,
  getDailyActivitySummary,
  isDailyClosureForDate,
  isSameLocalDay,
  toggleTaskForNote,
  waterNote,
  wateringDue,
} from './seedLogic';
import { migrateFocusNotesIntoSeeds, normalizeFocusNoteMap } from './focusNotes';
import { normalizeNote, normalizeNotes } from './normalize';
import { SeedNote } from './types';

const now = new Date(2024, 0, 15, 12, 0, 0).getTime();

function note(overrides: Partial<SeedNote> = {}): SeedNote {
  return {
    id: 'seed-1',
    title: 'Test seed',
    content: 'A useful idea',
    createdAt: now - 3 * 24 * 60 * 60 * 1000,
    tags: [],
    isGrowth: false,
    tasks: [],
    growthStage: 'seed',
    ...overrides,
  };
}

const inbox = cultivateInboxNote(note({ inbox: true, paused: true }), now);
assert.equal(inbox.inbox, false);
assert.equal(inbox.paused, false);
assert.equal(inbox.lastWateredAt, now);

const thirsty = note({ lastWateredAt: now - 2 * 24 * 60 * 60 * 1000, wateringIntervalDays: 1 });
assert.equal(wateringDue(thirsty, now), true);
assert.equal(wateringDue({ ...thirsty, wateringIntervalDays: 7 }, now), false);

const watered = waterNote(note({ paused: true }), 'Sigue viva', now);
assert.equal(watered.paused, false);
assert.equal(watered.lastWateringNote, 'Sigue viva');

const focused = addFocusMinutes(note({ focusedMinutes: 10 }), 25, now);
assert.equal(focused.focusedMinutes, 35);
assert.equal(focused.lastWateredAt, now);

const harvested = toggleTaskForNote(note({
  isGrowth: true,
  growthStage: 'sprout',
  tasks: [{ id: 'task-1', text: 'Ship it', completed: false }],
}), 'task-1', now);
assert.equal(harvested.growthStage, 'bloom');
assert.equal(harvested.tasks[0].completed, true);
assert.equal(harvested.harvestedAt, now);

const normalized = normalizeNote({
  id: 'legacy-note',
  title: 'Legacy',
  createdAt: now,
  tasks: [{ id: 'task-legacy', completed: 1 }],
});
assert.equal(normalized?.tags.length, 0);
assert.equal(normalized?.tasks[0].text, '');
assert.equal(normalized?.growthStage, 'sprout');
assert.equal(normalized?.wateringIntervalDays, 1);
assert.equal(normalizeNote({ id: 'focus', title: 'Focus', createdAt: now, focusNote: 'Keep this context' })?.focusNote, 'Keep this context');
assert.equal(normalizeNotes([{ id: 'ok', title: 'Ok', createdAt: now }, null]).length, 1);

assert.deepEqual(normalizeFocusNoteMap({ 'seed-1': 'Focus memo', empty: '', bad: 12 }), { 'seed-1': 'Focus memo' });
const migratedFocusNotes = migrateFocusNotesIntoSeeds([note({ id: 'seed-1' }), note({ id: 'seed-2', focusNote: 'Existing' })], {
  'seed-1': 'Bring this into the note',
  'seed-2': 'Should not overwrite',
}, now);
assert.equal(migratedFocusNotes[0].focusNote, 'Bring this into the note');
assert.equal(migratedFocusNotes[0].updatedAt, now);
assert.equal(migratedFocusNotes[1].focusNote, 'Existing');
assert.equal(migrateFocusNotesIntoSeeds([note()], {}, now)[0].focusNote, undefined);

assert.equal(isSameLocalDay(now, now + 2 * 60 * 60 * 1000), true);
assert.equal(isSameLocalDay(now - 2 * 24 * 60 * 60 * 1000, now), false);

const dailySummary = getDailyActivitySummary([
  note({ id: 'created-today', createdAt: now }),
  note({ id: 'watered-today', createdAt: now - 2 * 24 * 60 * 60 * 1000, lastWateredAt: now }),
  note({
    id: 'step-today',
    createdAt: now - 2 * 24 * 60 * 60 * 1000,
    updatedAt: now,
    isGrowth: true,
    tasks: [{ id: 'step', text: 'Done', completed: true }],
  }),
  note({ id: 'harvested-today', createdAt: now - 3 * 24 * 60 * 60 * 1000, harvestedAt: now, growthStage: 'bloom' }),
], 'es', now);
assert.equal(dailySummary, '1 plantadas · 1 riegos · 1 avances · 1 cosechas');

const dailyClosure = createDailyClosureNote({
  id: 'daily-close',
  notes: [note({ createdAt: now })],
  reflection: '  Aprendí algo pequeño.  ',
  intention: '  Cuidar una idea  ',
  intentionOutcome: 'some',
  defaultWateringInterval: 3,
  planetId: 'personal',
  language: 'es',
  now,
});
assert.equal(dailyClosure.title, 'Cierre del día');
assert.equal(dailyClosure.tags.includes('daily-closure'), true);
assert.equal(dailyClosure.reflection, 'Aprendí algo pequeño.');
assert.equal(dailyClosure.takeaway, 'Intención lograda: un poco');
assert.equal(dailyClosure.wateringIntervalDays, 3);
assert.equal(isDailyClosureForDate(dailyClosure, now), true);
assert.equal(isDailyClosureForDate(dailyClosure, now + 2 * 24 * 60 * 60 * 1000), false);

console.log('seed logic tests passed');
