/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Check, Lightbulb, NotebookPen, Plus, X } from "lucide-react";
import type { AppLanguage } from "../../app/i18n";

export function FocusNotesTray({
  language,
  projectName,
  notebookLabel,
  projectMemo,
  onProjectMemoChange,
  onQuickCapture,
  embedded = false,
}: {
  language: AppLanguage;
  projectName?: string;
  notebookLabel?: string;
  projectMemo?: string;
  onProjectMemoChange?: (value: string) => void;
  onQuickCapture: (value: string) => void;
  embedded?: boolean;
}) {
  const copy = (es: string, en: string) => (language === "en" ? en : es);
  const hasProjectMemo = Boolean(projectName && onProjectMemoChange);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"project" | "capture">(
    hasProjectMemo ? "project" : "capture",
  );
  const [capture, setCapture] = useState("");
  const [saved, setSaved] = useState(false);

  const saveCapture = () => {
    const value = capture.trim();
    if (!value) return;
    onQuickCapture(value);
    setCapture("");
    setSaved(true);
  };

  const openTab = (nextTab: "project" | "capture") => {
    setTab(nextTab);
    setSaved(false);
    setOpen(true);
  };

  return (
    <div className={embedded ? "daily-focus-notes-tray" : "fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[90] flex justify-center px-4 pointer-events-none"}>
      {!open ? (
        embedded ? (
          <div className="daily-focus-tools" aria-label={copy("Herramientas de enfoque", "Focus tools")}>
            <button type="button" onClick={() => openTab("capture")}>
              <Lightbulb size={16} />
              <span><strong>{copy("Captura rápida", "Quick capture")}</strong><small>{copy("Guarda una idea y continúa", "Save a thought and continue")}</small></span>
            </button>
            {hasProjectMemo && <button type="button" onClick={() => openTab("project")}>
              <NotebookPen size={16} />
              <span><strong>{notebookLabel || copy("Cuaderno del proyecto", "Project notebook")}</strong><small>{projectMemo?.trim() ? copy("Hay notas guardadas", "Notes saved") : projectName}</small></span>
              {projectMemo?.trim() && <i aria-label={copy("Contiene notas", "Contains notes")} />}
            </button>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)]/88 px-4 text-sm font-semibold text-[var(--sage)] shadow-[0_14px_45px_rgba(20,30,24,0.16)] backdrop-blur-2xl transition-transform active:scale-[0.98]"
          >
            <NotebookPen size={16} />
            {copy("Anotar sin salir del foco", "Write without leaving focus")}
          </button>
        )
      ) : (
        <section
          className={`${embedded ? "daily-focus-notes-panel" : "pointer-events-auto w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-white/60 bg-[var(--surface-strong)]/94 shadow-[0_24px_90px_rgba(12,24,16,0.24)] backdrop-blur-3xl"}`}
          aria-label={copy("Notas de enfoque", "Focus notes")}
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] p-2">
            {hasProjectMemo && (
              <button
                type="button"
                onClick={() => setTab("project")}
                className={`min-h-10 flex-1 rounded-full px-3 text-sm font-semibold transition-colors ${tab === "project" ? "bg-[var(--bg-app)] text-[var(--earth)]" : "text-[var(--text-muted)]"}`}
              >
                {notebookLabel || copy("Cuaderno del proyecto", "Project notebook")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setTab("capture");
                setSaved(false);
              }}
              className={`min-h-10 flex-1 rounded-full px-3 text-sm font-semibold transition-colors ${tab === "capture" ? "bg-[var(--bg-app)] text-[var(--earth)]" : "text-[var(--text-muted)]"}`}
            >
              {copy("Captura rápida", "Quick capture")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-app)]"
              aria-label={copy("Cerrar notas", "Close notes")}
            >
              <X size={17} />
            </button>
          </div>

          <div className="p-4">
            {tab === "project" && hasProjectMemo ? (
              <label className="block">
                <span className="flex items-center gap-2 text-xs font-semibold text-[var(--sage)]">
                  <NotebookPen size={14} />
                  {projectName}
                </span>
                <textarea
                  value={projectMemo || ""}
                  onChange={(event) => onProjectMemoChange(event.target.value)}
                  rows={4}
                  autoFocus
                  placeholder={copy(
                    "Anota decisiones, cosas por quitar o el siguiente paso…",
                    "Capture decisions, things to remove, or the next step…",
                  )}
                  className="mt-3 min-h-28 w-full resize-none rounded-2xl bg-[var(--bg-app)] px-4 py-3 text-sm font-medium leading-relaxed text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/60"
                />
                <span className="mt-2 block text-[11px] font-medium text-[var(--text-muted)]">
                  {copy(
                    "Se guarda automáticamente en este proyecto.",
                    "Saved automatically in this project.",
                  )}
                </span>
              </label>
            ) : (
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--sage)]" htmlFor="focus-quick-capture">
                  <Lightbulb size={14} />
                  {copy("Guardar para después", "Save for later")}
                </label>
                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    id="focus-quick-capture"
                    value={capture}
                    onChange={(event) => {
                      setCapture(event.target.value);
                      setSaved(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        saveCapture();
                      }
                    }}
                    rows={2}
                    autoFocus
                    placeholder={copy(
                      "Escribe la idea y continúa…",
                      "Write the thought and keep going…",
                    )}
                    className="min-h-14 min-w-0 flex-1 resize-none rounded-2xl bg-[var(--bg-app)] px-4 py-3 text-sm font-medium text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/60"
                  />
                  <button
                    type="button"
                    onClick={saveCapture}
                    disabled={!capture.trim()}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--sage)] text-[var(--on-sage)] shadow-sm transition-transform active:scale-95 disabled:opacity-40"
                    aria-label={copy("Guardar semilla", "Save seed")}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <p className="mt-2 flex min-h-4 items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  {saved ? (
                    <><Check size={13} className="text-[var(--sage)]" />{copy("Guardada en Semillas.", "Saved to Seeds.")}</>
                  ) : copy("Enter guarda · Shift + Enter crea una línea", "Enter saves · Shift + Enter adds a line")}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
