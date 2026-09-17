import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailyFocusOutcome, getDailyFocusState, logDailyFocusSession, saveDailyFocusEntry, toggleDailyFocusCompletion } from './dailyFocus';
import { createDailyClosureNote, getDailyActivitySnapshot, getDailyEntryForDate, toggleTaskForNote } from './seedLogic';
import { saveJournalEntry } from './journalLogic';
import { normalizeNote } from './normalize';
import { buildCalendarEvents } from './calendarLogic';
import type { SeedNote } from './types';

const now = new Date(2026, 8, 16, 12).getTime();
const project: SeedNote = { id: 'project', planetId: 'garden', title: 'Mi proyecto', content: '', createdAt: now - 86400000, tags: [], isGrowth: true, tasks: [{ id: 'a', text: 'Hacer boceto', completed: false }, { id: 'b', text: 'Publicar', completed: false }], growthStage: 'sprout', inbox: false };
const save = (notes: SeedNote[] = [project], intention = 'Hacer boceto', linkedNoteId: string | undefined = 'project', linkedTaskId: string | undefined = 'a') => saveDailyFocusEntry(notes, { intention, linkedNoteId, linkedTaskId, planetId: 'garden', language: 'es', now });
const entryOf = (notes: SeedNote[]) => getDailyEntryForDate(notes, now, 'garden')!;

test('today selects one persistent project task, not the whole project', () => {
  const notes = save();
  assert.equal(entryOf(notes).dailyEntry?.linkedTaskId, 'a');
  const completed = toggleDailyFocusCompletion(notes, entryOf(notes).id, now);
  assert.equal(getDailyFocusState(entryOf(completed), completed).complete, true);
  assert.equal(completed.find(note => note.id === project.id)?.growthStage, 'sprout');
  assert.equal(completed.find(note => note.id === project.id)?.tasks[1].completed, false);
  assert.equal(getDailyFocusOutcome(entryOf(completed), completed, now), 'yes');
});

test('completing an unrelated project task does not complete today’s goal', () => {
  const notes = save().map(note => note.id === project.id ? toggleTaskForNote(note, 'b', now) : note);
  assert.equal(getDailyFocusState(entryOf(notes), notes).complete, false);
});

test('completing the chosen task elsewhere updates daily goal, and undo reopens it', () => {
  const notes = save().map(note => note.id === project.id ? toggleTaskForNote(note, 'a', now) : note);
  assert.equal(getDailyFocusState(entryOf(notes), notes).complete, true);
  const undone = toggleDailyFocusCompletion(notes, entryOf(notes).id, now + 1);
  assert.equal(getDailyFocusState(entryOf(undone), undone).complete, false);
  assert.equal(entryOf(undone).dailyEntry?.focusCompletedAt, undefined);
});

test('an independent goal can be completed without creating a project or harvest', () => {
  const notes = saveDailyFocusEntry([], { intention: 'Salir a caminar', planetId: 'garden', language: 'es', now });
  const done = toggleDailyFocusCompletion(notes, entryOf(notes).id, now);
  assert.equal(done.length, 1);
  assert.equal(getDailyFocusState(entryOf(done), done).complete, true);
  assert.deepEqual(getDailyActivitySnapshot(done, now), { planted: 0, watered: 0, steps: 0, harvests: 0, focusMinutes: 0 });
});

test('clearing the goal retains journal identity, reflection, mood, link and history', () => {
  const journal = saveJournalEntry({ planetId: 'garden', reflection: 'Mi día', mood: 'calm', linkedNoteId: 'project', language: 'es', now });
  const focused = save([journal, project]);
  const logged = logDailyFocusSession(focused, entryOf(focused).id, 5, now);
  const cleared = save(logged, '', undefined, undefined);
  assert.equal(cleared.length, logged.length);
  assert.equal(entryOf(cleared).id, journal.id);
  assert.equal(entryOf(cleared).dailyEntry?.reflection, 'Mi día');
  assert.equal(entryOf(cleared).dailyEntry?.journalMood, 'calm');
  assert.equal(entryOf(cleared).dailyEntry?.journalLinkedNoteId, 'project');
  assert.equal(entryOf(cleared).dailyEntry?.intention, '');
  assert.equal(entryOf(cleared).dailyEntry?.linkedNoteId, undefined);
  assert.equal(entryOf(cleared).dailyEntry?.linkedTaskId, undefined);
  assert.equal(entryOf(cleared).focusHistory?.[0].minutes, 5);
});

test('changing an independent completed goal resets completion, resaving it does not', () => {
  const notes = saveDailyFocusEntry([], { intention: 'Caminar', planetId: 'garden', language: 'es', now });
  const done = toggleDailyFocusCompletion(notes, entryOf(notes).id, now);
  const same = save(done, 'Caminar', undefined, undefined);
  assert.equal(getDailyFocusState(entryOf(same), same).complete, true);
  const changed = save(done, 'Leer', undefined, undefined);
  assert.equal(getDailyFocusState(entryOf(changed), changed).complete, false);
});

test('missing tasks never silently become another project task', () => {
  const notes = save().map(note => note.id === project.id ? { ...note, tasks: note.tasks.filter(task => task.id !== 'a') } : note);
  assert.equal(getDailyFocusState(entryOf(notes), notes).sourceMissing, true);
  const done = toggleDailyFocusCompletion(notes, entryOf(notes).id, now);
  assert.equal(getDailyFocusState(entryOf(done), done).complete, true);
  assert.equal(done.find(note => note.id === project.id)?.tasks[0].completed, false);
});

test('project references cannot cross gardens', () => {
  const foreign = { ...project, planetId: 'other' };
  const notes = save([foreign]);
  assert.equal(entryOf(notes).dailyEntry?.linkedNoteId, undefined);
  assert.equal(entryOf(notes).dailyEntry?.linkedTaskId, undefined);
  const done = toggleDailyFocusCompletion(notes, entryOf(notes).id, now);
  assert.deepEqual(done.find(note => note.id === project.id), foreign);
});

test('daily sessions count focus minutes once, without watering or fake tasks', () => {
  const notes = save();
  const logged = logDailyFocusSession(notes, entryOf(notes).id, 5, now);
  assert.deepEqual(getDailyActivitySnapshot(logged, now), { planted: 0, watered: 0, steps: 0, harvests: 0, focusMinutes: 5 });
  assert.equal(getDailyFocusOutcome(entryOf(logged), logged, now), 'some');
  assert.deepEqual(logged.find(note => note.id === project.id), project);
  assert.equal(entryOf(logged).lastWateredAt, undefined);
});

test('calendar records daily Focus minutes without creating planting or watering events', () => {
  const notes = save();
  const logged = logDailyFocusSession(notes, entryOf(notes).id, 5, now);
  const events = buildCalendarEvents([entryOf(logged)]);
  assert.deepEqual(events.map(event => event.kind), ['focus']);
  assert.equal(events[0].minutes, 5);
  assert.equal(events[0].title, 'Hacer boceto');
});

test('editing the diary alone never suggests that the focus has advanced', () => {
  const notes = save();
  assert.equal(getDailyFocusOutcome(entryOf(notes), notes, now), 'no');
});

test('closed days reject changes, completion toggles and new sessions', () => {
  const notes = save();
  const original = entryOf(notes);
  const closed = createDailyClosureNote({ id: original.id, existingEntry: original, notes, reflection: 'Fin', intention: original.dailyEntry!.intention, defaultWateringInterval: 1, planetId: 'garden', language: 'es', now });
  const snapshot = notes.map(note => note.id === closed.id ? closed : note);
  assert.deepEqual(save(snapshot, ''), snapshot);
  assert.deepEqual(toggleDailyFocusCompletion(snapshot, closed.id, now), snapshot);
  assert.deepEqual(logDailyFocusSession(snapshot, closed.id, 5, now), snapshot);
  assert.equal(entryOf(snapshot).dailyEntry?.linkedTaskId, 'a');
});

test('task and completion metadata survive persistence normalization', () => {
  const notes = save();
  const done = toggleDailyFocusCompletion(notes, entryOf(notes).id, now);
  assert.equal(normalizeNote(entryOf(done))?.dailyEntry?.linkedTaskId, 'a');
  assert.equal(normalizeNote(entryOf(done))?.dailyEntry?.focusCompletedAt, now);
});

test('closed goal status is historical, not changed by later project completions', () => {
  const notes = save();
  const entry = entryOf(notes);
  const closed = { ...entry, dailyEntry: { ...entry.dailyEntry!, closedAt: now, outcome: 'no' as const } };
  const completedProject = toggleTaskForNote(project, 'a', now + 86400000);
  assert.equal(getDailyFocusState(closed, [completedProject]).complete, false);
  assert.equal(getDailyFocusState({ ...closed, dailyEntry: { ...closed.dailyEntry!, outcome: 'yes' } }, [project]).complete, true);
});

test('empty goals and zero-length sessions create no extra data', () => {
  assert.deepEqual(saveDailyFocusEntry([], { intention: ' ', planetId: 'garden', language: 'es', now }), []);
  const notes = save();
  assert.deepEqual(logDailyFocusSession(notes, entryOf(notes).id, 0, now), notes);
});
