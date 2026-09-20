import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { saveDailyFocusEntry } from "./dailyFocus";

const cssHook = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/styles/dailyFocus.css")) {
      return { format: "module", source: "export {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { DailyFocusSession } = await import("./DailyFocusSession");
cssHook.deregister();

const noop = () => {};

test("daily focus starts as a calm preparation screen with one primary task", () => {
  const notes = saveDailyFocusEntry([], {
    intention: "Escribir una nota por libro",
    planetId: "garden",
    language: "es",
    now: new Date(2026, 8, 18, 10).getTime(),
  });
  const entry = notes.find(note => note.dailyEntry);
  const markup = renderToStaticMarkup(createElement(DailyFocusSession, {
    entry,
    notes,
    language: "es",
    onToggleComplete: noop,
    onLogMinutes: noop,
    onUpdateProjectMemo: noop,
    onQuickCapture: noop,
    onExit: noop,
  }));

  assert.match(markup, /data-active="false"/);
  assert.match(markup, /Escribir una nota por libro/);
  assert.match(markup, /10<span>:<\/span>00/);
  assert.match(markup, /5 min/);
  assert.match(markup, /10 min/);
  assert.match(markup, /25 min/);
  assert.match(markup, /Empezar sesión/);
  assert.match(markup, /Ya hice esta labor/);
  assert.match(markup, /daily-focus-ambient/);
  assert.match(markup, /data-state="ready"/);
  assert.match(markup, /Mesa del jardinero/);
  assert.match(markup, /Lista para cultivar/);
  assert.match(markup, /Tus notas, labores y captura rápida aparecerán al comenzar/);
  assert.doesNotMatch(markup, /Nota de enfoque/);
  assert.doesNotMatch(markup, /Se guarda automáticamente/);
  assert.match(markup, /daily-focus-action-primary/);
});

test("daily focus keeps the empty state and its route back to Today", () => {
  const markup = renderToStaticMarkup(createElement(DailyFocusSession, {
    notes: [],
    language: "es",
    onToggleComplete: noop,
    onLogMinutes: noop,
    onUpdateProjectMemo: noop,
    onQuickCapture: noop,
    onExit: noop,
  }));

  assert.match(markup, /Elige tu labor de hoy/);
  assert.match(markup, /Volver a Hoy/);
  assert.doesNotMatch(markup, /Empezar sesión/);
});
