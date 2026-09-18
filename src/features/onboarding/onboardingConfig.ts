/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Archive, Droplets, Leaf } from "lucide-react";

export const ONBOARDING_STEPS = [
  {
    icon: Leaf,
    eyebrow: "Captura",
    title: "Planta",
    text: "Guarda una idea en una línea. Sin categoría, fecha ni presión.",
    action: "Captura ahora. Seed la cuida.",
    detail: "El semillero existe para ideas incompletas.",
  },
  {
    icon: Archive,
    eyebrow: "Decide",
    title: "Elige",
    text: "Hoy te muestra una cosa: regar, darle un paso o guardarla en el Cobertizo.",
    action: "Una decisión pequeña.",
    detail: "Lo que no es para hoy puede descansar sin molestar.",
  },
  {
    icon: Droplets,
    eyebrow: "Cultiva",
    title: "Avanza",
    text: "Un brote solo pide el siguiente paso. Al cerrar, deja una huella en tu jardín.",
    action: "Tu progreso se vuelve visible.",
    detail: "Cosecha cuando algo terminó o te dejó una lección.",
  },
];
