import { isDailyEntryNote, localDateKey } from './seedLogic';
import type { SeedNote } from './types';

export type CalendarEventKind =
  | 'planted'
  | 'watered'
  | 'task-completed'
  | 'focus'
  | 'harvested'
  | 'daily-closed'
  | 'due';

export type CalendarEventCategory = 'activity' | 'reflection' | 'plan';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  category: CalendarEventCategory;
  at: number;
  noteId: string;
  noteTitle: string;
  title: string;
  detail?: string;
  minutes?: number;
}

export type CalendarEventsByDay = Record<string, CalendarEvent[]>;

const timestampsOverlap = (left: number, right: number) => Math.abs(left - right) < 2_000;

/**
 * Builds the calendar from timestamps that describe a real domain event.
 * `updatedAt` is intentionally ignored: editing a title is not progress.
 */
export function buildCalendarEvents(notes: SeedNote[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const note of notes) {
    if (isDailyEntryNote(note)) {
      const closedAt = note.dailyEntry?.closedAt || (note.tags.includes('daily-closure') ? note.harvestedAt : undefined);
      if (closedAt) {
        events.push({
          id: `${note.id}:daily-closed:${closedAt}`,
          kind: 'daily-closed',
          category: 'reflection',
          at: closedAt,
          noteId: note.id,
          noteTitle: note.title,
          title: note.dailyEntry?.reflection?.trim() || note.reflection?.trim() || note.dailyEntry?.intention?.trim() || note.title,
          detail: note.dailyEntry?.outcome || undefined,
        });
      }
      continue;
    }

    events.push({
      id: `${note.id}:planted:${note.createdAt}`,
      kind: 'planted',
      category: 'activity',
      at: note.createdAt,
      noteId: note.id,
      noteTitle: note.title,
      title: note.title,
    });

    const completedTasks = note.tasks.filter(task => task.completed && task.completedAt);
    for (const task of completedTasks) {
      events.push({
        id: `${note.id}:task:${task.id}:${task.completedAt}`,
        kind: 'task-completed',
        category: 'activity',
        at: task.completedAt!,
        noteId: note.id,
        noteTitle: note.title,
        title: task.text || note.title,
        detail: note.title,
      });
    }

    for (const session of note.focusHistory || []) {
      events.push({
        id: `${note.id}:focus:${session.endedAt}`,
        kind: 'focus',
        category: 'activity',
        at: session.endedAt,
        noteId: note.id,
        noteTitle: note.title,
        title: note.title,
        minutes: session.minutes,
      });
    }

    if (note.harvestedAt) {
      events.push({
        id: `${note.id}:harvested:${note.harvestedAt}`,
        kind: 'harvested',
        category: 'activity',
        at: note.harvestedAt,
        noteId: note.id,
        noteTitle: note.title,
        title: note.title,
      });
    }

    if (note.lastWateredAt) {
      const causedByAnotherRecordedAction = completedTasks.some(task => timestampsOverlap(task.completedAt!, note.lastWateredAt!))
        || (note.focusHistory || []).some(session => timestampsOverlap(session.endedAt, note.lastWateredAt!))
        || Boolean(note.harvestedAt && timestampsOverlap(note.harvestedAt, note.lastWateredAt));

      if (!causedByAnotherRecordedAction) {
        events.push({
          id: `${note.id}:watered:${note.lastWateredAt}`,
          kind: 'watered',
          category: 'activity',
          at: note.lastWateredAt,
          noteId: note.id,
          noteTitle: note.title,
          title: note.title,
          detail: note.lastWateringNote,
        });
      }
    }

    if (note.dueDate) {
      events.push({
        id: `${note.id}:due:${note.dueDate}`,
        kind: 'due',
        category: 'plan',
        at: note.dueDate,
        noteId: note.id,
        noteTitle: note.title,
        title: note.title,
      });
    }
  }

  return events.sort((left, right) => left.at - right.at || left.id.localeCompare(right.id));
}

export function groupCalendarEventsByDay(events: CalendarEvent[]): CalendarEventsByDay {
  return events.reduce<CalendarEventsByDay>((days, event) => {
    const key = localDateKey(event.at);
    (days[key] ||= []).push(event);
    return days;
  }, {});
}

export function calendarEventsForDay(eventsByDay: CalendarEventsByDay, date: number | Date) {
  const timestamp = typeof date === 'number' ? date : date.getTime();
  return eventsByDay[localDateKey(timestamp)] || [];
}

export function isRecordedCalendarEvent(event: CalendarEvent) {
  return event.category !== 'plan';
}
