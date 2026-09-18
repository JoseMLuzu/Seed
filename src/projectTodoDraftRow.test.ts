import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { ProjectTodoDraftRow } from "./features/projects/ProjectTodoDraftRow";

const defaults: ComponentProps<typeof ProjectTodoDraftRow> = {
  todo: { id: "task-1", text: "Regar la planta", completed: false },
  index: 0,
  total: 2,
  appLanguage: "es",
  onToggle: () => {},
  onChange: () => {},
  onEnter: () => {},
  onRemove: () => {},
  onFocus: () => {},
};

// Capture the returned elements during a real React render so useSortable
// runs inside React and its providers. The callbacks can then be exercised
// without pretending these tests cover browser drag or keyboard behavior.
function renderRow(overrides: Partial<typeof defaults> = {}) {
  const props = { ...defaults, ...overrides };
  let row: ReactElement | undefined;
  function CaptureRow() {
    row = ProjectTodoDraftRow(props);
    return row;
  }
  const markup = renderToStaticMarkup(createElement(DndContext, {},
    createElement(SortableContext, {
      items: [props.todo.id],
      children: createElement(CaptureRow),
    }),
  ));
  assert.ok(row);
  return { markup, children: (row.props as { children: ReactElement[] }).children };
}

test("project task row preserves values, completion styling and localized labels", () => {
  const spanish = renderRow().markup;
  assert.ok(spanish.includes('data-project-todo-id="task-1"'));
  assert.ok(spanish.includes('value="Regar la planta"'));
  assert.ok(spanish.includes('placeholder="Primera labor"'));
  assert.ok(spanish.includes('aria-label="Arrastrar para ordenar labor"'));
  const english = renderRow({
    appLanguage: "en",
    index: 1,
    todo: { ...defaults.todo, completed: true },
  }).markup;
  assert.ok(english.includes('placeholder="Next garden task"'));
  assert.ok(english.includes('aria-label="Mark garden task"'));
  assert.ok(english.includes("line-through opacity-50"));
  assert.ok(english.includes('aria-label="Drag to reorder task"'));
});

test("project task row delegates toggle, change and focus to its parent", () => {
  const calls: unknown[] = [];
  const { children } = renderRow({
    onToggle: id => calls.push(["toggle", id]),
    onChange: (id, text) => calls.push(["change", id, text]),
    onFocus: () => calls.push(["focus"]),
  });
  assert.deepEqual(calls, []);
  (children[0].props as { onClick: () => void }).onClick();
  const input = children[1].props as {
    onChange: (event: { target: { value: string } }) => void;
    onFocus: () => void;
  };
  input.onChange({ target: { value: "Nueva labor" } });
  input.onFocus();
  assert.deepEqual(calls, [
    ["toggle", "task-1"], ["change", "task-1", "Nueva labor"], ["focus"],
  ]);
  assert.equal(defaults.todo.text, "Regar la planta");
});

function keyPress(overrides: Partial<typeof defaults>, key: string) {
  let prevented = false;
  const { children } = renderRow(overrides);
  const input = children[1].props as {
    onKeyDown: (event: { key: string; preventDefault: () => void }) => void;
  };
  input.onKeyDown({ key, preventDefault: () => { prevented = true; } });
  return prevented;
}

test("project task row Enter prevents submission and delegates task insertion", () => {
  const calls: string[] = [];
  assert.equal(keyPress({ onEnter: id => calls.push(id) }, "Enter"), true);
  assert.deepEqual(calls, ["task-1"]);
});

test("project task row Backspace removes only an empty row with siblings", () => {
  const calls: string[] = [];
  const overrides = {
    todo: { ...defaults.todo, text: "" },
    onRemove: (id: string) => calls.push(id),
  };
  assert.equal(keyPress(overrides, "Backspace"), true);
  assert.deepEqual(calls, ["task-1"]);
  calls.length = 0;
  assert.equal(keyPress({ ...overrides, total: 1 }, "Backspace"), false);
  assert.equal(keyPress({ ...overrides, todo: defaults.todo }, "Backspace"), false);
  assert.deepEqual(calls, []);
});

test("project task row unrelated keys do not invoke insertion or deletion", () => {
  const calls: string[] = [];
  assert.equal(keyPress({
    onEnter: id => calls.push(id),
    onRemove: id => calls.push(id),
  }, "ArrowDown"), false);
  assert.deepEqual(calls, []);
});
