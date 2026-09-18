/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from "react";
import { motion } from "motion/react";
import { Archive } from "lucide-react";
import type { SeedNote } from "../../types";
import { appLanguage } from "../../app/i18n";
import { formatShortDate } from "../../app/dates";
import { gardenName } from "../../gardenVocabulary";
import { EmptyStatePanel } from "../../components/ui/EmptyStatePanel";
import { STAGE_META } from "../notes/stageMeta";

export function HarvestView({
  notes,
  onSelectNote,
  onStartPlanting,
}: {
  notes: SeedNote[];
  onSelectNote: (id: string) => void;
  onStartPlanting: () => void;
}) {
  const harvestData = useMemo(() => {
    const harvests = notes
      .filter((note) => note.growthStage === "bloom")
      .sort(
        (a, b) =>
          (b.harvestedAt || b.createdAt) - (a.harvestedAt || a.createdAt),
      );
    const totalMinutes = harvests.reduce(
      (sum, note) => sum + (note.focusedMinutes || 0),
      0,
    );
    const learningCount = harvests.filter(
      (note) => note.reflection?.trim() || note.takeaway?.trim(),
    ).length;
    const featuredLearning =
      harvests.find(
        (note) => note.reflection?.trim() || note.takeaway?.trim(),
      ) || harvests[0];
    const remainingHarvests = featuredLearning
      ? harvests.filter((note) => note.id !== featuredLearning.id)
      : harvests;
    return {
      featuredLearning,
      harvests,
      learningCount,
      remainingHarvests,
      totalMinutes,
    };
  }, [notes]);
  const {
    featuredLearning,
    harvests,
    learningCount,
    remainingHarvests,
    totalMinutes,
  } = harvestData;

  return (
    <motion.div
      key="harvest-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="space-y-5 pb-2 md:pb-8"
    >
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-strong),var(--surface-soft))] p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">
              Archivo vivo
            </p>
            <h3 className="mt-1 text-3xl font-serif font-black text-[var(--earth)]">
              Lo aprendido
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[var(--text-muted)]">
              Cierres breves de ideas terminadas. No es diario: es memoria útil
              de lo que ya te dejó avanzar.
            </p>
          </div>
          <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] shadow-sm sm:grid">
            <Archive size={20} />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            {
              label: gardenName("harvest", appLanguage),
              value: harvests.length,
            },
            { label: "Aprendizajes", value: learningCount },
            { label: "Min", value: totalMinutes },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] px-3 py-3 text-center"
            >
              <p className="text-2xl font-serif font-black text-[var(--earth)]">
                {item.value}
              </p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {harvests.length === 0 ? (
        <EmptyStatePanel
          icon={Archive}
          eyebrow={appLanguage === "en" ? "Living archive" : "Archivo vivo"}
          title={
            appLanguage === "en" ? "No harvests yet" : "Todavía no hay cosechas"
          }
          detail={
            appLanguage === "en"
              ? "Complete a small step cycle and Seeds will save what changed, what you learned and what can grow next."
              : "Completa un ciclo pequeño y Seeds guardará qué cambió, qué aprendiste y qué podría crecer después."
          }
          actionLabel={
            appLanguage === "en" ? "Plant first idea" : "Plantar primera idea"
          }
          onAction={onStartPlanting}
        />
      ) : (
        <>
          {featuredLearning && (
            <button
              type="button"
              onClick={() => onSelectNote(featuredLearning.id)}
              className="w-full overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] text-left shadow-sm soft-interaction hover:shadow-md"
            >
              <div className="grid gap-0 lg:grid-cols-[1fr_14rem]">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--tone-harvest)]">
                      {featuredLearning.reflection?.trim() ||
                      featuredLearning.takeaway?.trim()
                        ? "Último aprendizaje"
                        : "Cosecha reciente"}
                    </p>
                    <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      {formatShortDate(
                        featuredLearning.harvestedAt ||
                          featuredLearning.createdAt,
                      )}
                    </span>
                  </div>
                  <h4 className="mt-3 font-serif text-3xl font-black leading-tight text-[var(--earth)]">
                    {featuredLearning.title}
                  </h4>
                  {featuredLearning.reflection?.trim() ? (
                    <p className="mt-4 text-xl font-semibold leading-snug text-[var(--earth)]">
                      “{featuredLearning.reflection}”
                    </p>
                  ) : (
                    <div className="mt-4 rounded-[1.35rem] border border-dashed border-[var(--border)] bg-[var(--bg-app)]/55 px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--earth)]">
                        Sin cierre todavía
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                        Puedes añadir lo aprendido cuando esta idea vuelva a
                        importarte.
                      </p>
                    </div>
                  )}
                  {featuredLearning.takeaway?.trim() && (
                    <p className="mt-3 rounded-[1.35rem] bg-[var(--bg-app)] px-4 py-3 text-sm font-semibold leading-relaxed text-[var(--sage)]">
                      Me dejó: {featuredLearning.takeaway}
                    </p>
                  )}
                </div>
                <div className="flex border-t border-[var(--border)] bg-[var(--bg-app)]/60 p-4 lg:border-l lg:border-t-0">
                  <div className="grid w-full grid-cols-3 gap-2 text-center lg:grid-cols-1">
                    <span className="rounded-2xl bg-[var(--surface-strong)] px-2 py-3 text-[10px] font-black text-[var(--sage)]">
                      {featuredLearning.tasks.length} pasos
                    </span>
                    <span className="rounded-2xl bg-[var(--surface-strong)] px-2 py-3 text-[10px] font-black text-[var(--sage)]">
                      {featuredLearning.focusedMinutes || 0} min
                    </span>
                    <span className="rounded-2xl bg-[var(--surface-strong)] px-2 py-3 text-[10px] font-black text-[var(--sage)]">
                      {STAGE_META[featuredLearning.growthStage].shortLabel}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )}

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {remainingHarvests.map((note) => {
              const hasLearning = Boolean(
                note.reflection?.trim() || note.takeaway?.trim(),
              );

              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelectNote(note.id)}
                  className="rounded-[1.65rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-left shadow-sm soft-interaction hover:bg-[var(--surface-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                        {hasLearning ? "Aprendizaje" : "Sin cierre"}
                      </p>
                      <h4 className="mt-1 truncate text-xl font-serif font-black text-[var(--earth)]">
                        {note.title}
                      </h4>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      {formatShortDate(note.harvestedAt || note.createdAt)}
                    </span>
                  </div>
                  {note.reflection?.trim() ? (
                    <p className="mt-3 line-clamp-3 text-sm font-semibold leading-relaxed text-[var(--earth)]">
                      “{note.reflection}”
                    </p>
                  ) : (
                    <p className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-app)]/55 px-3 py-2 text-sm font-semibold text-[var(--text-muted)]">
                      Sin cierre todavía
                    </p>
                  )}
                  {note.takeaway?.trim() && (
                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-[var(--sage)]">
                      Me dejó: {note.takeaway}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-black text-[var(--sage)]">
                      {note.tasks.length} pasos
                    </span>
                    <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-black text-[var(--sage)]">
                      {note.focusedMinutes || 0} min
                    </span>
                    <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-black text-[var(--text-muted)]">
                      {note.seedType || "idea"}
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
        </>
      )}
    </motion.div>
  );
}
