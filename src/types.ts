/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Theme = 'earth' | 'forest' | 'bloom' | 'night';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface SeedNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  tags: string[];
  isGrowth: boolean; // if true, it's a To-Do list
  tasks: Task[];
  growthStage: 'seed' | 'sprout' | 'bloom' | 'withered';
  dueDate?: number;
  connections?: string[]; // IDs of related notes
}
