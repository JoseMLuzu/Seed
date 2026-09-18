import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Planet, SeedNote } from "./types";
import { appLanguage } from "./app/i18n";
import { DAY_MS } from "./seedLogic";
import {
  DEFAULT_PLANET_ID,
  DEFAULT_PLANETS,
  LEGACY_DEFAULT_PLANET_IDS,
  THEMES,
  THEME_IDS,
} from "./features/garden/gardenConfig";
import { normalizePlanets } from "./features/garden/normalizePlanets";
import { shouldAcceptSyncedEntity, touchNote, touchPlanet } from "./features/sync/entityRevision";
import { PRIORITY_OPTIONS, SEED_TYPES } from "./features/notes/noteConfig";
import { getIdeaGuidance, priorityDetail, priorityLabel, priorityWeight } from "./features/notes/notePresentation";
import { getAccountInitials, resizeProfilePhoto } from "./features/account/profileHelpers";
import { formatAuthError } from "./features/account/authMessages";
import { PROFILE_PURPOSES, PROFILE_PURPOSE_OPTIONS } from "./features/account/profileConfig";
import { THEME_SELECT_OPTIONS, WATERING_INTERVAL_OPTIONS } from "./features/settings/settingsOptions";
import { ONBOARDING_STEPS } from "./features/onboarding/onboardingConfig";

function note(overrides: Partial<SeedNote> = {}): SeedNote {
  return {
    id: "note",
    title: "Preserved idea",
    content: "Preserved content",
    createdAt: Date.now(),
    tags: [],
    tasks: [],
    isGrowth: false,
    growthStage: "seed",
    ...overrides,
  };
}

function planet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: "planet",
    name: "Preserved garden",
    description: "Preserved description",
    theme: "earth",
    createdAt: 100,
    ...overrides,
  };
}

test("extracted garden configuration retains defaults, theme IDs and legacy IDs", () => {
  assert.equal(DEFAULT_PLANET_ID, "personal");
  assert.equal(DEFAULT_PLANETS[0].id, DEFAULT_PLANET_ID);
  assert.equal(DEFAULT_PLANETS[0].createdAt, 0);
  assert.deepEqual([...THEME_IDS], THEMES.map(theme => theme.id));
  assert.deepEqual([...LEGACY_DEFAULT_PLANET_IDS], ["work", "study"]);
});

test("extracted garden normalization retains invalid-input filtering", () => {
  for (const value of [null, undefined, {}, "invalid"]) {
    assert.deepEqual(normalizePlanets(value), []);
  }
  assert.deepEqual(normalizePlanets([null, 1, {}, { id: 1, name: "Invalid" }, { id: "missing-name" }]), []);
});

test("extracted garden normalization retains names, themes, timestamps and immutability", context => {
  context.mock.method(Date, "now", () => 900);
  const values = [
    { id: "trimmed", name: "  Garden  ", description: "Description", theme: "forest", createdAt: 0, updatedAt: 200 },
    { id: "fallback", name: "  ", description: 42, theme: "invalid" },
  ];
  const original = structuredClone(values);
  assert.deepEqual(normalizePlanets(values), [
    { id: "trimmed", name: "Garden", description: "Description", theme: "forest", createdAt: 0, updatedAt: 200 },
    { id: "fallback", name: "Personal", description: "", theme: "earth", createdAt: 900, updatedAt: undefined },
  ]);
  assert.deepEqual(values, original);
});

test("extracted entity touches retain metadata without mutating their inputs", () => {
  const entry = note({ createdAt: 100, syncVersion: 3 });
  const garden = planet({ syncVersion: 4 });
  const originalEntry = structuredClone(entry);
  const originalGarden = structuredClone(garden);
  assert.deepEqual(touchNote(entry, 500), { ...entry, updatedAt: 500 });
  assert.deepEqual(touchPlanet(garden, 600), { ...garden, updatedAt: 600 });
  assert.deepEqual(entry, originalEntry);
  assert.deepEqual(garden, originalGarden);
});

test("extracted entity touches retain default timestamps", context => {
  context.mock.method(Date, "now", () => 700);
  assert.equal(touchNote(note()).updatedAt, 700);
  assert.equal(touchPlanet(planet()).updatedAt, 700);
});

test("extracted revision comparison gives differing server versions precedence over clocks", () => {
  assert.equal(shouldAcceptSyncedEntity(
    note({ syncVersion: 3, updatedAt: 900 }),
    note({ syncVersion: 4, updatedAt: 100 }),
  ), true);
  assert.equal(shouldAcceptSyncedEntity(
    planet({ syncVersion: 4, updatedAt: 100 }),
    planet({ syncVersion: 3, updatedAt: 900 }),
  ), false);
});

test("extracted revision comparison retains timestamp fallback and acceptance of ties", () => {
  assert.equal(shouldAcceptSyncedEntity(note({ updatedAt: 200 }), note({ updatedAt: 199 })), false);
  assert.equal(shouldAcceptSyncedEntity(note({ updatedAt: 200 }), note({ updatedAt: 200 })), true);
  assert.equal(shouldAcceptSyncedEntity(note({ syncVersion: 3, updatedAt: 200 }), note({ syncVersion: 3, updatedAt: 201 })), true);
  assert.equal(shouldAcceptSyncedEntity(planet({ createdAt: 200 }), planet({ createdAt: 100 })), false);
});

test("extracted note configuration retains persisted IDs, translated labels and priority weights", () => {
  assert.deepEqual(SEED_TYPES.map(type => type.id), ["idea", "project", "goal", "learning"]);
  assert.deepEqual(PRIORITY_OPTIONS.map(option => option.id), ["light", "normal", "important"]);
  for (const option of PRIORITY_OPTIONS) {
    assert.equal(priorityLabel(option), appLanguage === "en" ? option.labelEn : option.label);
    assert.equal(priorityDetail(option), appLanguage === "en" ? option.detailEn : option.detail);
  }
  assert.equal(priorityWeight(note({ priority: "important" })), 8);
  assert.equal(priorityWeight(note({ priority: "light" })), -3);
  assert.equal(priorityWeight(note()), 0);
});

test("extracted idea guidance retains lifecycle precedence and learning presentation", () => {
  assert.equal(getIdeaGuidance(note({ paused: true, growthStage: "bloom" })).kind, "pause");
  const harvest = getIdeaGuidance(note({ growthStage: "bloom", reflection: "Preserved lesson" }));
  assert.equal(harvest.kind, "open");
  assert.equal(harvest.detail, "Preserved lesson");
  assert.equal(harvest.title, "Aprendizaje guardado");
  assert.equal(getIdeaGuidance(note({ growthStage: "bloom" })).title, "Cierre opcional");
  assert.equal(getIdeaGuidance(note({ growthStage: "withered" })).kind, "grow");
  assert.equal(getIdeaGuidance(note()).kind, "grow");
});

test("extracted idea guidance retains watering before focus and the next-step fallback", context => {
  const now = Date.now();
  context.mock.method(Date, "now", () => now);
  const entry = note({
    isGrowth: true,
    growthStage: "sprout",
    lastWateredAt: now - 3 * DAY_MS,
    tasks: [{ id: "task", text: "Preserved next step", completed: false }],
  });
  const original = structuredClone(entry);
  assert.equal(getIdeaGuidance(entry).kind, "water");
  const current = getIdeaGuidance({ ...entry, lastWateredAt: now });
  assert.equal(current.kind, "focus");
  assert.equal(current.detail, "Preserved next step");
  assert.equal(getIdeaGuidance({ ...entry, lastWateredAt: now, tasks: [] }).kind, "open");
  assert.deepEqual(entry, original);
});

test("extracted account initials retain name, email and empty-profile fallbacks", () => {
  assert.equal(getAccountInitials("  Ada   Lovelace  ", "ignored"), "AL");
  assert.equal(getAccountInitials("Ada", "ignored"), "AD");
  assert.equal(getAccountInitials("", " gardener@example.com "), "GA");
  assert.equal(getAccountInitials("", ""), "JD");
});

test("extracted photo helper rejects non-image files before accessing browser APIs", async () => {
  await assert.rejects(resizeProfilePhoto(new File(["text"], "note.txt", { type: "text/plain" })), /invalid-image/);
});

test("extracted auth error formatting retains known messages and unknown-error passthrough", () => {
  assert.match(formatAuthError("Email rate limit exceeded"), /demasiados correos/);
  assert.match(formatAuthError("Invalid login credentials"), /no son correctos/);
  assert.match(formatAuthError("Email not confirmed"), /Confirma tu correo/);
  assert.match(formatAuthError("User already registered"), /Ya existe una cuenta/);
  assert.equal(formatAuthError("Unrecognized error"), "Unrecognized error");
});

test("extracted profile and settings options retain values and theme order", () => {
  assert.deepEqual(PROFILE_PURPOSE_OPTIONS, PROFILE_PURPOSES.map(value => ({ value, label: value })));
  assert.deepEqual(THEME_SELECT_OPTIONS.map(option => option.value), THEMES.map(theme => theme.id));
  assert.deepEqual(WATERING_INTERVAL_OPTIONS.map(option => option.value), ["1", "3", "7"]);
});

test("extracted onboarding retains its steps and renderable icons", () => {
  assert.deepEqual(ONBOARDING_STEPS.map(step => step.title), ["Planta", "Elige", "Avanza"]);
  for (const step of ONBOARDING_STEPS) {
    assert.match(renderToStaticMarkup(createElement(step.icon)), /<svg/);
  }
});
