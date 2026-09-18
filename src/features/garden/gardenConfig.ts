/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Planet, Theme } from "../../types";

export const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: "earth", label: "Pradera", icon: "🌾" },
  { id: "forest", label: "Bosque", icon: "🌲" },
  { id: "bloom", label: "Floración", icon: "🌸" },
  { id: "night", label: "Nocturno", icon: "🌙" },
  { id: "jungle", label: "Jungla", icon: "🌴" },
  { id: "alien", label: "Alien", icon: "🪐" },
  { id: "desert", label: "Desierto", icon: "🌵" },
  { id: "arctic", label: "Ártico", icon: "❄️" },
];

export const DEFAULT_PLANET_ID = "personal";

export const DEFAULT_PLANETS: Planet[] = [
  {
    id: DEFAULT_PLANET_ID,
    name: "Personal",
    description: "Ideas de vida, habitos y pendientes propios.",
    theme: "earth",
    createdAt: 0,
  },
];

export const LEGACY_DEFAULT_PLANET_IDS = new Set(["work", "study"]);

export const THEME_IDS = new Set(THEMES.map((theme) => theme.id));
