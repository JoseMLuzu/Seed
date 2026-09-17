import type { SeedNote } from './types';
import { DAY_MS, isDailyEntryNote, localDateKey, wateringDue } from './seedLogic';

export type CareState = 'water' | 'sun';
export function getNoteCareState(note: SeedNote, now = Date.now()): CareState | null {
  if (note.paused || note.growthStage === 'bloom' || note.growthStage === 'withered' || isDailyEntryNote(note) ||
      (note.isGrowth && note.tasks.length > 0 && note.tasks.every(task => task.completed))) return null;
  return wateringDue(note, now) ? 'water' : 'sun';
}

export function getGroupCareState(notes: readonly SeedNote[], now = Date.now()): CareState | null {
  const states = notes.map(note => getNoteCareState(note, now)).filter(state => state !== null);
  return states.length ? states.includes('water') ? 'water' : 'sun' : null;
}

export function getGardenMovement(notes: readonly SeedNote[], now = Date.now()) {
  const today = new Date(now);
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime();
  const active = notes.filter(note => getNoteCareState(note, now) !== null);
  return {
    newIdeas: active.filter(note => note.inbox && note.createdAt >= weekStart && note.createdAt <= now).length,
    projectsWithNextStep: active.filter(note => !note.inbox && note.isGrowth && note.tasks.some(task => !task.completed)).length,
    recentHarvests: notes.filter(note => !isDailyEntryNote(note) && note.growthStage === 'bloom' && Boolean(note.harvestedAt) && note.harvestedAt! >= weekStart && note.harvestedAt! <= now).length,
  };
}

export function getDailyHarvest(notes: readonly SeedNote[], now = Date.now()): SeedNote | undefined {
  const harvests = notes.filter(note => !isDailyEntryNote(note) && note.growthStage === 'bloom');
  const lessons = harvests.filter(note => note.takeaway?.trim() || note.reflection?.trim())
    .sort((a, b) => (b.harvestedAt || b.createdAt) - (a.harvestedAt || a.createdAt) || a.id.localeCompare(b.id));
  if (!lessons.length) return harvests.sort((a, b) => (b.harvestedAt || b.createdAt) - (a.harvestedAt || a.createdAt))[0];
  const hash = [...localDateKey(now)].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return lessons[hash % lessons.length];
}

export function getContinuationProject(projects: readonly SeedNote[], preferredId: string, excludedIds: ReadonlySet<string>): SeedNote | undefined {
  const active = projects.filter(note => note.isGrowth && !note.inbox && getNoteCareState(note) !== null);
  const preferred = active.find(note => note.id === preferredId);
  if (preferred) return preferred;
  return active.filter(note => !excludedIds.has(note.id)).sort((a, b) => {
    const lastFocus = (note: SeedNote) => Math.max(0, ...(note.focusHistory || []).map(session => session.endedAt));
    return lastFocus(b) - lastFocus(a) || (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt) || a.id.localeCompare(b.id);
  })[0];
}

export function readReviewSnoozes(raw: string | null, now = Date.now()): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).filter(([, until]) => typeof until === 'number' && Number.isFinite(until) && until > now && until <= now + DAY_MS));
    }
  } catch { /* Ignore malformed device preferences without modifying notes. */ }
  return {};
}

export function parseLocalDueDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day, 23, 59);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}
