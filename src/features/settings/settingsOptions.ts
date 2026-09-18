/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { THEMES } from "../garden/gardenConfig";

export const THEME_SELECT_OPTIONS = THEMES.map((item) => ({
  value: item.id,
  label: `${item.icon} ${item.label}`,
  description:
    item.id === "earth"
      ? "Claro y tranquilo"
      : item.id === "forest"
        ? "Profundo y natural"
        : item.id === "bloom"
          ? "Creativo y luminoso"
          : item.id === "night"
            ? "Calma nocturna"
            : item.id === "jungle"
              ? "Vivo y explorador"
              : item.id === "alien"
                ? "Experimental"
                : item.id === "desert"
                  ? "Minimal y cálido"
                  : "Limpio y sereno",
}));

export const WATERING_INTERVAL_OPTIONS = [
  { value: "1", label: "Diario", description: "Ideas importantes" },
  { value: "3", label: "Cada 3 días", description: "Equilibrado" },
  { value: "7", label: "Semanal", description: "Baja presión" },
];
