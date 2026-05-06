import assert from 'node:assert/strict';
import { addFocusMinutes, cultivateInboxNote, toggleTaskForNote, waterNote, wateringDue } from './seedLogic';
import { SeedNote } from './types';

const now = 1_700_000_000_000;

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

console.log('seed logic tests passed');
