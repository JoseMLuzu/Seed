/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SeedNote } from "../../types";
import { appLanguage } from "../../app/i18n";
import { gardenTypeName } from "../../gardenVocabulary";

export const SEED_TYPES: {
  id: NonNullable<SeedNote["seedType"]>;
  label: string;
  task: string;
}[] = [
  {
    id: "idea",
    label: gardenTypeName("idea", appLanguage),
    task: "Aclarar por qué vale la pena cultivar esta idea",
  },
  {
    id: "project",
    label: gardenTypeName("project", appLanguage),
    task: "Definir el primer entregable pequeño",
  },
  {
    id: "goal",
    label: gardenTypeName("goal", appLanguage),
    task: "Elegir una acción medible para esta semana",
  },
  {
    id: "learning",
    label: gardenTypeName("learning", appLanguage),
    task: "Practicar o resumir el primer concepto",
  },
];

export const PRIORITY_OPTIONS: {
  id: NonNullable<SeedNote["priority"]>;
  label: string;
  labelEn: string;
  detail: string;
  detailEn: string;
}[] = [
  {
    id: "light",
    label: "Ligera",
    labelEn: "Light",
    detail: "Puede esperar",
    detailEn: "Can wait",
  },
  {
    id: "normal",
    label: "Normal",
    labelEn: "Normal",
    detail: "Ritmo natural",
    detailEn: "Natural pace",
  },
  {
    id: "important",
    label: "Importante",
    labelEn: "Important",
    detail: "Sube en Hoy",
    detailEn: "Rises in Today",
  },
];
