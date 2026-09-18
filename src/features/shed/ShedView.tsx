/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from "react";
import { motion } from "motion/react";
import { Archive, ChevronRight, Leaf, Sprout, Trash2 } from "lucide-react";
import type { SeedNote } from "../../types";
import { daysSince } from "../../seedLogic";
import { EmptyStatePanel } from "../../components/ui/EmptyStatePanel";
import { GestureNoteSurface } from "../../components/notes/GestureNoteSurface";
import { noteUpdatedAt } from "../notes/noteMetadata";
import { IDEA_CARD_SURFACE, IDEA_CARD_WRAPPER } from "../notes/noteCardStyles";

export function ShedView({
  notes,
  onSelectNote,
  onRestore,
  onSprout,
  onDelete,
}: {
  notes: SeedNote[];
  onSelectNote: (id: string) => void;
  onRestore: (id: string) => void;
  onSprout: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const shedNotes = useMemo(
    () =>
      notes
        .filter(
          (note) => !note.inbox && note.paused && note.growthStage !== "bloom",
        )
        .sort((a, b) => noteUpdatedAt(b) - noteUpdatedAt(a)),
    [notes],
  );

  return (
    <motion.div
      key="shed-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="space-y-5 pb-2 md:pb-8"
    >
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-strong),var(--surface-soft))] p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">
              Algún día
            </p>
            <h3 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--earth)]">
              Cobertizo
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[var(--text-muted)]">
              Ideas guardadas sin presión. No aparecen en Hoy ni piden riego
              hasta que decidas traerlas de vuelta.
            </p>
          </div>
          <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] shadow-sm sm:grid">
            <Archive size={20} />
          </span>
        </div>
      </section>

      {shedNotes.length === 0 ? (
        <EmptyStatePanel
          icon={Archive}
          eyebrow="Cobertizo limpio"
          title="No hay ideas descansando"
          detail="Cuando algo no sea para hoy pero tampoco quieras soltarlo, guárdalo aquí."
        />
      ) : (
        <section className="space-y-3">
          {shedNotes.map((note) => {
            const restingDays = Math.max(
              0,
              daysSince(note.lastWateredAt || note.updatedAt || note.createdAt),
            );
            return (
              <GestureNoteSurface
                key={note.id}
                onPress={() => onSelectNote(note.id)}
                onSwipeRight={() => onRestore(note.id)}
                onSwipeLeft={() => onDelete(note.id)}
                rightLabel="Volver"
                rightIcon={Leaf}
                rightTone="bg-[var(--sage)] text-[var(--on-sage)]"
                leftLabel="Soltar"
                leftIcon={Trash2}
                leftTone="bg-[var(--tone-danger)] text-white"
                wrapperClassName={IDEA_CARD_WRAPPER}
                className={`${IDEA_CARD_SURFACE} p-4`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[1.1rem] bg-[var(--bg-app)] text-[var(--sage)] shadow-sm ring-1 ring-[var(--border)]">
                    <Archive size={17} />
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectNote(note.id);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-base font-semibold leading-tight tracking-tight text-[var(--earth)]">
                      {note.title}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                      {note.content ||
                        "Guardada para volver cuando tenga sentido."}
                    </span>
                    <span className="mt-2 inline-flex h-7 items-center rounded-full bg-[var(--bg-app)] px-2.5 text-[11px] font-semibold leading-none text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                      {restingDays === 0
                        ? "Guardada hoy"
                        : `${restingDays} día${restingDays === 1 ? "" : "s"} descansando`}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5 max-sm:hidden">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSprout(note.id);
                      }}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[var(--bg-app)] px-3 text-xs font-semibold leading-none text-[var(--sage)] ring-1 ring-[var(--border)] soft-interaction"
                    >
                      <Sprout size={13} /> Darle paso
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRestore(note.id);
                      }}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[var(--sage)] px-3 text-xs font-semibold leading-none text-[var(--on-sage)] shadow-sm soft-interaction"
                    >
                      <Leaf size={13} /> Volver
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectNote(note.id);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--sage)]"
                      aria-label="Abrir idea"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </GestureNoteSurface>
            );
          })}
        </section>
      )}
    </motion.div>
  );
}
