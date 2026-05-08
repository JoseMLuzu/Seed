/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Theme = 'earth' | 'forest' | 'bloom' | 'night' | 'jungle' | 'alien' | 'desert' | 'arctic';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
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
  reflection?: string;
  focusedMinutes?: number;
  harvestedAt?: number;
}

export interface Planet {
  id: string;
  name: string;
  description: string;
  theme: Theme;
  createdAt: number;
  updatedAt?: number;
  ownerId?: string;
  shared?: boolean;
  memberRole?: 'owner' | 'editor' | 'viewer';
  members?: PlanetMember[];
}

export interface SyncSnapshot {
  planets: Planet[];
  notes: SeedNote[];
}

export interface PlanetMember {
  planetId: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedAt?: number;
}
