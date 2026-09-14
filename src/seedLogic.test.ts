import assert from 'node:assert/strict';
import {
  addFocusMinutes,
  createDailyClosureNote,
  createDailyEntryNote,
  cultivateInboxNote,
  dailyEntryId,
  getDailyActivitySnapshot,
  getDailyActivitySummary,
  getDailyEntryForDate,
  getSuggestedIntentionOutcome,
  isDailyClosureForDate,
  isDailyEntryNote,
  isSameLocalDay,
  toggleTaskForNote,
  updateDailyEntryFocus,
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
assert.deepEqual(focused.focusHistory, [{ startedAt: now - 25 * 60 * 1000, endedAt: now, minutes: 25 }]);

const harvested = toggleTaskForNote(note({
  isGrowth: true,
  growthStage: 'sprout',
  tasks: [{ id: 'task-1', text: 'Ship it', completed: false }],
}), 'task-1', now);
assert.equal(harvested.growthStage, 'bloom');
assert.equal(harvested.tasks[0].completed, true);
assert.equal(harvested.tasks[0].completedAt, now);
assert.equal(harvested.harvestedAt, now);
const reopened = toggleTaskForNote(harvested, 'task-1', now + 1);
assert.equal(reopened.tasks[0].completed, false);
assert.equal(reopened.tasks[0].completedAt, undefined);

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
    tasks: [{ id: 'step', text: 'Done', completed: true, completedAt: now }],
  }),
  note({ id: 'harvested-today', createdAt: now - 3 * 24 * 60 * 60 * 1000, harvestedAt: now, growthStage: 'bloom' }),
  note({ id: 'focused-today', focusHistory: [{ startedAt: now - 25 * 60 * 1000, endedAt: now, minutes: 25 }] }),
], 'es', now);
assert.equal(dailySummary, '1 plantadas · 1 riegos · 1 pasos · 1 cosechas · 25 min de foco');

const dailyActivity = getDailyActivitySnapshot([
  note({ id: 'step-today', tasks: [{ id: 'step', text: 'Done', completed: true, completedAt: now }] }),
  note({ id: 'focused-today', focusHistory: [
    { startedAt: now - 15 * 60 * 1000, endedAt: now, minutes: 15 },
    { startedAt: now - 2 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000, endedAt: now - 2 * 24 * 60 * 60 * 1000, minutes: 30 },
  ] }),
], now);
assert.equal(dailyActivity.steps, 1);
assert.equal(dailyActivity.focusMinutes, 15);

const dailyPlan = createDailyEntryNote({
  id: 'daily-plan',
  intention: 'Ship the useful version',
  linkedNoteId: 'seed-1',
  planetId: 'personal',
  language: 'en',
  now,
});
assert.equal(dailyEntryId('personal', now), 'daily-entry:personal:2024-01-15');
assert.equal(isDailyEntryNote(dailyPlan), true);
assert.equal(dailyPlan.dailyEntry?.intention, 'Ship the useful version');
assert.equal(getDailyEntryForDate([dailyPlan], now, 'personal')?.id, 'daily-plan');
const editedDailyPlan = updateDailyEntryFocus(dailyPlan, 'Ship one step', 'seed-1', now + 1);
assert.equal(editedDailyPlan.dailyEntry?.intention, 'Ship one step');

const dailyClosure = createDailyClosureNote({
  id: 'daily-close',
  notes: [note({ createdAt: now })],
  reflection: '  Aprendí algo pequeño.  ',
  intention: '  Cuidar una idea  ',
  intentionOutcome: 'some',
  linkedNoteId: 'seed-1',
  nextStep: 'tomorrow',
  existingEntry: dailyPlan,
  defaultWateringInterval: 3,
  planetId: 'personal',
  language: 'es',
  now,
});
assert.equal(dailyClosure.title, 'Cierre del día');
assert.equal(dailyClosure.tags.includes('daily-closure'), true);
assert.equal(dailyClosure.reflection, 'Aprendí algo pequeño.');
assert.equal(dailyClosure.takeaway, 'Aprendí algo pequeño.');
assert.equal(dailyClosure.wateringIntervalDays, 3);
assert.equal(dailyClosure.id, dailyPlan.id);
assert.equal(dailyClosure.dailyEntry?.linkedNoteId, 'seed-1');
assert.equal(dailyClosure.dailyEntry?.nextStep, 'tomorrow');
assert.equal(dailyClosure.dailyEntry?.closedAt, now);
assert.equal(isDailyClosureForDate(dailyClosure, now), true);
assert.equal(isDailyClosureForDate(dailyClosure, now + 2 * 24 * 60 * 60 * 1000), false);
const normalizedDailyClosure = normalizeNote(dailyClosure);
assert.equal(normalizedDailyClosure?.systemKind, 'daily-entry');
assert.equal(normalizedDailyClosure?.dailyEntry?.intention, 'Cuidar una idea');
assert.equal(normalizedDailyClosure?.dailyEntry?.activity?.planted, 1);

const normalizedActivityNote = normalizeNote(note({
  tasks: [{ id: 'dated-step', text: 'Done', completed: true, completedAt: now }],
  focusHistory: [{ startedAt: now - 20 * 60 * 1000, endedAt: now, minutes: 20 }],
}));
assert.equal(normalizedActivityNote?.tasks[0].completedAt, now);
assert.deepEqual(normalizedActivityNote?.focusHistory, [{ startedAt: now - 20 * 60 * 1000, endedAt: now, minutes: 20 }]);

assert.equal(getSuggestedIntentionOutcome(undefined, now), '');
assert.equal(getSuggestedIntentionOutcome(note({ growthStage: 'bloom', harvestedAt: now }), now), 'yes');
assert.equal(getSuggestedIntentionOutcome(note({ lastWateredAt: now }), now), 'some');
assert.equal(getSuggestedIntentionOutcome(note({ updatedAt: now }), now), 'some');
assert.equal(getSuggestedIntentionOutcome(note(), now), 'no');

console.log('seed logic tests passed');
