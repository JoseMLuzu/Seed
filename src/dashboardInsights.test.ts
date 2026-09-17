import assert from 'node:assert/strict';
import test from 'node:test';
import type { SeedNote } from './types';
import { DAY_MS, waterNote, toggleTaskForNote } from './seedLogic';
import { getNoteCareState, getGroupCareState, getGardenMovement, getDailyHarvest, getContinuationProject, readReviewSnoozes, parseLocalDueDate } from './dashboardInsights';

const now = new Date(2026, 8, 16, 13).getTime();
const note = (id: string, overrides: Partial<SeedNote> = {}): SeedNote => ({
  id, title: id, content: '', createdAt: now - 3 * DAY_MS, tags: [], isGrowth: false, tasks: [], growthStage: 'seed', ...overrides,
});

test('care uses the watering interval, never a deadline or priority', () => {
  const thirsty = note('thirsty', { wateringIntervalDays: 2, dueDate: now + 30 * DAY_MS });
  assert.equal(getNoteCareState(thirsty, now), 'water');
  assert.equal(getNoteCareState(waterNote(thirsty, '', now), now), 'sun');
  assert.equal(getNoteCareState(note('fresh', { lastWateredAt: now, dueDate: now - DAY_MS, priority: 'important' }), now), 'sun');
  assert.equal(getNoteCareState(note('weekly', { wateringIntervalDays: 7 }), now), 'sun');
});

test('inactive, completed and system notes never request water or show a false sun', () => {
  for (const overrides of [{ paused: true }, { growthStage: 'bloom' as const }, { growthStage: 'withered' as const }, { systemKind: 'daily-entry' as const }, { tags: ['daily-entry'] }, { isGrowth: true, tasks: [{ id: 't', text: 'Done', completed: true }] }]) {
    assert.equal(getNoteCareState(note('inactive', overrides), now), null);
  }
});

test('group status reflects real active members and does not label empty groups', () => {
  assert.equal(getGroupCareState([], now), null);
  assert.equal(getGroupCareState([note('closed', { paused: true })], now), null);
  assert.equal(getGroupCareState([note('old'), note('fresh', { lastWateredAt: now })], now), 'water');
  assert.equal(getGroupCareState([note('fresh', { lastWateredAt: now })], now), 'sun');
});

test('finishing a step updates care and finishing a project removes watering', () => {
  const project = note('project', { isGrowth: true, tasks: [{ id: 'a', text: 'A', completed: false }, { id: 'b', text: 'B', completed: false }] });
  const moved = toggleTaskForNote(project, 'a', now);
  assert.equal(getNoteCareState(moved, now), 'sun');
  assert.equal(getNoteCareState(toggleTaskForNote(moved, 'b', now), now), null);
});

test('movement counts recent ideas, actionable projects and real harvest dates', () => {
  const items = [note('new', { inbox: true }), note('old', { inbox: true, createdAt: now - 10 * DAY_MS }), note('paused', { inbox: true, paused: true }), note('project', { isGrowth: true, tasks: [{ id: 'a', text: 'A', completed: false }] }), note('no-step', { isGrowth: true }), note('harvest', { growthStage: 'bloom', harvestedAt: now }), note('old-harvest', { growthStage: 'bloom', harvestedAt: now - 10 * DAY_MS }), note('daily', { systemKind: 'daily-entry', growthStage: 'bloom', harvestedAt: now })];
  assert.deepEqual(getGardenMovement(items, now), { newIdeas: 1, projectsWithNextStep: 1, recentHarvests: 1 });
});

test('a harvest memory stays stable throughout a day regardless of input order', () => {
  const items = [note('a', { growthStage: 'bloom', takeaway: 'A' }), note('b', { growthStage: 'bloom', reflection: 'B' }), note('c', { growthStage: 'bloom' })];
  assert.equal(getDailyHarvest(items, now)?.id, getDailyHarvest([...items].reverse(), now + 60_000)?.id);
  assert.ok(['a', 'b'].includes(getDailyHarvest(items, now)!.id));
  assert.equal(getDailyHarvest([], now), undefined);
  assert.equal(getDailyHarvest([items[2]], now)?.id, 'c');
});

test('featured projects override duplication filters, inactive pins fall back safely', () => {
  const items = [note('a', { isGrowth: true }), note('b', { isGrowth: true, focusHistory: [{ startedAt: now - 10_000, endedAt: now, minutes: 1 }] }), note('paused', { isGrowth: true, paused: true })];
  assert.equal(getContinuationProject(items, 'a', new Set(['a']))?.id, 'a');
  assert.equal(getContinuationProject(items, 'paused', new Set())?.id, 'b');
  assert.equal(getContinuationProject(items, '', new Set(['a', 'b'])), undefined);
});

test('snoozing does not change watering; expired or corrupt preferences are ignored', () => {
  const original = note('a');
  assert.deepEqual(readReviewSnoozes(JSON.stringify({ a: now + DAY_MS, expired: now, invalid: 'tomorrow', long: now + 2 * DAY_MS }), now), { a: now + DAY_MS });
  assert.equal(getNoteCareState(original, now), 'water');
  assert.deepEqual(readReviewSnoozes('{broken', now), {});
  assert.deepEqual(readReviewSnoozes('[]', now), {});
});

test('date edits use local calendar dates and reject rollover or malformed dates', () => {
  const result = parseLocalDueDate('2026-09-21');
  assert.equal(new Date(result!).getDate(), 21);
  assert.equal(new Date(result!).getMonth(), 8);
  assert.equal(new Date(result!).getHours(), 23);
  for (const value of ['', '2026-02-30', '2026-13-01', '2026-9-1', 'bad']) assert.equal(parseLocalDueDate(value), null);
  assert.notEqual(parseLocalDueDate('2028-02-29'), null);
});
