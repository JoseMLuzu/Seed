/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from "react";
import { motion } from "motion/react";
import { Archive, Droplets, Sprout } from "lucide-react";
import type { SeedNote } from "../../types";
import { appLanguage, t } from "../../app/i18n";
import { formatShortDate } from "../../app/dates";
import { daysSince, wateringDue } from "../../seedLogic";
import { NoteCareStatus } from "../../NoteCareStatus";
import { useProgressiveList } from "../../hooks/useProgressiveList";
import { EmptyStatePanel } from "../../components/ui/EmptyStatePanel";
import { ProgressiveListMoreButton } from "../../components/ui/ProgressiveListMoreButton";
import { GestureNoteSurface } from "../../components/notes/GestureNoteSurface";
import {
  IDEA_ACTION_PILL,
  IDEA_CARD_ROW,
  IDEA_CARD_SURFACE,
  IDEA_CARD_WRAPPER,
  IDEA_ICON_TILE,
} from "../notes/noteCardStyles";

export function ProjectsView({
  notes,
  onSelectNote,
  onFocusNote,
  onToggleTask,
  onOpenWatering,
  onTogglePause,
  onShowActions,
  onStartSprout,
  getProgress,
}: {
  notes: SeedNote[];
  onSelectNote: (id: string) => void;
  onFocusNote: (id: string) => void;
  onToggleTask: (noteId: string, taskId: string) => void;
  onOpenWatering: (id: string) => void;
  onTogglePause: (id: string) => void;
  onShowActions: (id: string) => void;
  onStartSprout: () => void;
  getProgress: (note: SeedNote) => number;
}) {
  const sortedProjects = useMemo(() => {
    return notes
      .filter(
        (note) => !note.inbox && note.isGrowth && note.growthStage !== "bloom",
      )
      .sort((a, b) => {
        const aScore =
          (wateringDue(a) ? 10 : 0) + daysSince(a.lastWateredAt || a.createdAt);
        const bScore =
          (wateringDue(b) ? 10 : 0) + daysSince(b.lastWateredAt || b.createdAt);
        return bScore - aScore;
      });
  }, [notes]);
  const projectList = useProgressiveList(
    sortedProjects,
    `${sortedProjects.length}-${sortedProjects[0]?.id || "empty"}`,
  );
  const recommended =
    sortedProjects.find((note) => note.tasks.some((task) => !task.completed)) ||
    sortedProjects[0];
  const recommendedTask = recommended?.tasks.find((task) => !task.completed);

  return (
    <motion.div
      key="projects-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="space-y-5 pb-2 md:pb-8"
    >
      <section>
        <h3 className="text-3xl font-semibold tracking-tight text-[var(--earth)]">
          {t("sprouts")}
        </h3>
        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
          {appLanguage === "en"
            ? `${sortedProjects.length} active project${sortedProjects.length === 1 ? "" : "s"}`
            : `${sortedProjects.length} proyecto${sortedProjects.length === 1 ? "" : "s"} activo${sortedProjects.length === 1 ? "" : "s"}`}
        </p>
      </section>

      {recommended && (
        <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Siguiente
              </p>
              <h4 className="mt-1 truncate text-xl font-semibold tracking-tight text-[var(--earth)]">
                {recommended.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                {recommendedTask?.text ||
                  "Agrega el siguiente paso para poder enfocarte."}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-app)]">
                <motion.div
                  className="h-full bg-[var(--sage)]"
                  animate={{ width: `${getProgress(recommended)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:w-56">
              <button
                onClick={() => onFocusNote(recommended.id)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--sage)] px-4 text-sm font-semibold leading-none text-[var(--on-sage)] shadow-sm active:translate-y-px soft-interaction"
              >
                {appLanguage === "en" ? "Cultivate" : "Cultivar"}
              </button>
              <button
                onClick={() =>
                  recommendedTask
                    ? onToggleTask(recommended.id, recommendedTask.id)
                    : onSelectNote(recommended.id)
                }
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold leading-none text-[var(--sage)] active:translate-y-px soft-interaction"
              >
                {recommendedTask
                  ? appLanguage === "en"
                    ? "Task done"
                    : "Labor hecha"
                  : appLanguage === "en"
                    ? "Edit"
                    : "Editar"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {sortedProjects.length === 0 ? (
          <EmptyStatePanel
            icon={Sprout}
            eyebrow={
              appLanguage === "en" ? "No active sprouts" : "Sin brotes activos"
            }
            title={
              appLanguage === "en"
                ? "Nothing needs steps yet"
                : "Nada necesita pasos todavía"
            }
            detail={
              appLanguage === "en"
                ? "When an idea is worth moving, turn it into a sprout with one five-minute next step."
                : "Cuando una idea valga la pena, conviértela en brote con un solo siguiente paso de 5 minutos."
            }
            actionLabel={appLanguage === "en" ? "Create sprout" : "Crear brote"}
            onAction={onStartSprout}
          />
        ) : (
          projectList.visibleItems.map((note) => {
            const nextTask = note.tasks.find((task) => !task.completed);
            const progress = getProgress(note);
            const needsWater = wateringDue(note) && !note.paused;

            return (
              <GestureNoteSurface
                key={note.id}
                onPress={() => onSelectNote(note.id)}
                onSwipeRight={() => onOpenWatering(note.id)}
                onSwipeLeft={() => onTogglePause(note.id)}
                onLongPress={() => onShowActions(note.id)}
                rightLabel="Regar"
                leftLabel="Cobertizo"
                leftIcon={Archive}
                wrapperClassName={IDEA_CARD_WRAPPER}
                className={IDEA_CARD_SURFACE}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectNote(note.id);
                  }}
                  className={IDEA_CARD_ROW}
                >
                  <span
                    className={`${IDEA_ICON_TILE} ${needsWater ? "bg-[var(--tone-water-bg)] text-[var(--tone-water)] ring-[var(--tone-water-border)]" : "bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)] ring-[var(--tone-sprout-border)]"}`}
                  >
                    {needsWater ? <Droplets size={17} /> : <Sprout size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">
                      {note.title}
                    </span>
                    <span className="mt-0.5 block line-clamp-1 text-sm font-medium text-[var(--text-muted)]">
                      {nextTask?.text || "Sin labores pendientes"}
                    </span>
                    <span className="mt-1 block text-[11px] font-medium text-[var(--text-muted)]">
                      {appLanguage === "en" ? "Created" : "Creada"}{" "}
                      {formatShortDate(note.createdAt)}
                    </span>
                  </span>
                  <NoteCareStatus
                    note={note}
                    language={appLanguage === "en" ? "en" : "es"}
                    compact
                  />
                  <span className="shrink-0 rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-xs font-semibold text-[var(--sage)]">
                    {progress}%
                  </span>
                </button>
                <div className="mx-4 h-1 overflow-hidden rounded-full bg-[var(--bg-app)]">
                  <div
                    className="h-full bg-[var(--sage)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-3">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onFocusNote(note.id);
                    }}
                    className={`${IDEA_ACTION_PILL} bg-[var(--sage)] text-[var(--on-sage)]`}
                  >
                    {appLanguage === "en" ? "Cultivate" : "Cultivar"}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      nextTask
                        ? onToggleTask(note.id, nextTask.id)
                        : onSelectNote(note.id);
                    }}
                    className={`${IDEA_ACTION_PILL} bg-[var(--bg-app)] text-[var(--sage)]`}
                  >
                    {nextTask
                      ? appLanguage === "en"
                        ? "Task done"
                        : "Labor hecha"
                      : appLanguage === "en"
                        ? "Edit"
                        : "Editar"}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      needsWater
                        ? onOpenWatering(note.id)
                        : onSelectNote(note.id);
                    }}
                    className={`${IDEA_ACTION_PILL} ${needsWater ? "bg-[var(--tone-water-bg)] text-[var(--tone-water)] ring-1 ring-[var(--tone-water-border)]" : "bg-[var(--bg-app)] text-[var(--text-muted)]"}`}
                  >
                    {needsWater ? "Regar" : "Ver"}
                  </button>
                </div>
              </GestureNoteSurface>
            );
          })
        )}
        {projectList.hasMore && (
          <ProgressiveListMoreButton
            remaining={projectList.remaining}
            onClick={projectList.showMore}
          />
        )}
      </section>
    </motion.div>
  );
}
