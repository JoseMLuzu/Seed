import assert from 'node:assert/strict';
import { buildCalendarEvents, calendarEventsForDay, groupCalendarEventsByDay } from './calendarLogic';
import type { SeedNote } from './types';

const day = new Date(2026, 8, 11, 9, 0, 0).getTime();

function note(overrides: Partial<SeedNote> = {}): SeedNote {
  return {
    id: 'seed-1',
    title: 'Preparar App Store',
    content: '',
    createdAt: day,
    tags: [],
    isGrowth: true,
    tasks: [],
    growthStage: 'sprout',
    ...overrides,
  };
}

const editedOnly = buildCalendarEvents([note({ updatedAt: day + 60_000 })]);
assert.deepEqual(editedOnly.map(event => event.kind), ['planted']);

const completedAt = day + 60 * 60 * 1000;
const focusEndedAt = day + 2 * 60 * 60 * 1000;
const dueDate = day + 24 * 60 * 60 * 1000;
const events = buildCalendarEvents([note({
  updatedAt: day + 30_000,
  lastWateredAt: focusEndedAt,
  tasks: [{ id: 'task-1', text: 'Crear capturas', completed: true, completedAt }],
  focusHistory: [{ startedAt: focusEndedAt - 25 * 60_000, endedAt: focusEndedAt, minutes: 25 }],
  dueDate,
})]);

assert.deepEqual(events.map(event => event.kind), ['planted', 'task-completed', 'focus', 'due']);
assert.equal(events.find(event => event.kind === 'task-completed')?.title, 'Crear capturas');
assert.equal(events.find(event => event.kind === 'focus')?.minutes, 25);
assert.equal(events.find(event => event.kind === 'due')?.category, 'plan');
assert.equal(events.some(event => event.kind === 'watered'), false);

const explicitWatering = buildCalendarEvents([note({ lastWateredAt: completedAt, lastWateringNote: 'Revisar mañana' })]);
assert.equal(explicitWatering.find(event => event.kind === 'watered')?.detail, 'Revisar mañana');

const dailyClose = note({
  id: 'daily-entry',
  title: 'Cierre del día',
  systemKind: 'daily-entry',
  tags: ['daily-entry', 'daily-closure'],
  growthStage: 'bloom',
  dailyEntry: {
    version: 1,
    date: '2026-09-11',
    intention: 'Preparar la publicación',
    reflection: 'La versión está más clara.',
    outcome: 'some',
    startedAt: day,
    closedAt: completedAt,
  },
});
const closeEvents = buildCalendarEvents([dailyClose]);
assert.equal(closeEvents.length, 1);
assert.equal(closeEvents[0].kind, 'daily-closed');
assert.equal(closeEvents[0].category, 'reflection');
assert.equal(closeEvents[0].title, 'La versión está más clara.');

const byDay = groupCalendarEventsByDay([...events, ...closeEvents]);
assert.equal(calendarEventsForDay(byDay, day).length, 4);
assert.equal(calendarEventsForDay(byDay, dueDate).length, 1);

console.log('calendar logic tests passed');
