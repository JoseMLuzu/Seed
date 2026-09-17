import test from 'node:test';
import assert from 'node:assert/strict';
import { getJournalEntries, journalReflection, saveJournalEntry } from './journalLogic';
import { createDailyClosureNote, createDailyEntryNote, dailyEntryId, getDailyActivitySnapshot, updateDailyEntryFocus } from './seedLogic';
import { getNoteCareState } from './dashboardInsights';
import { normalizeNote } from './normalize';
import { readDashboardModules, readDashboardOrder } from './dashboardModules';

const now = new Date(2026, 8, 16, 12).getTime();
const makeEntry = () => saveJournalEntry({ planetId: 'garden-a', reflection: '  Hoy descubrí algo.\n\nSin prisa.  ', mood: 'calm', linkedNoteId: 'idea-1', language: 'es', now });

test('journal saves multiline reflection, optional mood and an independent link', () => {
  const note = makeEntry();
  assert.equal(note.id, dailyEntryId('garden-a', now));
  assert.equal(journalReflection(note), 'Hoy descubrí algo.\n\nSin prisa.');
  assert.equal(note.dailyEntry?.journalMood, 'calm');
  assert.equal(note.dailyEntry?.journalLinkedNoteId, 'idea-1');
  assert.equal(note.dailyEntry?.linkedNoteId, undefined);
  assert.equal(note.dailyEntry?.closedAt, undefined);
});

test('writing has no watering, harvest, task or focus activity', () => {
  const note = makeEntry();
  assert.equal(getNoteCareState(note, now), null);
  assert.deepEqual(getDailyActivitySnapshot([note], now), { planted: 0, watered: 0, steps: 0, harvests: 0, focusMinutes: 0 });
  assert.equal(note.lastWateredAt, undefined);
  assert.equal(note.harvestedAt, undefined);
});

test('journal edits retain historical date, focus and closure metadata', () => {
  const existing = createDailyClosureNote({ id: 'existing-day', notes: [], reflection: 'Antes', intention: 'Un paso', linkedNoteId: 'project-1', nextStep: 'tomorrow', intentionOutcome: 'some', defaultWateringInterval: 1, planetId: 'garden-a', language: 'es', now });
  const note = saveJournalEntry({ existing, planetId: 'garden-a', reflection: 'Después', mood: 'clear', language: 'es', now: now + 86400000 });
  assert.equal(note.id, existing.id);
  assert.equal(note.dailyEntry?.date, existing.dailyEntry?.date);
  assert.equal(note.dailyEntry?.closedAt, now);
  assert.equal(note.dailyEntry?.nextStep, 'tomorrow');
  assert.equal(note.dailyEntry?.outcome, 'some');
  assert.equal(note.dailyEntry?.linkedNoteId, 'project-1');
  assert.equal(note.harvestedAt, now);
  assert.equal(note.createdAt, now);
});

test('closing the day reuses journal identity and preserves mood and journal link', () => {
  const existing = makeEntry();
  const closed = createDailyClosureNote({ id: 'unused', existingEntry: existing, notes: [existing], reflection: journalReflection(existing), intention: 'Un paso', defaultWateringInterval: 1, planetId: 'garden-a', language: 'es', now: now + 1000 });
  assert.equal(closed.id, existing.id);
  assert.equal(closed.dailyEntry?.journalMood, 'calm');
  assert.equal(closed.dailyEntry?.journalLinkedNoteId, 'idea-1');
  assert.equal(getJournalEntries([closed]).length, 1);
});

test('changing daily focus keeps journal text, mood and link', () => {
  const note = updateDailyEntryFocus(makeEntry(), 'Nuevo foco', 'project-2', now + 1);
  assert.equal(journalReflection(note), journalReflection(makeEntry()));
  assert.equal(note.dailyEntry?.journalMood, 'calm');
  assert.equal(note.dailyEntry?.journalLinkedNoteId, 'idea-1');
  assert.equal(note.dailyEntry?.linkedNoteId, 'project-2');
});

test('empty modern reflections never show generated closure text', () => {
  const empty = { ...makeEntry(), reflection: 'Generated summary', dailyEntry: { ...makeEntry().dailyEntry!, reflection: '' } };
  assert.equal(journalReflection(empty), '');
  assert.equal(getJournalEntries([empty]).length, 1);
});

test('history includes old closures but excludes unfinished daily plans and normal notes', () => {
  const plan = createDailyEntryNote({ id: 'plan', intention: 'Plan', planetId: 'garden-a', language: 'es', now });
  const old = { ...makeEntry(), id: 'old', dailyEntry: undefined, tags: ['daily-closure'], reflection: 'Un aprendizaje antiguo', createdAt: now - 86400000 };
  const ordinary = { ...makeEntry(), id: 'ordinary', systemKind: undefined, dailyEntry: undefined, tags: [] };
  assert.deepEqual(getJournalEntries([old, ordinary, plan, makeEntry()]).map(note => note.id), [makeEntry().id, 'old']);
});

test('journal metadata survives persistence normalization and invalid moods are discarded', () => {
  assert.deepEqual(normalizeNote(makeEntry())?.dailyEntry, { ...makeEntry().dailyEntry, outcome: '', nextStep: '', activity: undefined, closedAt: undefined, dismissedAt: undefined, continuedAt: undefined });
  assert.equal(normalizeNote({ ...makeEntry(), dailyEntry: { ...makeEntry().dailyEntry, journalMood: 'invalid' } })?.dailyEntry?.journalMood, undefined);
});

test('journal migration keeps custom visibility, explicitly empty dashboards and module order', () => {
  assert.deepEqual(readDashboardModules(null, null, '["focus","learning"]'), ['focus', 'learning', 'journal']);
  assert.deepEqual(readDashboardModules(null, null, '[]'), []);
  assert.deepEqual(readDashboardModules('["focus"]', null, '["learning"]'), ['focus']);
  const order = readDashboardOrder('["activity","capture"]');
  assert.deepEqual(order.slice(0, 2), ['activity', 'capture']);
  assert.equal(order.filter(id => id === 'journal').length, 1);
});
