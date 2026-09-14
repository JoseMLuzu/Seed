import { SeedNote } from './types';

const FALLBACK_PLANET_ID = 'personal';
const VALID_STAGES = new Set<SeedNote['growthStage']>(['seed', 'sprout', 'bloom', 'withered']);
const VALID_SEED_TYPES = new Set<NonNullable<SeedNote['seedType']>>(['idea', 'project', 'goal', 'learning']);
const VALID_PRIORITIES = new Set<NonNullable<SeedNote['priority']>>(['light', 'normal', 'important']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function normalizeNote(value: unknown): SeedNote | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = asString(raw.id);
  if (!id) return null;

  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.flatMap(task => {
        const record = asRecord(task);
        const taskId = asString(record?.id);
        if (!record || !taskId) return [];
        return [{
          id: taskId,
          text: asString(record.text) || '',
          completed: Boolean(record.completed),
          completedAt: asNumber(record.completedAt),
        }];
      })
    : [];

  const rawStage = asString(raw.growthStage) as SeedNote['growthStage'] | undefined;
  const growthStage = rawStage && VALID_STAGES.has(rawStage) ? rawStage : tasks.length > 0 ? 'sprout' : 'seed';
  const seedType = asString(raw.seedType) as SeedNote['seedType'] | undefined;
  const priority = asString(raw.priority) as SeedNote['priority'] | undefined;
  const isGrowth = Boolean(raw.isGrowth) || tasks.length > 0 || growthStage === 'sprout';

  return {
    id,
    planetId: asString(raw.planetId) || FALLBACK_PLANET_ID,
    title: asString(raw.title)?.trim() || 'Sin titulo',
    content: asString(raw.content) || '',
    createdAt: asNumber(raw.createdAt) || Date.now(),
    updatedAt: asNumber(raw.updatedAt),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    isGrowth,
    tasks,
    growthStage,
    dueDate: asNumber(raw.dueDate),
    connections: Array.isArray(raw.connections) ? raw.connections.filter((id): id is string => typeof id === 'string') : undefined,
    lastWateredAt: asNumber(raw.lastWateredAt),
    lastWateringNote: asString(raw.lastWateringNote),
    wateringIntervalDays: Math.max(1, asNumber(raw.wateringIntervalDays) || 1),
    paused: Boolean(raw.paused),
    inbox: Boolean(raw.inbox),
    seedType: seedType && VALID_SEED_TYPES.has(seedType) ? seedType : 'idea',
    priority: priority && VALID_PRIORITIES.has(priority) ? priority : 'normal',
    reflection: asString(raw.reflection),
    takeaway: asString(raw.takeaway),
    focusNote: asString(raw.focusNote),
    focusedMinutes: Math.max(0, asNumber(raw.focusedMinutes) || 0),
    focusHistory: Array.isArray(raw.focusHistory)
      ? raw.focusHistory.flatMap(value => {
          const entry = asRecord(value);
          const legacyAt = asNumber(entry?.at);
          const startedAt = asNumber(entry?.startedAt) || legacyAt;
          const endedAt = asNumber(entry?.endedAt) || legacyAt;
          const minutes = asNumber(entry?.minutes);
          return startedAt && endedAt && minutes && minutes > 0 ? [{ startedAt, endedAt, minutes }] : [];
        })
      : undefined,
    harvestedAt: asNumber(raw.harvestedAt),
    systemKind: raw.systemKind === 'daily-entry' ? 'daily-entry' : undefined,
    dailyEntry: (() => {
      const entry = asRecord(raw.dailyEntry);
      const date = asString(entry?.date);
      const startedAt = asNumber(entry?.startedAt);
      if (!entry || !date || !startedAt) return undefined;
      const rawActivity = asRecord(entry.activity);
      const rawOutcome = asString(entry.outcome);
      const rawNextStep = asString(entry.nextStep);
      return {
        version: 1 as const,
        date,
        intention: asString(entry.intention) || '',
        linkedNoteId: asString(entry.linkedNoteId),
        outcome: rawOutcome === 'yes' || rawOutcome === 'some' || rawOutcome === 'no' ? rawOutcome : '',
        reflection: asString(entry.reflection),
        nextStep: rawNextStep === 'tomorrow' || rawNextStep === 'garden' || rawNextStep === 'shed' ? rawNextStep : '',
        activity: rawActivity ? {
          planted: Math.max(0, asNumber(rawActivity.planted) || 0),
          watered: Math.max(0, asNumber(rawActivity.watered) || 0),
          steps: Math.max(0, asNumber(rawActivity.steps) || 0),
          harvests: Math.max(0, asNumber(rawActivity.harvests) || 0),
          focusMinutes: Math.max(0, asNumber(rawActivity.focusMinutes) || 0),
        } : undefined,
        startedAt,
        closedAt: asNumber(entry.closedAt),
        dismissedAt: asNumber(entry.dismissedAt),
        continuedAt: asNumber(entry.continuedAt),
      };
    })(),
  };
}

export function normalizeNotes(values: unknown): SeedNote[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap(value => {
    const note = normalizeNote(value);
    return note ? [note] : [];
  });
}
