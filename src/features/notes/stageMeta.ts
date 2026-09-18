/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SeedNote } from "../../types";
import { gardenStageName } from "../../gardenVocabulary";
import { appLanguage } from "../../app/i18n";

export const STAGE_META: Record<
  SeedNote["growthStage"],
  { label: string; shortLabel: string; color: string; bg: string; aura: string }
> = {
  seed: {
    label: gardenStageName("seed", appLanguage),
    shortLabel: gardenStageName("seed", appLanguage),
    color: "text-[var(--tone-seed)]",
    bg: "bg-[var(--tone-seed-bg)]",
    aura: "from-[var(--tone-seed-bg)] via-[var(--surface-soft)] to-[var(--surface-strong)]",
  },
  sprout: {
    label: gardenStageName("sprout", appLanguage),
    shortLabel: gardenStageName("sprout", appLanguage),
    color: "text-[var(--tone-sprout)]",
    bg: "bg-[var(--tone-sprout-bg)]",
    aura: "from-[var(--tone-sprout-bg)] via-[var(--surface-soft)] to-[var(--surface-strong)]",
  },
  bloom: {
    label: gardenStageName("bloom", appLanguage),
    shortLabel: gardenStageName("bloom", appLanguage),
    color: "text-[var(--tone-harvest)]",
    bg: "bg-[var(--tone-harvest-bg)]",
    aura: "from-[var(--tone-harvest-bg)] via-[var(--surface-soft)] to-[var(--surface-strong)]",
  },
  withered: {
    label: gardenStageName("withered", appLanguage),
    shortLabel: gardenStageName("withered", appLanguage),
    color: "text-[var(--tone-warning)]",
    bg: "bg-[var(--tone-warning-bg)]",
    aura: "from-[var(--tone-warning-bg)] via-[var(--surface-soft)] to-[var(--surface-strong)]",
  },
};
