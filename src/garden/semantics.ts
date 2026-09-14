import { wateringDue } from '../seedLogic';
import type { SeedNote } from '../types';

export type GardenEntityKind = 'idea' | 'project' | 'reflection';
export type GardenVisualForm = 'seed' | 'growing-tree' | 'mature-tree' | 'flower' | 'stone' | 'withered';
export type GardenEntityStatus = 'active' | 'completed' | 'paused' | 'withered';
export type GardenHarvestStatus = 'none' | 'available' | 'collected';

export interface GardenVisualState {
  kind: GardenEntityKind;
  form: GardenVisualForm;
  status: GardenEntityStatus;
  harvestStatus: GardenHarvestStatus;
  progress: number;
  needsWater: boolean;
  /** Approximate world-space radius reserved by the layout. */
  footprint: number;
}

function noteKind(note: SeedNote): GardenEntityKind {
  if (note.seedType === 'learning') return 'reflection';
  // Legacy converted ideas often kept seedType="idea" and only changed isGrowth.
  if (note.isGrowth || note.seedType === 'project' || note.seedType === 'goal') return 'project';
  return 'idea';
}

function noteProgress(note: SeedNote, kind: GardenEntityKind) {
  if (note.growthStage === 'bloom') return 100;
  if (kind !== 'project' || note.tasks.length === 0) return 0;
  return Math.round((note.tasks.filter(task => task.completed).length / note.tasks.length) * 100);
}

/**
 * The single compatibility boundary between stored notes and the visual world.
 * Rendering code should consume this state instead of interpreting legacy flags.
 */
export function getGardenVisualState(note: SeedNote, now = Date.now()): GardenVisualState {
  const kind = noteKind(note);
  const completed = note.growthStage === 'bloom';
  const progress = noteProgress(note, kind);
  const hasHarvestContent = Boolean(note.takeaway?.trim());
  const harvestStatus: GardenHarvestStatus = completed
    ? hasHarvestContent && note.harvestedAt ? 'collected' : 'available'
    : 'none';
  const status: GardenEntityStatus = note.growthStage === 'withered'
      ? 'withered'
      : completed
        ? 'completed'
        : note.paused ? 'paused' : 'active';
  const form: GardenVisualForm = note.growthStage === 'withered'
    ? 'withered'
    : kind === 'reflection'
      ? 'stone'
      : kind === 'project'
        ? completed ? 'mature-tree' : 'growing-tree'
        : completed ? 'flower' : 'seed';
  // Reserve the mature size from day one. Growth must never push neighboring
  // elements to a new position or create a collision later.
  const footprint = kind === 'project' ? 2.5 : kind === 'reflection' ? 0.68 : 1.2;

  return {
    kind,
    form,
    status,
    harvestStatus,
    progress,
    needsWater: status === 'active' && !note.inbox && wateringDue(note, now),
    footprint,
  };
}

export function isGardenEntityActive(state: GardenVisualState) {
  return state.status === 'active';
}
