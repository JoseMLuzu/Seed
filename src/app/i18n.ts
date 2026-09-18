/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { enUS, es } from "date-fns/locale";
import { gardenName } from "../gardenVocabulary";

export type AppLanguage = "es" | "en";

function detectDeviceLanguage(): AppLanguage {
  const languages =
    typeof navigator !== "undefined"
      ? [navigator.language, ...(navigator.languages || [])]
      : [];
  return languages.some((language) => language?.toLowerCase().startsWith("en"))
    ? "en"
    : "es";
}

export const appLanguage = detectDeviceLanguage();

export const appDateLocale = appLanguage === "en" ? enUS : es;

const appCopy = {
  es: {
    today: gardenName("today", "es"),
    seeds: gardenName("inbox", "es"),
    sprouts: gardenName("project", "es"),
    garden: gardenName("gardenView", "es"),
    planet: gardenName("planetView", "es"),
    path: gardenName("calendar", "es"),
    profile: "Perfil",
    settings: "Ajustes",
    cancel: "Cancelar",
    plant: "Plantar",
    newSeed: "Nueva semilla",
    options: "Opciones",
    date: "Fecha",
    goodMorning: "Buenos días",
    goodAfternoon: "Buenas tardes",
    goodEvening: "Buenas noches",
    streak: "racha",
    activeDays: "días activos",
    now: "Ahora",
    waterNow: "Regar ahora",
    focus: "Cultivar",
    viewSeeds: "Ver semillas",
    openGarden: "Abrir jardín",
    quietGarden: "Tu jardín está tranquilo",
    captureIdea: "Captura una idea cuando aparezca",
    seedWaiting: "Hay una semilla esperando forma",
    noPressure: "Sin presión: una revisión basta",
    wateringUpToDate: "Riego al día",
    wateringQueue: "por regar",
    monthPath: "Mira el mes y los días activos",
    quietDay: "Día tranquilo",
    noActivity: "Sin actividad",
    plantedSeed: "Semilla plantada",
    ideaCreated: "Idea creada",
    wateredIdea: "Idea regada",
    advancedIdea: "Idea avanzada",
    harvestDone: "Cosecha lograda",
    dueDate: "Fecha objetivo",
    pendingSeeds: "ideas por decidir",
    noPendingSeeds: "Sin semillas pendientes",
    plusReady: "El botón + siempre está listo para una idea.",
    readyToDecide: "Lista para decidir.",
    done: "Hecho",
    project: gardenName("project", "es", true),
    later: "Guardar para después",
    delete: "Eliminar",
  },
  en: {
    today: gardenName("today", "en"),
    seeds: gardenName("inbox", "en"),
    sprouts: gardenName("project", "en"),
    garden: gardenName("gardenView", "en"),
    planet: gardenName("planetView", "en"),
    path: gardenName("calendar", "en"),
    profile: "Profile",
    settings: "Settings",
    cancel: "Cancel",
    plant: "Plant",
    newSeed: "New seed",
    options: "Options",
    date: "Date",
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    streak: "streak",
    activeDays: "active days",
    now: "Now",
    waterNow: "Water now",
    focus: "Cultivate",
    viewSeeds: "View seeds",
    openGarden: "Open garden",
    quietGarden: "Your garden is calm",
    captureIdea: "Capture an idea when it appears",
    seedWaiting: "A seed is waiting to take shape",
    noPressure: "No pressure: one review is enough",
    wateringUpToDate: "Watering is up to date",
    wateringQueue: "to water",
    monthPath: "See the month and active days",
    quietDay: "Quiet day",
    noActivity: "No activity",
    plantedSeed: "Seed planted",
    ideaCreated: "Idea created",
    wateredIdea: "Idea watered",
    advancedIdea: "Idea advanced",
    harvestDone: "Harvest completed",
    dueDate: "Due date",
    pendingSeeds: "ideas to decide",
    noPendingSeeds: "No pending seeds",
    plusReady: "The + button is always ready for an idea.",
    readyToDecide: "Ready to decide.",
    done: "Done",
    project: gardenName("project", "en", true),
    later: "Save for later",
    delete: "Delete",
  },
} as const;

export function t(key: keyof typeof appCopy.es) {
  return appCopy[appLanguage][key];
}
