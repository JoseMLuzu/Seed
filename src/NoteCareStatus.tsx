import { gardenName } from './gardenVocabulary';
import { Droplet, Sun } from 'lucide-react';
import type { SeedNote } from './types';
import { getNoteCareState, type CareState } from './dashboardInsights';
import './styles/noteCare.css';

export function NoteCareStatus({ note, state, language = 'es', compact = false, now }: {
  note?: SeedNote; state?: CareState | null; language?: 'es' | 'en'; compact?: boolean; now?: number;
}) {
  const care = note ? getNoteCareState(note, now) : state;
  if (!care) return null;
  const needsWater = care === 'water';
  const label = gardenName(needsWater ? 'attention' : 'currentCare', language);
  const Icon = needsWater ? Droplet : Sun;
  return <span className={`note-care-status note-care-${care}${compact ? ' note-care-compact' : ''}`} role="img" aria-label={label} title={label}>
    <Icon size={compact ? 16 : 17} strokeWidth={1.8} aria-hidden="true" />
    {!compact && <span aria-hidden="true">{label}</span>}
  </span>;
}
