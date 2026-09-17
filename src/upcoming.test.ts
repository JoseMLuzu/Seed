import assert from 'node:assert/strict';
import test from 'node:test';
import type { SeedNote } from './types';
import { getUpcomingItems } from './upcoming';

const now = new Date(2026, 8, 15, 15).getTime();
const due = (offset: number, hour = 23) => new Date(2026, 8, 15 + offset, hour, 59).getTime();
const note = (id: string, overrides: Partial<SeedNote> = {}): SeedNote => ({
  id, title: id, content: '', createdAt: now, tags: [], isGrowth: false,
  tasks: [], growthStage: 'seed', ...overrides,
});

test('includes overdue, today and the entire seventh day, but not day eight', () => {
  const items = getUpcomingItems([-4, 0, 1, 7, 8].map(day => note(String(day), { dueDate: due(day) })), now);
  assert.deepEqual(items.map(item => item.daysUntilDue), [-4, 0, 1, 7]);
});

test('important notes appear without dates or with distant dates, without duplicates', () => {
  const items = getUpcomingItems([
    note('undated', { priority: 'important' }),
    note('distant', { priority: 'important', dueDate: due(30) }),
    note('both', { priority: 'important', dueDate: due(2) }),
    note('ordinary'),
  ], now);
  assert.deepEqual(items.map(item => item.note.id), ['both', 'distant', 'undated']);
  assert.equal(items[2].daysUntilDue, null);
  assert.equal(items[1].dueSoon, false);
});

test('urgency comes before importance, and importance breaks a same-day tie', () => {
  const items = getUpcomingItems([
    note('tomorrow', { priority: 'important', dueDate: due(1) }),
    note('today', { dueDate: due(0) }),
    note('overdue', { dueDate: due(-1) }),
    note('today-important', { priority: 'important', dueDate: due(0) }),
  ], now);
  assert.deepEqual(items.map(item => item.note.id), ['overdue', 'today-important', 'today', 'tomorrow']);
});

test('excludes paused, harvested, withered, completed projects and system daily entries', () => {
  const inactive: Partial<SeedNote>[] = [
    { paused: true }, { growthStage: 'bloom' }, { growthStage: 'withered' },
    { isGrowth: true, tasks: [{ id: 'task', text: 'Done', completed: true }] },
    { systemKind: 'daily-entry' }, { tags: ['daily-entry'] }, { tags: ['daily-closure'] },
  ];
  assert.deepEqual(getUpcomingItems(inactive.map((props, i) => note(String(i), { priority: 'important', dueDate: due(1), ...props })), now), []);
});

test('includes both inbox notes and active projects without modifying the input', () => {
  const notes = [
    note('project', { isGrowth: true, dueDate: due(2), tasks: [{ id: 'a', text: 'Next', completed: false }] }),
    note('inbox', { inbox: true, dueDate: due(1) }),
  ];
  const before = structuredClone(notes);
  assert.deepEqual(getUpcomingItems(notes, now).map(item => item.note.id), ['inbox', 'project']);
  assert.deepEqual(notes, before);
});

test('invalid dates do not create false deadlines; important items remain visible', () => {
  const items = getUpcomingItems([
    note('nan', { dueDate: NaN }), note('infinity', { dueDate: Infinity }),
    note('out-of-range', { dueDate: 9e15 }),
    note('important', { dueDate: NaN, priority: 'important' }),
  ], now);
  assert.equal(items.length, 1);
  assert.equal(items[0].daysUntilDue, null);
  assert.equal(items[0].dueSoon, false);
});

test('a past hour on the current calendar date is still Today', () => {
  assert.equal(getUpcomingItems([note('today', { dueDate: due(0, 0) })], now)[0].daysUntilDue, 0);
});

test('calendar days cross month/year and daylight-saving changes correctly', () => {
  for (const [start, end, days] of [
    [new Date(2026, 11, 31, 23), new Date(2027, 0, 1, 0), 1],
    [new Date(2026, 2, 7, 23), new Date(2026, 2, 9, 0), 2],
    [new Date(2026, 9, 31, 23), new Date(2026, 10, 2, 0), 2],
  ] as const) {
    assert.equal(getUpcomingItems([note('boundary', { dueDate: end.getTime() })], start.getTime())[0].daysUntilDue, days);
  }
});

test('an empty garden produces an empty list', () => {
  assert.deepEqual(getUpcomingItems([], now), []);
});
