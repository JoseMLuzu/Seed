/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Planet } from "../../types";
import { THEME_IDS } from "./gardenConfig";

export function normalizePlanets(values: unknown): Planet[] {
  if (!Array.isArray(values)) return [];

  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const raw = value as Partial<Planet>;
    if (typeof raw.id !== "string" || typeof raw.name !== "string") return [];
    return [
      {
        id: raw.id,
        name: raw.name.trim() || "Personal",
        description: typeof raw.description === "string" ? raw.description : "",
        theme: raw.theme && THEME_IDS.has(raw.theme) ? raw.theme : "earth",
        createdAt:
          typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
        updatedAt:
          typeof raw.updatedAt === "number" ? raw.updatedAt : undefined,
      },
    ];
  });
}
