/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SeedNote } from "../../types";
import { daysSince, wateringDue } from "../../seedLogic";
import { appLanguage } from "../../app/i18n";
import { PRIORITY_OPTIONS } from "./noteConfig";

export function priorityWeight(note: SeedNote) {
  return note.priority === "important" ? 8 : note.priority === "light" ? -3 : 0;
}

export function formatReviewAge(note: SeedNote) {
  const days = daysSince(note.lastWateredAt || note.createdAt);
  if (!Number.isFinite(days) || days <= 0)
    return appLanguage === "en" ? "reviewed today" : "revisada hoy";
  if (appLanguage === "en")
    return `${days} day${days === 1 ? "" : "s"} without review`;
  return `${days} día${days === 1 ? "" : "s"} sin revisión`;
}

export function priorityLabel(option: (typeof PRIORITY_OPTIONS)[number]) {
  return appLanguage === "en" ? option.labelEn : option.label;
}

export function priorityDetail(option: (typeof PRIORITY_OPTIONS)[number]) {
  return appLanguage === "en" ? option.detailEn : option.detail;
}

export function getIdeaGuidance(note: SeedNote) {
  const openTask = note.tasks.find((task) => !task.completed);
  const daysWithoutReview = daysSince(note.lastWateredAt || note.createdAt);

  if (note.paused) {
    return {
      label: "El cobertizo",
      title: "Guardada para después",
      detail:
        "No te distrae por ahora. Tráela al jardín cuando vuelva a importar.",
      action: "Traer al jardín",
      tone: "bg-[var(--tone-warning-bg)] text-[var(--tone-warning)] border-[var(--tone-warning-border)]",
      actionTone: "bg-[var(--earth)] text-[var(--on-earth)]",
      kind: "pause" as const,
    };
  }

  if (note.growthStage === "bloom") {
    const hasLearning = Boolean(
      note.reflection?.trim() || note.takeaway?.trim(),
    );
    return {
      label: "Cosechado",
      title: hasLearning ? "Aprendizaje guardado" : "Cierre opcional",
      detail:
        note.reflection ||
        note.takeaway ||
        "Si esta idea te dejó algo, guárdalo en dos líneas.",
      action: hasLearning ? "Ver" : "Aprender",
      tone: "bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)] border-[var(--tone-harvest-border)]",
      actionTone:
        "bg-[var(--surface-soft)] text-[var(--sage)] border border-[var(--border)]",
      kind: "open" as const,
    };
  }

  if (note.growthStage === "withered") {
    return {
      label: "Necesita atención",
      title: "Revivir o soltar",
      detail: "Decide si todavía vale la pena convertirla en acción.",
      action: "Revivir",
      tone: "bg-[var(--tone-warning-bg)] text-[var(--tone-warning)] border-[var(--tone-warning-border)]",
      actionTone:
        "bg-[var(--tone-warning-bg)] text-[var(--tone-warning)] border border-[var(--tone-warning-border)]",
      kind: "grow" as const,
    };
  }

  if (!note.isGrowth) {
    return {
      label: "Por germinar",
      title: "Define la primera labor",
      detail: "Una idea empieza a crecer cuando tiene una acción pequeña.",
      action: "Cultivar",
      tone: "bg-[var(--tone-seed-bg)] text-[var(--tone-seed)] border-[var(--tone-seed-border)]",
      actionTone:
        "bg-[var(--surface-soft)] text-[var(--sage)] border border-[var(--border)]",
      kind: "grow" as const,
    };
  }

  if (wateringDue(note)) {
    return {
      label: "Riego",
      title: "Vale un riego",
      detail: `${daysWithoutReview} día${daysWithoutReview === 1 ? "" : "s"} sin mirar. Riégala en 20 segundos para que no se pierda.`,
      action: "Regar",
      tone: "bg-[var(--tone-water-bg)] text-[var(--tone-water)] border-[var(--tone-water-border)]",
      actionTone: "bg-[var(--sage)] text-[var(--on-sage)]",
      kind: "water" as const,
    };
  }

  if (openTask) {
    return {
      label: "Siguiente",
      title: "Lista para enfocar",
      detail: openTask.text || "Describe el siguiente paso antes de enfocarte.",
      action: "Cultivar",
      tone: "bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)] border-[var(--tone-sprout-border)]",
      actionTone: "bg-[var(--accent)] text-[var(--on-accent)]",
      kind: "focus" as const,
    };
  }

  return {
    label: "Labor",
    title: "Añade una acción",
    detail: "Esta idea necesita un siguiente paso para seguir avanzando.",
    action: "Abrir",
    tone: "bg-[var(--bg-app)] text-[var(--sage)] border-[var(--border)]",
    actionTone: "bg-[var(--earth)] text-[var(--on-earth)]",
    kind: "open" as const,
  };
}
