import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileAppHeader } from "./app/components/MobileAppHeader";
import { t } from "./app/i18n";

const defaults: ComponentProps<typeof MobileAppHeader> = {
  hidden: false,
  gardenName: "Mi jardín",
  ideaCount: 7,
  onOpenMenu: () => {},
  onGoHome: () => {},
  onOpenSettings: () => {},
};

test("mobile header retains garden details, button labels and icons", () => {
  const markup = renderToStaticMarkup(createElement(MobileAppHeader, defaults));
  assert.ok(markup.includes("Mi jardín"));
  assert.ok(markup.includes("7 ideas"));
  assert.ok(markup.includes('aria-label="Abrir menú"'));
  assert.ok(markup.includes('aria-label="Ir a Hoy"'));
  assert.ok(markup.includes(`aria-label="${t("settings")}"`));
  assert.equal((markup.match(/<button /g) || []).length, 3);
  assert.ok(markup.includes("lucide-menu"));
  assert.ok(markup.includes("lucide-settings"));
});

test("mobile header preserves CSS hiding without unmounting its buttons", () => {
  const visible = MobileAppHeader(defaults);
  const hidden = MobileAppHeader({ ...defaults, hidden: true });
  assert.ok(visible.props.className.endsWith("md:hidden flex"));
  assert.ok(hidden.props.className.endsWith("md:hidden hidden"));
  assert.equal(hidden.props.children.length, 3);
  assert.equal(
    visible.props.className.replace(/ flex$/, ""),
    hidden.props.className.replace(/ hidden$/, ""),
  );
});

test("mobile header delegates actions without invoking them during rendering", () => {
  const calls: string[] = [];
  const header = MobileAppHeader({
    ...defaults,
    onOpenMenu: () => calls.push("menu"),
    onGoHome: () => calls.push("home"),
    onOpenSettings: () => calls.push("settings"),
  });
  assert.deepEqual(calls, []);
  for (const button of header.props.children) button.props.onClick();
  assert.deepEqual(calls, ["menu", "home", "settings"]);
});

test("mobile header accepts an empty garden and escapes its name", () => {
  const markup = renderToStaticMarkup(createElement(MobileAppHeader, {
    ...defaults,
    gardenName: "Jardín <nuevo>",
    ideaCount: 0,
  }));
  assert.ok(markup.includes("Jardín &lt;nuevo&gt;"));
  assert.ok(markup.includes("0 ideas"));
});
