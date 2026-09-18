import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SeedNote } from "./types";
import { HarvestView } from "./features/harvest/HarvestView";
import { ShedView } from "./features/shed/ShedView";
import { t } from "./app/i18n";
import { formatMonthYear } from "./app/dates";
import { createDailyEntryNote, DAY_MS } from "./seedLogic";
import { CalendarView } from "./features/calendar/CalendarView";
import { DEFAULT_DASHBOARD_MODULES } from "./dashboardModules";
import { FocusView } from "./features/focus/FocusView";

// Static markup tests do not apply styles. Ignore the views' stylesheets
// only while loading the views; production CSS imports remain unchanged.
const cssHook = registerHooks({
  load(url, context, nextLoad) {
    if (["noteCare", "upcoming", "gardenerJournal", "gardenBoard"].some(
      name => url.endsWith(`/styles/${name}.css`),
    )) {
      return { format: "module", source: "export {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { InboxView } = await import("./features/notes/InboxView");
const { ProjectsView } = await import("./features/projects/ProjectsView");
const { TodayView } = await import("./features/dashboard/TodayView");
cssHook.deregister();

const noop = () => {};

function note(id: string, overrides: Partial<SeedNote> = {}): SeedNote {
  return {
    id,
    title: id,
    content: `Content for ${id}`,
    createdAt: new Date(2026, 8, 1).getTime(),
    tags: [],
    isGrowth: false,
    tasks: [],
    growthStage: "seed",
    ...overrides,
  };
}

function renderInbox(notes: SeedNote[]) {
  return renderToStaticMarkup(createElement(InboxView, {
    notes,
    quickNote: "",
    setQuickNote: noop,
    onQuickCapture: noop,
    onCultivate: noop,
    onComplete: noop,
    onSaveLater: noop,
    onDelete: noop,
    onSelectNote: noop,
    onShowActions: noop,
    recentlyCreatedNoteId: null,
    onStartPlanting: noop,
  }));
}

function renderHarvest(notes: SeedNote[]) {
  return renderToStaticMarkup(createElement(HarvestView, {
    notes,
    onSelectNote: noop,
    onStartPlanting: noop,
  }));
}

function renderShed(notes: SeedNote[]) {
  return renderToStaticMarkup(createElement(ShedView, {
    notes,
    onSelectNote: noop,
    onRestore: noop,
    onSprout: noop,
    onDelete: noop,
  }));
}

function renderProjects(notes: SeedNote[]) {
  return renderToStaticMarkup(createElement(ProjectsView, {
    notes,
    onSelectNote: noop,
    onFocusNote: noop,
    onToggleTask: noop,
    onOpenWatering: noop,
    onTogglePause: noop,
    onShowActions: noop,
    onStartSprout: noop,
    getProgress: (entry) => entry.tasks.length
      ? Math.round(entry.tasks.filter(task => task.completed).length / entry.tasks.length * 100)
      : 0,
  }));
}

function renderCalendar(notes: SeedNote[], currentMonth = new Date(2020, 8, 1)) {
  return renderToStaticMarkup(createElement(CalendarView, {
    notes,
    currentMonth,
    setCurrentMonth: noop,
    onSelectNote: noop,
    onExit: noop,
  }));
}

function renderFocus(overrides: Partial<ComponentProps<typeof FocusView>> = {}) {
  return renderToStaticMarkup(createElement(FocusView, {
    notes: [],
    theme: "earth",
    focusNoteId: null,
    onAddTinyStep: noop,
    onOpenWatering: noop,
    onSelectNote: noop,
    onToggleTask: noop,
    onUpdateTask: noop,
    onDeleteTask: noop,
    onLogFocus: noop,
    onPickFocus: noop,
    onUpdateFocusMemo: noop,
    onExit: noop,
    ...overrides,
  }));
}

function renderToday(overrides: Partial<ComponentProps<typeof TodayView>> = {}) {
  // The existing journal initializes its viewport from window.innerHeight.
  // Motion's projection root also registers a resize listener. Supply these
  // browser entry points for static rendering, then restore the environment.
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { innerHeight: 844, addEventListener: noop, removeEventListener: noop },
  });
  try {
    return renderToStaticMarkup(createElement(TodayView, {
      accountName: "Ada Gardener",
      notes: [],
      quickNote: "",
      setQuickNote: noop,
      onQuickCapture: () => undefined,
      onUndoCapture: noop,
      onOpenWatering: noop,
      onSkipWatering: noop,
      onSelectNote: noop,
      onToggleTask: noop,
      onFocusNote: noop,
      onStartPlanting: noop,
      onCloseDay: noop,
      onSaveDailyFocus: noop,
      onStartDailyFocus: noop,
      onToggleDailyFocus: noop,
      onContinuePrevious: noop,
      onDismissPrevious: noop,
      onNavigate: noop,
      onShowWateringQueue: noop,
      onCustomize: noop,
      onDevelopNote: noop,
      onSaveLater: noop,
      onUpdateNote: noop,
      onReuseHarvest: () => undefined,
      onSaveJournal: noop,
      boardRaw: null,
      reviewSnoozes: {},
      onSnoozeReview: noop,
      featuredProjectId: "",
      onFeatureProject: noop,
      todayWidgets: [...DEFAULT_DASHBOARD_MODULES],
      dashboardOrder: [...DEFAULT_DASHBOARD_MODULES],
      wateredToday: false,
      wateringStreak: 0,
      getProgress: () => 0,
      dailyIntention: "",
      dailyIntentionNoteId: "",
      ...overrides,
    }));
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("extracted inbox retains its empty state", () => {
  const markup = renderInbox([]);
  assert.ok(markup.includes(t("noPendingSeeds")));
  assert.match(markup, /<button/);
});

test("extracted inbox shows only inbox notes and retains description fallback", () => {
  const markup = renderInbox([
    note("inbox-visible", { inbox: true, content: "inbox-visible" }),
    note("inbox-hidden", { inbox: false }),
  ]);
  assert.match(markup, /inbox-visible/);
  assert.doesNotMatch(markup, /inbox-hidden/);
  assert.ok(markup.includes(t("readyToDecide")));
});

test("extracted inbox retains desktop progressive-list limits", () => {
  const notes = Array.from({ length: 82 }, (_, index) =>
    note(`seed-item-${index}`, { inbox: true }),
  );
  const markup = renderInbox(notes);
  assert.match(markup, /seed-item-79/);
  assert.doesNotMatch(markup, /seed-item-80|seed-item-81/);
  assert.match(markup, /Show 2 more|Ver 2 más/);
});

test("extracted harvest retains its empty state", () => {
  const markup = renderHarvest([]);
  assert.match(markup, /No harvests yet|Todavía no hay cosechas/);
  assert.match(markup, /<button/);
});

test("extracted harvest retains learning selection and does not mutate its input", () => {
  const notes = [
    note("harvest-newer", { growthStage: "bloom", harvestedAt: 300 }),
    note("harvest-learning", {
      growthStage: "bloom",
      harvestedAt: 200,
      reflection: "A retained lesson",
      takeaway: "A retained takeaway",
      focusedMinutes: 12,
    }),
    note("harvest-hidden", { growthStage: "sprout" }),
  ];
  const original = structuredClone(notes);
  const markup = renderHarvest(notes);
  assert.match(markup, /A retained lesson/);
  assert.match(markup, /A retained takeaway/);
  assert.doesNotMatch(markup, /harvest-hidden/);
  assert.ok(markup.indexOf("harvest-learning") < markup.indexOf("harvest-newer"));
  assert.deepEqual(notes, original);
});

test("extracted shed retains its empty state", () => {
  const markup = renderShed([]);
  assert.match(markup, /No hay ideas descansando/);
});

test("extracted shed retains filtering and revision ordering without mutating input", () => {
  const notes = [
    note("shed-older", { paused: true, updatedAt: 100 }),
    note("shed-newer", { paused: true, updatedAt: 200 }),
    note("shed-inbox-hidden", { paused: true, inbox: true }),
    note("shed-harvest-hidden", { paused: true, growthStage: "bloom" }),
    note("shed-active-hidden", { paused: false }),
  ];
  const original = structuredClone(notes);
  const markup = renderShed(notes);
  assert.ok(markup.indexOf("shed-newer") < markup.indexOf("shed-older"));
  assert.doesNotMatch(markup, /shed-inbox-hidden|shed-harvest-hidden|shed-active-hidden/);
  assert.deepEqual(notes, original);
});

test("extracted projects retains its empty state", () => {
  const markup = renderProjects([]);
  assert.match(markup, /Nothing needs steps yet|Nada necesita pasos todavía/);
  assert.match(markup, /Create sprout|Crear brote/);
});

test("extracted projects retains filtering, next-task recommendation and care ordering", () => {
  const now = Date.now();
  const notes = [
    note("project-actionable", {
      createdAt: now,
      lastWateredAt: now,
      isGrowth: true,
      growthStage: "sprout",
      tasks: [{ id: "next", text: "Preserved next task", completed: false }],
    }),
    note("project-thirsty", {
      createdAt: now - 10 * DAY_MS,
      lastWateredAt: now - 5 * DAY_MS,
      wateringIntervalDays: 3,
      isGrowth: true,
      growthStage: "sprout",
    }),
    note("project-inbox-hidden", { isGrowth: true, inbox: true }),
    note("project-harvest-hidden", { isGrowth: true, growthStage: "bloom" }),
    note("project-note-hidden", { isGrowth: false }),
  ];
  const original = structuredClone(notes);
  const markup = renderProjects(notes);
  assert.match(markup, /Preserved next task/);
  assert.doesNotMatch(markup, /project-inbox-hidden|project-harvest-hidden|project-note-hidden/);
  assert.ok(markup.indexOf("project-actionable") < markup.indexOf("project-thirsty"));
  assert.ok(markup.indexOf("project-thirsty") < markup.lastIndexOf("project-actionable"));
  assert.match(markup, /note-care-water/);
  assert.match(markup, /note-care-sun/);
  assert.deepEqual(notes, original);
});

test("extracted projects retains existing inclusion of paused and withered projects", () => {
  const markup = renderProjects([
    note("project-paused", { isGrowth: true, paused: true, growthStage: "sprout" }),
    note("project-withered", { isGrowth: true, growthStage: "withered" }),
  ]);
  assert.match(markup, /project-paused/);
  assert.match(markup, /project-withered/);
});

test("extracted calendar retains empty-month layout and localized navigation", () => {
  const month = new Date(2020, 8, 1);
  const markup = renderCalendar([], month);
  assert.ok(markup.includes(formatMonthYear(month)));
  assert.equal((markup.match(/aria-label="(?:Day|Día) \d+"/g) || []).length, 30);
  assert.match(markup, /aria-label="(?:Previous month|Mes anterior)"/);
  assert.match(markup, /aria-label="(?:Next month|Mes siguiente)"/);
  assert.match(markup, /A quiet day|Un día tranquilo/);
});

test("extracted calendar retains leap-month day cells", () => {
  const markup = renderCalendar([], new Date(2020, 1, 1));
  assert.equal((markup.match(/aria-label="(?:Day|Día) \d+"/g) || []).length, 29);
});

test("extracted calendar retains activity and planned events without mutating input", () => {
  const notes = [
    note("calendar-visible", {
      createdAt: new Date(2020, 8, 1, 9).getTime(),
      dueDate: new Date(2020, 8, 1, 18).getTime(),
    }),
    note("calendar-other-month-hidden", { createdAt: new Date(2020, 9, 1).getTime() }),
  ];
  const original = structuredClone(notes);
  const markup = renderCalendar(notes);
  assert.match(markup, /calendar-visible/);
  assert.doesNotMatch(markup, /calendar-other-month-hidden/);
  assert.match(markup, /Recorded activity|Actividad registrada/);
  assert.match(markup, /Planned|Planificado/);
  assert.match(markup, /Target date|Fecha objetivo/);
  assert.deepEqual(notes, original);
});

test("extracted calendar retains daily focus totals and non-openable day closure", () => {
  const startedAt = new Date(2020, 8, 1, 9).getTime();
  const endedAt = startedAt + 25 * 60_000;
  const notes = [note("calendar-daily", {
    systemKind: "daily-entry",
    focusHistory: [{ startedAt, endedAt, minutes: 25 }],
    dailyEntry: {
      version: 1,
      date: "2020-09-01",
      intention: "Preserved daily intention",
      startedAt,
      closedAt: new Date(2020, 8, 1, 20).getTime(),
      reflection: "Preserved daily reflection",
      outcome: "yes",
    },
  })];
  const markup = renderCalendar(notes);
  assert.match(markup, /25m/);
  assert.match(markup, /Preserved daily intention/);
  assert.match(markup, /Preserved daily reflection/);
  assert.match(markup, /Intention completed|Intención completada/);
  assert.equal((markup.match(/<button[^>]*disabled=""/g) || []).length, 2);
});

test("extracted dashboard renders all ten default modules", () => {
  const markup = renderToday();
  for (const className of [
    "dashboard-capture", "dashboard-focus-v2", "dashboard-upcoming",
    "dashboard-spaces", "dashboard-recommendation", "dashboard-projects",
    "dashboard-harvest", "gardener-journal-card", "garden-board-preview",
    "dashboard-day-footer",
  ]) assert.ok(markup.includes(className), className);
  assert.match(markup, /Ada\./);
});

test("extracted dashboard retains the all-modules-hidden state", () => {
  const markup = renderToday({ todayWidgets: [] });
  assert.match(markup, /Today, your way\.|Hoy, a tu manera\./);
  assert.doesNotMatch(markup, /class="dashboard-capture"|class="dashboard-projects"/);
  assert.match(markup, /Arrange my walk|Organizar mi paseo/);
});

test("extracted dashboard retains custom module order and visibility", () => {
  const markup = renderToday({
    todayWidgets: ["capture", "learning", "activity"],
    dashboardOrder: ["learning", "summary", "capture", "activity"],
  });
  assert.ok(markup.indexOf('class="dashboard-harvest"') < markup.indexOf('class="dashboard-capture"'));
  assert.ok(markup.indexOf('class="dashboard-capture"') < markup.indexOf('class="dashboard-day-footer'));
  assert.doesNotMatch(markup, /class="dashboard-spaces"|gardener-journal-card/);
});

test("extracted dashboard retains quick-capture text and blank-submit guard", () => {
  const filled = renderToday({ todayWidgets: ["capture"], quickNote: "Preserved quick capture" });
  assert.match(filled, /value="Preserved quick capture"/);
  assert.doesNotMatch(filled, /<button[^>]*disabled=""[^>]*dashboard-capture-submit/);
  const blank = renderToday({ todayWidgets: ["capture"], quickNote: "   " });
  assert.match(blank, /<button[^>]*disabled=""[^>]*dashboard-capture-submit/);
});

test("extracted dashboard retains review priority and snoozing without mutating notes", () => {
  const now = Date.now();
  const notes = [
    note("review-normal", { createdAt: now - 10 * DAY_MS }),
    note("review-important", { createdAt: now - 4 * DAY_MS, priority: "important" }),
  ];
  const original = structuredClone(notes);
  const markup = renderToday({ notes, todayWidgets: ["watering"] });
  assert.match(markup, /review-important/);
  assert.doesNotMatch(markup, /review-normal/);
  assert.match(markup, /note-care-water/);
  const snoozed = renderToday({
    notes,
    todayWidgets: ["watering"],
    reviewSnoozes: { "review-important": now + DAY_MS },
  });
  assert.match(snoozed, /review-normal/);
  assert.doesNotMatch(snoozed, /review-important/);
  assert.deepEqual(notes, original);
});

test("extracted dashboard preserves shared diary entries and daily focus activity", () => {
  const now = Date.now();
  const entry = createDailyEntryNote({
    id: "daily-shared",
    intention: "Preserved daily goal",
    planetId: "personal",
    language: "en",
    now,
  });
  entry.dailyEntry!.reflection = "Preserved journal reflection";
  entry.dailyEntry!.journalUpdatedAt = now;
  entry.focusHistory = [{ startedAt: now - 25 * 60_000, endedAt: now, minutes: 25 }];
  const notes = [entry];
  const original = structuredClone(notes);
  const markup = renderToday({
    notes,
    currentDailyEntry: entry,
    dailyIntention: entry.dailyEntry!.intention,
    todayWidgets: ["focus", "journal", "activity", "summary"],
  });
  assert.match(markup, /Preserved daily goal/);
  assert.match(markup, /Preserved journal reflection/);
  assert.match(markup, /<strong>25<\/strong>/);
  assert.equal((markup.match(/<strong>0<\/strong>/g) || []).length, 3);
  assert.deepEqual(notes, original);
});

test("extracted dashboard retains the closed-day activity presentation", () => {
  const now = Date.now();
  const entry = note("daily-closed", {
    createdAt: now,
    harvestedAt: now,
    growthStage: "bloom",
    seedType: "learning",
    systemKind: "daily-entry",
    tags: ["daily-closure"],
  });
  const markup = renderToday({
    notes: [entry],
    currentDailyEntry: entry,
    todayWidgets: ["activity"],
  });
  assert.match(markup, /Your day is wrapped up\.|Tu día ya tiene su cierre\./);
  assert.match(markup, /View my reflection|Ver mi cierre/);
});

test("extracted project focus retains its empty state without logging a session", () => {
  const logged: unknown[][] = [];
  const markup = renderFocus({ onLogFocus: (...args) => { logged.push(args); } });
  assert.match(markup, /Nada urgente ahora/);
  assert.match(markup, /Tu jardín no tiene ideas activas pendientes\./);
  assert.deepEqual(logged, []);
});

test("extracted project focus retains exclusion of inbox, paused and harvested notes", () => {
  const notes = [
    note("focus-inbox-hidden", { inbox: true }),
    note("focus-paused-hidden", { paused: true }),
    note("focus-harvest-hidden", { growthStage: "bloom" }),
  ];
  const original = structuredClone(notes);
  const markup = renderFocus({ notes });
  assert.match(markup, /Nada urgente ahora/);
  assert.doesNotMatch(markup, /focus-inbox-hidden|focus-paused-hidden|focus-harvest-hidden/);
  assert.deepEqual(notes, original);
});

test("extracted project focus safely renders an unavailable selection with no candidates", () => {
  const markup = renderFocus({ focusNoteId: "focus-unavailable" });
  assert.match(markup, /Nada urgente ahora/);
  assert.doesNotMatch(markup, /focus-unavailable/);
});
