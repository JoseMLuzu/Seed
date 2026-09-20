/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { appLanguage } from "../../app/i18n";
import { PlantIllustration } from "../../components/garden/PlantIllustration";
import { gardenName } from "../../gardenVocabulary";
import { motion, AnimatePresence } from "motion/react";
import {
  startFocusLiveActivity,
  stopFocusLiveActivity,
  updateFocusLiveActivity,
} from "../../native/liveActivity";
import {
  Leaf,
  CheckCircle2,
  Trash2,
  ListChecks,
  ChevronLeft,
  ChevronDown,
  Settings,
  Droplets,
  Target,
} from "lucide-react";
import type { Theme, SeedNote } from "../../types";
import { daysSince, wateringDue } from "../../seedLogic";
import type { SeedSoundKind } from "../../sound";
import { AppSelect } from "../../components/ui/AppSelect";
import { FocusNotesTray } from "./FocusNotesTray";

export function FocusView({
  notes,
  theme,
  focusNoteId,
  onAddTinyStep,
  onOpenWatering,
  onSelectNote,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onLogFocus,
  onPickFocus,
  onUpdateFocusMemo,
  onQuickCapture,
  onFocusFeedback,
  onExit,
}: {
  notes: SeedNote[];
  theme: Theme;
  focusNoteId: string | null;
  onAddTinyStep: (id: string, text?: string) => void;
  onOpenWatering: (id: string) => void;
  onSelectNote: (id: string) => void;
  onToggleTask: (noteId: string, taskId: string) => void;
  onUpdateTask: (noteId: string, taskId: string, text: string) => void;
  onDeleteTask: (noteId: string, taskId: string) => void;
  onLogFocus: (id: string, minutes: number) => void;
  onPickFocus: (id: string) => void;
  onUpdateFocusMemo: (noteId: string, value: string) => void;
  onQuickCapture: (value: string) => void;
  onFocusFeedback?: (kind: "open" | SeedSoundKind, force?: boolean) => void;
  onExit: () => void;
}) {
  const focusCandidates = useMemo(
    () =>
      notes
        .filter(
          (note) => !note.inbox && !note.paused && note.growthStage !== "bloom",
        )
        .sort((a, b) => {
          const aScore =
            (wateringDue(a) ? 10 : 0) +
            daysSince(a.lastWateredAt || a.createdAt);
          const bScore =
            (wateringDue(b) ? 10 : 0) +
            daysSince(b.lastWateredAt || b.createdAt);
          return bScore - aScore;
        }),
    [notes],
  );
  const focusNote =
    notes.find((note) => note.id === focusNoteId) || focusCandidates[0];
  const [step, setStep] = useState("");
  const [duration, setDuration] = useState(10);
  const [remaining, setRemaining] = useState(10 * 60);
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sessionStartCompleted, setSessionStartCompleted] = useState(0);
  const [sessionSummary, setSessionSummary] = useState<{
    minutes: number;
    steps: number;
    growth: number;
  } | null>(null);
  const [liveActivityEndTimestamp, setLiveActivityEndTimestamp] = useState<
    number | null
  >(null);
  const [confirmExit, setConfirmExit] = useState<"exit" | "edit" | null>(null);
  const nextTask = focusNote?.tasks.find((task) => !task.completed);
  const completedSteps =
    focusNote?.tasks.filter((task) => task.completed).length || 0;
  const progress = focusNote?.tasks.length
    ? Math.round((completedSteps / focusNote.tasks.length) * 100)
    : 0;
  const isDay = new Date().getHours() >= 6 && new Date().getHours() < 19;
  const visibleTasks = focusNote?.tasks.slice(0, 5) || [];
  const hiddenTaskCount = Math.max(
    0,
    (focusNote?.tasks.length || 0) - visibleTasks.length,
  );
  const sessionCompletedSteps = Math.max(
    0,
    completedSteps - sessionStartCompleted,
  );
  const focusGrowthProgress = Math.min(
    100,
    Math.max(progress, progress + sessionCompletedSteps * 6),
  );
  const focusNoteMemo = focusNote?.focusNote || "";
  const focusOptions = useMemo(
    () =>
      focusCandidates.map((note) => ({
        value: note.id,
        label: note.title,
        description:
          note.tasks.find((task) => !task.completed)?.text ||
          "Lista para enfocar",
      })),
    [focusCandidates],
  );

  useEffect(() => {
    if (!active || !focusNote) return;

    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setActive(false);
          setFinished(true);
          void stopFocusLiveActivity();
          setLiveActivityEndTimestamp(null);
          onLogFocus(focusNote.id, duration);
          setSessionSummary({
            minutes: duration,
            steps: Math.max(0, completedSteps - sessionStartCompleted),
            growth: progress,
          });
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    active,
    completedSteps,
    duration,
    focusNote?.id,
    progress,
    sessionStartCompleted,
  ]);

  useEffect(() => {
    setActive(false);
    setFinished(false);
    setSessionSummary(null);
    setRemaining(duration * 60);
    void stopFocusLiveActivity();
    setLiveActivityEndTimestamp(null);
  }, [focusNote?.id, duration]);

  useEffect(() => {
    if (!active || !focusNote || liveActivityEndTimestamp == null) return;
    void updateFocusLiveActivity({
      noteId: focusNote.id,
      title: focusNote.title,
      subtitle: nextTask?.text || "Mantén una sola acción.",
      endTimestamp: liveActivityEndTimestamp,
      progress,
    });
  }, [active, focusNote, liveActivityEndTimestamp, nextTask?.text, progress]);

  const startFocus = (minutes: number) => {
    onFocusFeedback?.("open", true);
    setDuration(minutes);
    setRemaining(minutes * 60);
    setFinished(false);
    setSessionSummary(null);
    setSessionStartCompleted(completedSteps);
    setActive(true);
    const endTimestamp = Date.now() + minutes * 60 * 1000;
    setLiveActivityEndTimestamp(endTimestamp);
    void startFocusLiveActivity({
      noteId: focusNote.id,
      title: focusNote.title,
      subtitle: nextTask?.text || "Mantén una sola acción.",
      endTimestamp,
      progress,
    });
  };

  const stopFocus = () => {
    const elapsed = Math.max(1, Math.ceil((duration * 60 - remaining) / 60));
    if (active && focusNote) {
      onLogFocus(focusNote.id, elapsed);
      setSessionSummary({
        minutes: elapsed,
        steps: Math.max(0, completedSteps - sessionStartCompleted),
        growth: progress,
      });
      setFinished(true);
    }
    setActive(false);
    onFocusFeedback?.("harvest");
    void stopFocusLiveActivity();
    setLiveActivityEndTimestamp(null);
  };

  const requestExit = (intent: "exit" | "edit") => {
    if (active) {
      setConfirmExit(intent);
      return;
    }

    if (intent === "edit") {
      onSelectNote(focusNote.id);
    }
    onExit();
  };

  const confirmFocusExit = () => {
    const intent = confirmExit || "exit";
    setConfirmExit(null);
    stopFocus();
    if (intent === "edit") {
      onSelectNote(focusNote.id);
    }
    onExit();
  };

  const completeCurrentTask = () => {
    if (!focusNote || !nextTask) return;
    onToggleTask(focusNote.id, nextTask.id);
    onFocusFeedback?.("step");
  };

  const addFocusStep = () => {
    if (!focusNote || !step.trim()) return;
    onAddTinyStep(focusNote.id, step);
    setStep("");
  };

  const focusMinuteLabel = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const focusSecondLabel = (remaining % 60).toString().padStart(2, "0");
  const formattedTime = `${focusMinuteLabel}:${focusSecondLabel}`;
  const setFocusDuration = (minutes: number) => {
    setDuration(minutes);
    setRemaining(minutes * 60);
  };
  const deepFocus = active;

  if (!focusNote) {
    return (
      <motion.div
        key="focus-empty"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pb-2 md:pb-8"
      >
        <div className="rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] p-8 text-center">
          <button
            type="button"
            onClick={onExit}
            className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[var(--sage)] transition-colors hover:bg-[var(--surface-soft)]"
          >
            <ChevronLeft size={18} />
            Volver a Hoy
          </button>
          <Target
            className="mx-auto text-[var(--sage)] opacity-40 mb-4"
            size={44}
          />
          <p className="font-serif text-3xl text-[var(--earth)]">
            Nada urgente ahora
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Tu jardín no tiene ideas activas pendientes.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="focus-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[70] overflow-y-auto app-scrollbar transition-colors duration-700 ${deepFocus ? "bg-[#06100c]" : isDay ? "bg-[#f4f7f2]" : "bg-[#07110d]"} text-[var(--text-main)]`}
    >
      <div className="relative min-h-screen overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-[calc(env(safe-area-inset-top)+0.85rem)] sm:px-6">
        <div
          className={`absolute inset-0 transition-all duration-700 ${deepFocus ? "bg-[radial-gradient(circle_at_48%_42%,rgba(99,129,89,0.22),transparent_42%),linear-gradient(180deg,#06100c_0%,#0d1a13_58%,#07100c_100%)]" : isDay ? "bg-[linear-gradient(180deg,#f7faf5_0%,#edf4ed_100%)]" : "bg-[linear-gradient(180deg,#07110d_0%,#122019_100%)]"}`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-48 transition-opacity duration-700 ${deepFocus ? "opacity-70 bg-[radial-gradient(circle_at_50%_0%,rgba(183,218,158,0.22),transparent_62%)]" : "bg-[radial-gradient(circle_at_50%_0%,rgba(126,158,116,0.18),transparent_62%)]"}`}
        />
        {deepFocus && (
          <div className="pointer-events-none absolute inset-0 bg-black/24 transition-opacity duration-700" />
        )}
        <AnimatePresence>
          {deepFocus && (
            <motion.div
              key="deep-focus-entry"
              className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.15, ease: "easeOut" }}
            >
              <motion.div
                initial={{ scale: 0.86, y: 14 }}
                animate={{ scale: [0.86, 1, 1.04], y: [14, 0, -4] }}
                transition={{ duration: 1.15, ease: "easeOut" }}
                className="grid h-24 w-24 place-items-center rounded-[2rem] border border-white/18 bg-white/[0.08] text-white shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
              >
                <Leaf size={34} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2.35rem)] w-full max-w-[72rem] flex-col">
          <div
            className={`flex items-center justify-between gap-3 transition-opacity duration-500 ${deepFocus ? "opacity-72" : "opacity-100"}`}
          >
            <button
              onClick={() => requestExit("exit")}
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-strong)]/80 text-[var(--sage)] shadow-sm ring-1 ring-black/5 backdrop-blur-xl soft-interaction"
              aria-label="Salir de enfoque"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 text-center">
              <p
                className={`truncate text-sm font-semibold ${deepFocus ? "text-white/82" : "text-[var(--earth)]"}`}
              >
                {gardenName("focus", appLanguage)}
              </p>
              <p
                className={`text-xs font-medium ${deepFocus ? "text-[#c9e5b8]/58" : "text-[var(--text-muted)]"}`}
              >
                {completedSteps}/{focusNote.tasks.length}{" "}
                {gardenName("task", appLanguage).toLocaleLowerCase()}
              </p>
            </div>
            <button
              onClick={() => requestExit("edit")}
              disabled={deepFocus}
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-strong)]/80 text-[var(--text-muted)] shadow-sm ring-1 ring-black/5 backdrop-blur-xl soft-interaction disabled:pointer-events-none disabled:opacity-0"
              aria-label="Editar idea"
            >
              <Settings size={17} />
            </button>
          </div>

          <main className="flex flex-1 flex-col justify-center py-5 md:hidden">
            <section
              className={`order-1 overflow-hidden rounded-[2rem] border shadow-[0_28px_90px_rgba(39,53,43,0.16)] ring-1 ring-black/[0.03] backdrop-blur-2xl transition-all duration-700 md:rounded-[2.4rem] ${deepFocus ? "border-white/14 bg-[#101d16]/86 text-white shadow-[0_32px_110px_rgba(0,0,0,0.34)]" : "border-white/55 bg-[var(--surface-strong)]/82"}`}
            >
              <div className="px-5 pb-5 pt-6 text-center md:px-7 md:pb-7 md:pt-8">
                <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-[var(--bg-app)]/82 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                  <Target size={13} className="text-[var(--sage)]" />
                  <span>
                    {active
                      ? gardenName("focus", appLanguage)
                      : `${duration} min`}
                  </span>
                </div>
                <p
                  className={`mt-5 font-mono text-[4.4rem] font-semibold leading-none tracking-tight tabular-nums transition-colors sm:text-7xl md:text-[5.4rem] ${deepFocus ? "text-white" : "text-[var(--earth)]"}`}
                >
                  {formattedTime}
                </p>
                <h2
                  className={`mx-auto mt-5 max-w-sm text-balance text-2xl font-semibold leading-tight tracking-tight transition-colors md:text-[1.75rem] ${deepFocus ? "text-white" : "text-[var(--earth)]"}`}
                >
                  {nextTask?.text || "Elige un primer paso pequeño"}
                </h2>
                <p
                  className={`mx-auto mt-2 max-w-sm line-clamp-2 text-sm font-medium leading-relaxed transition-colors ${deepFocus ? "text-white/56" : "text-[var(--text-muted)]"}`}
                >
                  {focusNote.title}
                </p>

                <div
                  className={`relative mx-auto mt-5 flex h-40 max-w-xs items-end justify-center overflow-hidden rounded-[1.75rem] md:mt-7 md:h-[23rem] md:max-w-none md:rounded-[2rem] ${isDay ? "bg-gradient-to-b from-[#edf8ef] via-[#f7fbf4] to-white" : "bg-gradient-to-b from-[#122018] via-[#183021] to-[#edf7ea]"}`}
                >
                  <div className="absolute bottom-8 h-5 w-40 rounded-full bg-green-900/10 blur-md" />
                  <div className="pointer-events-none absolute inset-x-10 top-8 hidden h-28 rounded-full bg-white/35 blur-3xl md:block" />
                  <motion.div
                    key={`${focusNote.id}-${completedSteps}`}
                    initial={{ scale: 0.9, y: 6, opacity: 0.85 }}
                    animate={{
                      scale: active ? [1, 1.04, 1] : 1,
                      y: active ? [0, -3, 0] : 0,
                      opacity: 1,
                    }}
                    transition={{
                      duration: 2.8,
                      repeat: active ? Infinity : 0,
                      ease: "easeInOut",
                    }}
                    className="relative z-10 origin-bottom md:scale-[1.18]"
                  >
                    <PlantIllustration
                      stage={focusNote.growthStage}
                      progress={focusGrowthProgress}
                      isGrowth={focusNote.isGrowth || active}
                      theme={theme}
                    />
                  </motion.div>
                  <AnimatePresence>
                    {active && sessionCompletedSteps > 0 && (
                      <motion.div
                        key={sessionCompletedSteps}
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.94 }}
                        className="absolute right-4 top-4 rounded-full bg-white/82 px-3 py-1.5 text-xs font-semibold text-[var(--sage)] shadow-sm backdrop-blur-xl"
                      >
                        +{sessionCompletedSteps} cultivo
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-[var(--bg-app)] md:max-w-md">
                  <motion.div
                    className="h-full bg-[var(--sage)]"
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div
                className={`border-y px-5 py-3 transition-all duration-500 ${deepFocus ? "pointer-events-none h-0 overflow-hidden border-transparent py-0 opacity-0" : "border-[var(--border)]/80 opacity-100"}`}
              >
                <div className="grid grid-cols-3 gap-2 rounded-full bg-[var(--bg-app)] p-1">
                  {[5, 10, 25].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      disabled={active}
                      onClick={() => setFocusDuration(minutes)}
                      className={`h-9 rounded-full text-sm font-semibold transition-all disabled:opacity-50 ${
                        duration === minutes
                          ? "bg-[var(--surface-strong)] text-[var(--earth)] shadow-sm"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {minutes}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 py-5">
                <button
                  onClick={active ? stopFocus : () => startFocus(duration)}
                  className="h-14 w-full rounded-full bg-[var(--sage)] text-base font-semibold text-[var(--on-sage)] shadow-sm active:translate-y-px soft-interaction"
                >
                  {active ? "Guardar sesión" : "Empezar"}
                </button>
                <div
                  className={`mt-3 grid gap-2 transition-all duration-500 ${deepFocus ? "grid-cols-1 opacity-100" : "grid-cols-2"}`}
                >
                  <button
                    onClick={completeCurrentTask}
                    disabled={!nextTask}
                    className="h-11 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)] disabled:opacity-40 soft-interaction"
                  >
                    Hecho
                  </button>
                  <button
                    onClick={() => onOpenWatering(focusNote.id)}
                    disabled={active}
                    className="h-11 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--text-muted)] disabled:hidden disabled:opacity-45 soft-interaction"
                  >
                    Regar
                  </button>
                </div>
              </div>
            </section>

            <section
              className={`order-2 mt-4 overflow-hidden rounded-[1.65rem] border border-[var(--border)] bg-[var(--surface-strong)]/78 shadow-sm backdrop-blur-xl md:mt-0 md:rounded-[2.2rem] md:bg-[var(--surface-strong)]/84 md:shadow-[0_24px_80px_rgba(22,31,25,0.10)] ${deepFocus ? "hidden" : ""}`}
            >
              <div className="border-b border-[var(--border)] px-4 py-4 md:px-6 md:py-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {gardenName("task", appLanguage)}
                </p>
                <h3 className="mt-1 line-clamp-2 text-2xl font-semibold tracking-tight text-[var(--earth)] md:text-3xl">
                  {focusNote.title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                  {nextTask
                    ? "Trabaja una acción a la vez. Marca lo que avance y deja lo demás fuera."
                    : "Agrega un primer paso pequeño para darle dirección a esta sesión."}
                </p>
              </div>
              <div className="px-4 py-3 md:px-5 md:py-4">
                {deepFocus && nextTask ? (
                  <div className="rounded-[1.45rem] border border-[var(--sage)]/25 bg-[var(--sage)]/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sage)]">
                      Ahora
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => onToggleTask(focusNote.id, nextTask.id)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)] transition-transform active:scale-90"
                        aria-label="Completar labor actual"
                      >
                        <CheckCircle2 size={17} />
                      </button>
                      <p className="min-w-0 flex-1 text-lg font-semibold leading-tight text-[var(--earth)]">
                        {nextTask.text}
                      </p>
                    </div>
                    {hiddenTaskCount + Math.max(0, visibleTasks.length - 1) >
                      0 && (
                      <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">
                        {hiddenTaskCount + Math.max(0, visibleTasks.length - 1)}{" "}
                        paso
                        {hiddenTaskCount +
                          Math.max(0, visibleTasks.length - 1) ===
                        1
                          ? ""
                          : "s"}{" "}
                        esperando.
                      </p>
                    )}
                  </div>
                ) : focusNote.tasks.length === 0 ? (
                  <p className="py-2 text-sm font-medium text-[var(--text-muted)]">
                    Agrega un paso para que enfoque tenga dirección.
                  </p>
                ) : (
                  visibleTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 border-b border-[var(--border)] py-2.5 last:border-b-0 md:py-3.5 ${task.completed ? "opacity-50" : ""}`}
                    >
                      <button
                        onClick={() => onToggleTask(focusNote.id, task.id)}
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-transform active:scale-90 ${task.completed ? "border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)]" : "border-[var(--border)] text-transparent"}`}
                        aria-label={
                          task.completed
                            ? "Marcar labor pendiente"
                            : "Completar labor"
                        }
                      >
                        <CheckCircle2 size={15} />
                      </button>
                      <input
                        value={task.text}
                        onChange={(event) =>
                          onUpdateTask(
                            focusNote.id,
                            task.id,
                            event.target.value,
                          )
                        }
                        readOnly={active}
                        className={`min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[var(--earth)] outline-none read-only:cursor-default md:text-base ${task.completed ? "line-through" : ""}`}
                        placeholder="Describe esta labor"
                      />
                      <button
                        type="button"
                        onClick={() => onDeleteTask(focusNote.id, task.id)}
                        disabled={active}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tone-danger-bg)] hover:text-[var(--tone-danger)] disabled:pointer-events-none disabled:opacity-0"
                        aria-label="Eliminar labor"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
                {hiddenTaskCount > 0 && (
                  <p className="pt-2 text-center text-xs font-semibold text-[var(--text-muted)]">
                    +{hiddenTaskCount} pasos más
                  </p>
                )}
                <div
                  className={`mt-3 flex gap-2 transition-all duration-500 md:mt-4 ${deepFocus ? "pointer-events-none h-0 overflow-hidden opacity-0" : "opacity-100"}`}
                >
                  <input
                    value={step}
                    onChange={(event) => setStep(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addFocusStep();
                      }
                    }}
                    placeholder="Nueva labor"
                    className="h-11 min-w-0 flex-1 rounded-full bg-[var(--bg-app)] px-4 text-sm font-medium text-[var(--earth)] outline-none"
                  />
                  <button
                    onClick={addFocusStep}
                    disabled={!step.trim()}
                    className="h-11 rounded-full bg-[var(--earth)] px-4 text-sm font-semibold text-white disabled:opacity-45"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </section>

            {!active && (
              <details className="mt-3 overflow-hidden rounded-[1.45rem] border border-[var(--border)] bg-[var(--surface-strong)]/60 backdrop-blur-xl md:col-start-2">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--text-muted)]">
                  Cambiar idea
                  <ChevronDown size={16} />
                </summary>
                <div className="border-t border-[var(--border)] px-4 py-3">
                  <AppSelect
                    value={focusNote.id}
                    onChange={onPickFocus}
                    ariaLabel="Elegir idea para enfoque"
                    options={focusOptions}
                  />
                </div>
              </details>
            )}

            <AnimatePresence>
              {finished && sessionSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mt-3 rounded-[1.45rem] border border-[var(--border)] bg-[var(--surface-strong)]/78 p-4 shadow-sm backdrop-blur-xl md:col-start-2"
                >
                  <p className="text-sm font-semibold text-[var(--earth)]">
                    Sesión guardada
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                    {sessionSummary.minutes} min · {sessionSummary.steps} pasos
                    · {sessionSummary.growth}% de avance
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <main
            className={`hidden flex-1 py-8 md:grid md:items-stretch ${deepFocus ? "md:grid-cols-1" : "md:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.74fr)] md:gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(24rem,0.72fr)] lg:gap-7"}`}
          >
            <section
              className={`relative min-h-[38rem] overflow-hidden rounded-[2.8rem] border p-6 ring-1 ring-black/[0.03] backdrop-blur-2xl transition-all duration-700 lg:p-8 ${deepFocus ? "border-white/12 bg-[linear-gradient(145deg,#101d16_0%,#0a1510_54%,#050b08_100%)] shadow-[0_40px_130px_rgba(0,0,0,0.42)]" : "border-white/55 bg-[linear-gradient(145deg,var(--surface-strong)_0%,var(--surface-soft)_52%,var(--bg-app)_100%)] shadow-[0_32px_110px_rgba(18,31,23,0.16)]"}`}
            >
              <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[var(--sage)]/12 blur-3xl" />
              <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-[var(--seed-accent)]/10 blur-3xl" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-app)]/72 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] shadow-sm backdrop-blur-xl">
                      <Target size={13} className="text-[var(--sage)]" />
                      {gardenName("focus", appLanguage)}
                    </div>
                    <h2
                      className={`mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-tight transition-colors lg:text-5xl ${deepFocus ? "text-white" : "text-[var(--earth)]"}`}
                    >
                      {nextTask?.text || "Elige un paso pequeño y empieza."}
                    </h2>
                    <p
                      className={`mt-3 max-w-xl text-sm font-medium leading-relaxed transition-colors ${deepFocus ? "text-white/55" : "text-[var(--text-muted)]"}`}
                    >
                      {focusNote.title}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-[1.6rem] border px-4 py-3 text-right shadow-sm backdrop-blur-xl transition-colors ${deepFocus ? "border-white/12 bg-white/[0.06]" : "border-[var(--border)] bg-[var(--surface-strong)]/78"}`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Avance
                    </p>
                    <p
                      className={`mt-1 font-serif text-3xl font-black transition-colors ${deepFocus ? "text-white" : "text-[var(--earth)]"}`}
                    >
                      {progress}%
                    </p>
                  </div>
                </div>

                <div
                  className={`relative mt-7 flex min-h-[24rem] flex-1 items-end justify-center overflow-hidden rounded-[2.35rem] border shadow-inner transition-all duration-700 ${deepFocus ? "border-white/12 bg-[radial-gradient(circle_at_50%_38%,rgba(156,195,126,0.26),transparent_34%),linear-gradient(180deg,#07100c_0%,#102018_54%,#172719_100%)]" : `border-white/60 ${isDay ? "bg-[linear-gradient(180deg,#eaf6ee_0%,#f8fbf5_54%,#ffffff_100%)]" : "bg-[linear-gradient(180deg,#0d1b14_0%,#172a1d_54%,#eef7ec_100%)]"}`}`}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.58),transparent_68%)]" />
                  <div className="pointer-events-none absolute left-10 top-10 h-28 w-28 rounded-full bg-white/32 blur-3xl" />
                  <div className="pointer-events-none absolute bottom-[-7rem] h-56 w-[36rem] rounded-[50%] bg-[var(--sage)]/16 blur-2xl" />
                  <div
                    className={`pointer-events-none absolute inset-x-16 top-16 h-36 rounded-full bg-[var(--sage)]/10 blur-3xl transition-opacity duration-700 ${deepFocus ? "opacity-100" : "opacity-30"}`}
                  />
                  <div
                    className={`pointer-events-none absolute bottom-10 left-16 h-24 w-64 rounded-full bg-[#c9e5b8]/8 blur-2xl transition-opacity duration-700 ${deepFocus ? "opacity-90" : "opacity-20"}`}
                  />
                  <div
                    className={`pointer-events-none absolute -left-24 top-10 h-32 w-[42rem] rotate-[-14deg] bg-white/[0.07] blur-2xl transition-opacity duration-700 ${deepFocus ? "opacity-100" : "opacity-0"}`}
                  />
                  <div
                    className={`absolute left-6 top-6 rounded-[1.7rem] border px-5 py-4 shadow-[0_18px_70px_rgba(31,45,35,0.12)] backdrop-blur-2xl transition-all duration-500 ${deepFocus ? "pointer-events-none translate-y-[-0.35rem] border-white/12 bg-black/24 text-white opacity-0" : "border-white/70 bg-white/58 text-[var(--earth)] opacity-100"}`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Tiempo
                    </p>
                    <p className="mt-1 font-mono text-6xl font-semibold leading-none tabular-nums">
                      {formattedTime}
                    </p>
                  </div>
                  <div
                    className={`absolute right-6 top-6 flex gap-2 transition-all duration-500 ${deepFocus ? "pointer-events-none translate-y-[-0.35rem] opacity-0" : "opacity-100"}`}
                  >
                    {[5, 10, 25].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        disabled={active}
                        onClick={() => setFocusDuration(minutes)}
                        className={`h-10 rounded-full px-4 text-sm font-semibold shadow-sm backdrop-blur-xl transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                          duration === minutes
                            ? "bg-[var(--earth)] text-white"
                            : "bg-white/62 text-[var(--text-muted)] hover:bg-white/82"
                        }`}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>
                  <motion.div
                    className={`pointer-events-none absolute bottom-12 h-52 w-52 rounded-full border transition-opacity duration-700 ${deepFocus ? "border-[var(--sage)]/32 opacity-100" : "border-white/38 opacity-60"}`}
                    animate={
                      deepFocus
                        ? { scale: [1, 1.18, 1], opacity: [0.8, 0.32, 0.8] }
                        : { scale: 1, opacity: 0.55 }
                    }
                    transition={{
                      duration: 3.8,
                      repeat: deepFocus ? Infinity : 0,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.div
                    className={`pointer-events-none absolute bottom-6 h-72 w-72 rounded-full border transition-opacity duration-700 ${deepFocus ? "border-white/16 opacity-100" : "border-white/22 opacity-45"}`}
                    animate={
                      deepFocus
                        ? { scale: [1, 1.08, 1], opacity: [0.55, 0.2, 0.55] }
                        : { scale: 1, opacity: 0.35 }
                    }
                    transition={{
                      duration: 5.2,
                      repeat: deepFocus ? Infinity : 0,
                      ease: "easeInOut",
                    }}
                  />
                  <AnimatePresence>
                    {deepFocus && (
                      <motion.div
                        key="seed-flip-clock"
                        initial={{ opacity: 0, y: 18, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.98 }}
                        transition={{
                          type: "spring",
                          stiffness: 240,
                          damping: 28,
                        }}
                        className="absolute left-1/2 top-[30%] z-30 -translate-x-1/2"
                      >
                        <div className="mb-5 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--sage)]/80">
                            Cultivo profundo
                          </p>
                          <p className="mt-1 text-xs font-semibold text-white/42">
                            respira, una acción a la vez
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-5">
                          {[
                            {
                              id: "minutes",
                              value: focusMinuteLabel,
                              label: "minutos",
                            },
                            {
                              id: "seconds",
                              value: focusSecondLabel,
                              label: "segundos",
                            },
                          ].map((part, index) => (
                            <div key={part.id} className="group relative">
                              <div className="absolute inset-0 translate-y-4 rounded-[2.4rem] bg-[#03100a]/55 blur-3xl" />
                              <div className="relative grid h-34 w-46 place-items-center overflow-hidden rounded-[2.1rem] border border-[#b8d7a4]/18 bg-[radial-gradient(circle_at_50%_0%,rgba(196,224,172,0.16),transparent_42%),linear-gradient(180deg,rgba(30,45,34,0.88)_0%,rgba(15,28,20,0.92)_100%)] shadow-[inset_0_1px_0_rgba(232,255,218,0.10),0_26px_86px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
                                <div
                                  className="pointer-events-none absolute inset-0 opacity-[0.13]"
                                  style={{
                                    backgroundImage:
                                      "radial-gradient(circle at 22% 18%, rgba(255,255,255,0.7) 0 1px, transparent 1.5px), radial-gradient(circle at 75% 64%, rgba(255,255,255,0.45) 0 1px, transparent 1.5px)",
                                    backgroundSize:
                                      "2.2rem 2.2rem, 2.8rem 2.8rem",
                                  }}
                                />
                                <div className="absolute inset-x-7 top-1/2 h-px bg-gradient-to-r from-transparent via-[#b8d7a4]/20 to-transparent" />
                                <div className="absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />
                                <AnimatePresence mode="popLayout">
                                  <motion.span
                                    key={`${part.id}-${part.value}`}
                                    initial={{
                                      y: -16,
                                      rotateX: -58,
                                      opacity: 0,
                                    }}
                                    animate={{ y: 0, rotateX: 0, opacity: 1 }}
                                    exit={{ y: 16, rotateX: 58, opacity: 0 }}
                                    transition={{
                                      duration: 0.38,
                                      ease: "easeOut",
                                    }}
                                    className="font-mono text-[5.65rem] font-semibold leading-none tracking-normal text-[#f7fff1] drop-shadow-[0_8px_20px_rgba(0,0,0,0.24)] tabular-nums"
                                    style={{ perspective: 800 }}
                                  >
                                    {part.value}
                                  </motion.span>
                                </AnimatePresence>
                                <span className="absolute bottom-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#c9e5b8]/48">
                                  {part.label}
                                </span>
                              </div>
                              {index === 0 && (
                                <div className="absolute -right-7 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[#b8d7a4]/18 bg-[#0f1e15]/80 text-[var(--sage)] shadow-[0_0_26px_rgba(158,195,126,0.28)] backdrop-blur-xl">
                                  <Leaf size={15} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.div
                    key={`desktop-${focusNote.id}-${completedSteps}`}
                    initial={{ scale: 0.92, y: 14, opacity: 0.88 }}
                    animate={{
                      scale: active ? [1.06, 1.12, 1.06] : 1.18,
                      y: active ? [0, -5, 0] : 0,
                      opacity: 1,
                    }}
                    transition={{
                      duration: 3.2,
                      repeat: active ? Infinity : 0,
                      ease: "easeInOut",
                    }}
                    className={`relative z-10 origin-bottom transition-all duration-700 ${deepFocus ? "mb-4 translate-y-8 opacity-90" : "mb-10"}`}
                  >
                    <PlantIllustration
                      stage={focusNote.growthStage}
                      progress={focusGrowthProgress}
                      isGrowth={focusNote.isGrowth || active}
                      theme={theme}
                    />
                  </motion.div>
                  <AnimatePresence>
                    {active && sessionCompletedSteps > 0 && (
                      <motion.div
                        key={`desktop-session-${sessionCompletedSteps}`}
                        initial={{ opacity: 0, y: 10, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.94 }}
                        className="absolute bottom-6 right-6 rounded-full border border-white/70 bg-white/76 px-4 py-2 text-sm font-black text-[var(--sage)] shadow-sm backdrop-blur-xl"
                      >
                        +{sessionCompletedSteps} cultivo
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {deepFocus && nextTask && (
                      <motion.div
                        key="deep-focus-step-card"
                        initial={{ opacity: 0, y: 18, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.98 }}
                        transition={{
                          type: "spring",
                          stiffness: 260,
                          damping: 28,
                        }}
                        className="absolute left-6 top-6 max-w-[24rem] rounded-[1.8rem] border border-white/14 bg-black/26 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--sage)]">
                          Ahora
                        </p>
                        <p className="mt-2 line-clamp-2 text-lg font-semibold leading-tight">
                          {nextTask.text}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div
                  className={`transition-all duration-700 ${deepFocus ? "pointer-events-none mt-0 h-0 overflow-hidden opacity-0" : "mt-5 grid grid-cols-3 gap-3 opacity-100"}`}
                >
                  {[
                    {
                      label: gardenName("task", appLanguage),
                      value: `${completedSteps}/${focusNote.tasks.length}`,
                    },
                    { label: "Bloque", value: `${duration}m` },
                    {
                      label: "Riego",
                      value: wateringDue(focusNote) ? "Pendiente" : "Listo",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-[1.35rem] border px-4 py-3 shadow-sm backdrop-blur-xl transition-colors ${deepFocus ? "border-white/10 bg-white/[0.05]" : "border-[var(--border)] bg-[var(--surface-strong)]/72"}`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        {item.label}
                      </p>
                      <p
                        className={`mt-1 truncate text-lg font-semibold transition-colors ${deepFocus ? "text-white" : "text-[var(--earth)]"}`}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside
              className={
                deepFocus
                  ? "hidden"
                  : "grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3"
              }
            >
              <section
                className={`overflow-hidden rounded-[2rem] border p-4 shadow-[0_24px_80px_rgba(18,31,23,0.10)] backdrop-blur-2xl transition-all duration-700 ${deepFocus ? "border-[var(--sage)]/24 bg-[var(--sage)]/10 shadow-[0_28px_90px_rgba(0,0,0,0.24)]" : "border-[var(--border)] bg-[var(--surface-strong)]/84"}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] shadow-sm">
                    <Leaf size={18} />
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.18em] ${deepFocus ? "text-[#c9e5b8]/68" : "text-[var(--text-muted)]"}`}
                    >
                      Acción actual
                    </p>
                    <p
                      className={`mt-1 line-clamp-2 text-lg font-semibold leading-tight transition-colors ${deepFocus ? "text-white" : "text-[var(--earth)]"}`}
                    >
                      {nextTask?.text || "Define el primer movimiento."}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-app)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--sage)]"
                    animate={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    onClick={active ? stopFocus : () => startFocus(duration)}
                    className="h-12 rounded-full bg-[var(--sage)] px-5 text-sm font-black text-[var(--on-sage)] shadow-sm soft-interaction"
                  >
                    {active ? "Guardar sesión" : "Entrar en foco"}
                  </button>
                  <button
                    onClick={completeCurrentTask}
                    disabled={!nextTask}
                    className="grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)] soft-interaction disabled:opacity-40"
                    aria-label="Completar labor actual"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              </section>

              <section
                className={`grid grid-cols-2 gap-3 transition-all duration-500 ${deepFocus ? "pointer-events-none h-0 overflow-hidden opacity-0" : "opacity-100"}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenWatering(focusNote.id)}
                  disabled={active}
                  className="flex h-14 items-center justify-center gap-2 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-strong)]/78 text-sm font-semibold text-[var(--text-muted)] shadow-sm backdrop-blur-xl soft-interaction disabled:opacity-45"
                >
                  <Droplets size={16} /> Regar
                </button>
                <button
                  type="button"
                  onClick={() => requestExit("edit")}
                  className="flex h-14 items-center justify-center gap-2 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-strong)]/78 text-sm font-semibold text-[var(--text-muted)] shadow-sm backdrop-blur-xl soft-interaction"
                >
                  <Settings size={16} /> Editar
                </button>
              </section>

              <section
                className={`min-h-0 overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_rgba(18,31,23,0.10)] backdrop-blur-2xl transition-all duration-700 ${deepFocus ? "border-white/12 bg-white/[0.055]" : "border-[var(--border)] bg-[var(--surface-strong)]/84"}`}
              >
                <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
                  <div>
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.2em] ${deepFocus ? "text-[#c9e5b8]/62" : "text-[var(--text-muted)]"}`}
                    >
                      Lista viva
                    </p>
                    <h3
                      className={`mt-0.5 text-2xl font-semibold tracking-tight transition-colors ${deepFocus ? "text-white" : "text-[var(--earth)]"}`}
                    >
                      {deepFocus
                        ? appLanguage === "en"
                          ? "Just this task"
                          : "Solo esta labor"
                        : gardenName("task", appLanguage)}
                    </h3>
                  </div>
                  <span className="rounded-full bg-[var(--bg-app)] px-3 py-1 text-xs font-black text-[var(--sage)] ring-1 ring-[var(--border)]">
                    {completedSteps}/{focusNote.tasks.length}
                  </span>
                </div>
                <div className="max-h-[26rem] min-h-0 overflow-y-auto px-3 py-2 app-scrollbar">
                  {deepFocus && nextTask ? (
                    <div className="rounded-[1.55rem] border border-[var(--sage)]/24 bg-[var(--sage)]/10 px-4 py-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--sage)]">
                        Ahora
                      </p>
                      <div className="mt-4 flex items-start gap-3">
                        <button
                          onClick={() =>
                            onToggleTask(focusNote.id, nextTask.id)
                          }
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)] shadow-sm transition-transform active:scale-90"
                          aria-label="Completar labor actual"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-xl font-semibold leading-tight text-white">
                            {nextTask.text}
                          </p>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-white/54">
                            Completa esto. Lo demás puede esperar.
                          </p>
                        </div>
                      </div>
                      <label className="mt-5 block rounded-[1.35rem] border border-white/10 bg-black/18 p-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9e5b8]/62">
                          Nota de enfoque
                        </span>
                        <textarea
                          value={focusNoteMemo}
                          onChange={(event) =>
                            onUpdateFocusMemo(focusNote.id, event.target.value)
                          }
                          rows={4}
                          placeholder="Guarda una idea rápida sin salir del foco..."
                          className="mt-2 min-h-28 w-full resize-none bg-transparent text-sm font-medium leading-relaxed text-white outline-none placeholder:text-white/32"
                        />
                      </label>
                    </div>
                  ) : focusNote.tasks.length === 0 ? (
                    <div className="rounded-[1.45rem] border border-dashed border-[var(--border)] bg-[var(--bg-app)]/72 px-4 py-6 text-center">
                      <ListChecks
                        className="mx-auto text-[var(--sage)]/60"
                        size={28}
                      />
                      <p className="mt-3 text-sm font-semibold text-[var(--earth)]">
                        Todavía no hay labores
                      </p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                        Escribe uno pequeño para empezar.
                      </p>
                    </div>
                  ) : (
                    focusNote.tasks.map((task, index) => (
                      <div
                        key={task.id}
                        className={`group flex items-center gap-3 rounded-[1.25rem] px-3 py-3 transition-colors hover:bg-[var(--bg-app)]/72 ${task.completed ? "opacity-55" : ""}`}
                      >
                        <button
                          onClick={() => onToggleTask(focusNote.id, task.id)}
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-transform active:scale-90 ${task.completed ? "border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)]" : "border-[var(--border)] bg-[var(--surface-strong)] text-transparent"}`}
                          aria-label={
                            task.completed
                              ? "Marcar labor pendiente"
                              : "Completar labor"
                          }
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <span className="w-5 shrink-0 text-right text-xs font-black text-[var(--text-muted)]">
                          {index + 1}
                        </span>
                        <input
                          value={task.text}
                          onChange={(event) =>
                            onUpdateTask(
                              focusNote.id,
                              task.id,
                              event.target.value,
                            )
                          }
                          readOnly={active}
                          className={`min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--earth)] outline-none read-only:cursor-default ${task.completed ? "line-through" : ""}`}
                          placeholder="Describe esta labor"
                        />
                        <button
                          type="button"
                          onClick={() => onDeleteTask(focusNote.id, task.id)}
                          disabled={active}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] opacity-0 transition-all hover:bg-[var(--tone-danger-bg)] hover:text-[var(--tone-danger)] group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                          aria-label="Eliminar labor"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section
                className={`space-y-3 transition-all duration-500 ${deepFocus ? "pointer-events-none h-0 overflow-hidden opacity-0" : "opacity-100"}`}
              >
                <div className="flex gap-2 rounded-[1.65rem] border border-[var(--border)] bg-[var(--surface-strong)]/84 p-2 shadow-sm backdrop-blur-2xl">
                  <input
                    value={step}
                    onChange={(event) => setStep(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addFocusStep();
                      }
                    }}
                    placeholder="Nueva labor del brote"
                    className="h-12 min-w-0 flex-1 rounded-[1.2rem] bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--earth)] outline-none"
                  />
                  <button
                    onClick={addFocusStep}
                    disabled={!step.trim()}
                    className="h-12 rounded-[1.2rem] bg-[var(--earth)] px-5 text-sm font-black text-white shadow-sm disabled:opacity-45"
                  >
                    Añadir
                  </button>
                </div>

                {!active && (
                  <details className="overflow-hidden rounded-[1.65rem] border border-[var(--border)] bg-[var(--surface-strong)]/70 backdrop-blur-xl">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--text-muted)]">
                      Cambiar idea
                      <ChevronDown size={16} />
                    </summary>
                    <div className="border-t border-[var(--border)] px-4 py-3">
                      <AppSelect
                        value={focusNote.id}
                        onChange={onPickFocus}
                        ariaLabel="Elegir idea para enfoque"
                        options={focusOptions}
                      />
                    </div>
                  </details>
                )}

                <AnimatePresence>
                  {finished && sessionSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="rounded-[1.65rem] border border-[var(--border)] bg-[var(--surface-strong)]/78 p-4 shadow-sm backdrop-blur-xl"
                    >
                      <p className="text-sm font-semibold text-[var(--earth)]">
                        Sesión guardada
                      </p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                        {sessionSummary.minutes} min · {sessionSummary.steps}{" "}
                        pasos · {sessionSummary.growth}% de avance
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </aside>
          </main>
        </div>
      </div>

      <FocusNotesTray
        language={appLanguage}
        projectName={focusNote.title}
        projectMemo={focusNoteMemo}
        onProjectMemoChange={(value) =>
          onUpdateFocusMemo(focusNote.id, value)
        }
        onQuickCapture={onQuickCapture}
      />

      <AnimatePresence>
        {confirmExit && (
          <motion.div
            className="mobile-modal-overlay fixed inset-0 z-50 grid place-items-center bg-black/18 px-5 md:backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Cerrar enfoque"
              className="w-full max-w-[21rem] rounded-[1.75rem] border border-white/60 bg-[var(--surface-strong)] p-5 text-center shadow-[0_24px_80px_rgba(20,30,24,0.24)]"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
            >
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)]">
                <Target size={20} />
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-[var(--earth)]">
                Cerrar enfoque
              </h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                Seeds guardará los minutos trabajados. Puedes seguir con el
                mismo paso si todavía no quieres salir.
              </p>
              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmExit(null)}
                  className="h-12 rounded-full bg-[var(--sage)] text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                >
                  Seguir enfocando
                </button>
                <button
                  type="button"
                  onClick={confirmFocusExit}
                  className="h-12 rounded-full bg-[var(--bg-app)] text-sm font-semibold text-[var(--text-muted)] soft-interaction"
                >
                  Salir y guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
