import test from "node:test";
import assert from "node:assert/strict";
import type { AppView } from "./app/types";
import { navigationLabel } from "./app/navigationLabels";

const views: AppView[] = [
  "today",
  "inbox",
  "projects",
  "focus",
  "board",
  "shed",
  "garden",
  "3D",
  "calendar",
  "profile",
  "harvest",
];

test("every application view has a concise navigation label in both languages", () => {
  for (const view of views) {
    const spanish = navigationLabel(view, "es");
    const english = navigationLabel(view, "en");
    assert.ok(spanish.length > 0, `${view} needs a Spanish label`);
    assert.ok(english.length > 0, `${view} needs an English label`);
    assert.equal(spanish.includes(" "), false, `${view} Spanish label is too long`);
    assert.equal(english.includes(" "), false, `${view} English label is too long`);
  }
});

test("the main destinations use the agreed short garden names", () => {
  assert.equal(navigationLabel("today", "es"), "Hoy");
  assert.equal(navigationLabel("board", "es"), "Pizarra");
  assert.equal(navigationLabel("garden", "es"), "Jardín");
  assert.equal(navigationLabel("3D", "es"), "Planeta");
  assert.equal(navigationLabel("today", "en"), "Today");
  assert.equal(navigationLabel("board", "en"), "Board");
  assert.equal(navigationLabel("garden", "en"), "Garden");
  assert.equal(navigationLabel("3D", "en"), "Planet");
});
