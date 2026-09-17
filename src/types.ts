/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Theme = 'earth' | 'forest' | 'bloom' | 'night' | 'jungle' | 'alien' | 'desert' | 'arctic';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: number;
}

export type DailyIntentionOutcome = 'yes' | 'some' | 'no' | '';
export type DailyNextStep = 'tomorrow' | 'garden' | 'shed' | '';
export type JournalMood = 'clear' | 'calm' | 'rain' | 'beginnings';

export interface DailyActivitySnapshot {
  planted: number;
  watered: number;
  steps: number;
  harvests: number;
  focusMinutes: number;
}

export interface DailyEntryData {
  version: 1;
  date: string;
  intention: string;
  linkedNoteId?: string;
  linkedTaskId?: string;
  focusCompletedAt?: number;
  outcome?: DailyIntentionOutcome;
  reflection?: string;
  nextStep?: DailyNextStep;
  activity?: DailyActivitySnapshot;
  startedAt: number;
  closedAt?: number;
  dismissedAt?: number;
  continuedAt?: number;
  journalMood?: JournalMood;
  journalLinkedNoteId?: string;
  journalUpdatedAt?: number;
}

export interface FocusSession {
  startedAt: number;
  endedAt: number;
  minutes: number;
}

export interface SeedNote {
  id: string;
  planetId?: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  tags: string[];
  isGrowth: boolean; // if true, it's a To-Do list
  tasks: Task[];
  growthStage: 'seed' | 'sprout' | 'bloom' | 'withered';
  dueDate?: number;
  connections?: string[]; // IDs of related notes
  lastWateredAt?: number;
  lastWateringNote?: string;
  wateringIntervalDays?: number;
  paused?: boolean;
  inbox?: boolean;
  seedType?: 'idea' | 'project' | 'goal' | 'learning';
  priority?: 'light' | 'normal' | 'important';
  reflection?: string;
  takeaway?: string;
  focusNote?: string;
  focusedMinutes?: number;
  focusHistory?: FocusSession[];
  harvestedAt?: number;
  systemKind?: 'daily-entry';
  dailyEntry?: DailyEntryData;
  /** Server-assigned revision; local edits keep it as their optimistic base. */
  syncVersion?: number;
}

export interface Planet {
  id: string;
  name: string;
  description: string;
  theme: Theme;
  createdAt: number;
  updatedAt?: number;
  /** Server-assigned revision; local edits keep it as their optimistic base. */
  syncVersion?: number;
}

export interface SyncSnapshot {
  planets: Planet[];
  notes: SeedNote[];
}
