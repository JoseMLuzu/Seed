/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppLanguage } from "./i18n";
import type { AppView } from "./types";

const NAVIGATION_LABELS: Record<AppLanguage, Record<AppView, string>> = {
  es: {
    today: "Hoy",
    inbox: "Semillas",
    projects: "Brotes",
    focus: "Foco",
    board: "Pizarra",
    shed: "Cobertizo",
    garden: "Jardín",
    "3D": "Planeta",
    calendar: "Calendario",
    profile: "Perfil",
    harvest: "Cosecha",
  },
  en: {
    today: "Today",
    inbox: "Seeds",
    projects: "Sprouts",
    focus: "Focus",
    board: "Board",
    shed: "Shed",
    garden: "Garden",
    "3D": "Planet",
    calendar: "Calendar",
    profile: "Profile",
    harvest: "Harvest",
  },
};

export function navigationLabel(view: AppView, language: AppLanguage): string {
  return NAVIGATION_LABELS[language][view];
}
