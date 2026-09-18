/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from "react";
import { motion } from "motion/react";
import { Archive, CheckCircle2, Inbox, MoreHorizontal, Sprout } from "lucide-react";
import type { SeedNote } from "../../types";
import { appLanguage, t } from "../../app/i18n";
import { formatShortDate } from "../../app/dates";
import { gardenName } from "../../gardenVocabulary";
import { NoteCareStatus } from "../../NoteCareStatus";
import { useProgressiveList } from "../../hooks/useProgressiveList";
import { EmptyStatePanel } from "../../components/ui/EmptyStatePanel";
import { ProgressiveListMoreButton } from "../../components/ui/ProgressiveListMoreButton";
import { GestureNoteSurface } from "../../components/notes/GestureNoteSurface";
import { IDEA_CARD_RADIUS } from "./noteCardStyles";

export function InboxView({
  notes,
  quickNote,
  setQuickNote,
  onQuickCapture,
  onCultivate,
  onComplete,
  onSaveLater,
  onDelete,
  onSelectNote,
  onShowActions,
  recentlyCreatedNoteId,
  onStartPlanting,
}: {
  notes: SeedNote[];
  quickNote: string;
  setQuickNote: (value: string) => void;
  onQuickCapture: () => void;
  onCultivate: (id: string) => void;
  onComplete: (id: string) => void;
  onSaveLater: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectNote: (id: string) => void;
  onShowActions: (id: string) => void;
  recentlyCreatedNoteId: string | null;
  onStartPlanting: () => void;
}) {
  const inboxNotes = useMemo(() => notes.filter((note) => note.inbox), [notes]);
  const inboxList = useProgressiveList(
    inboxNotes,
    `${inboxNotes.length}-${inboxNotes[0]?.id || "empty"}`,
  );

  return (
    <motion.div
      key="inbox-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="pb-2 md:pb-8"
    >
      <div className="mb-5">
        <h3 className="text-3xl font-semibold tracking-tight text-[var(--earth)]">
          {t("seeds")}
        </h3>
        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
          {inboxNotes.length} {t("pendingSeeds")}
        </p>
      </div>

      <div
        className={
          inboxNotes.length === 0
            ? ""
            : "grid gap-3 xl:grid-cols-2 xl:items-start"
        }
      >
        {inboxNotes.length === 0 ? (
          <EmptyStatePanel
            icon={Inbox}
            eyebrow={
              appLanguage === "en" ? "Seedbed clear" : "Semillero limpio"
            }
            title={t("noPendingSeeds")}
            detail={
              appLanguage === "en"
                ? "Capture ideas without organizing them. They will wait here until you decide what deserves a next step."
                : "Captura ideas sin ordenarlas. Van a esperar aquí hasta que decidas cuál merece un siguiente paso."
            }
            actionLabel={gardenName("plant", appLanguage)}
            onAction={onStartPlanting}
          />
        ) : (
          inboxList.visibleItems.map((note) => {
            const hasUsefulDescription =
              note.content.trim().toLowerCase() !==
              note.title.trim().toLowerCase();
            const cardDescription = hasUsefulDescription
              ? note.content
              : t("readyToDecide");

            return (
              <GestureNoteSurface
                key={note.id}
                onPress={() => onSelectNote(note.id)}
                onSwipeRight={() => onCultivate(note.id)}
                onSwipeLeft={() => onSaveLater(note.id)}
                onLongPress={() => onShowActions(note.id)}
                rightLabel="Brote"
                rightIcon={Sprout}
                rightTone="bg-[var(--tone-sprout)] text-[var(--on-sage)]"
                leftLabel="Cobertizo"
                leftIcon={Archive}
                leftTone="bg-[var(--tone-warning)] text-[var(--on-sage)]"
                wrapperClassName={`${IDEA_CARD_RADIUS} bg-[var(--surface-strong)]`}
                className={`group relative overflow-hidden rounded-[1.25rem] bg-[var(--surface-strong)] px-3.5 py-3 shadow-[0_4px_16px_rgba(20,30,24,0.045)] ring-1 ring-[color-mix(in_srgb,var(--border)_78%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--surface-strong)_82%,var(--surface-hover)_18%)] ${recentlyCreatedNoteId === note.id ? "bg-[var(--sage)]/8 ring-[var(--sage)]/25" : ""}`}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectNote(note.id);
                  }}
                  className="flex w-full items-start gap-2.5 text-left"
                >
                  <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--tone-seed-bg)] text-[var(--tone-seed)] ring-1 ring-[var(--tone-seed-border)]">
                    <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="block min-w-0 truncate text-[0.98rem] font-semibold leading-tight tracking-tight text-[var(--earth)]">
                        {note.title}
                      </span>
                      <NoteCareStatus
                        note={note}
                        language={appLanguage === "en" ? "en" : "es"}
                        compact
                      />
                      <span className="ml-auto shrink-0 text-[11px] font-semibold text-[var(--text-muted)]">
                        {appLanguage === "en" ? "Created" : "Creada"}{" "}
                        {formatShortDate(note.createdAt)}
                      </span>
                    </span>
                    <span className="mt-1 block line-clamp-1 text-[0.9rem] font-medium leading-relaxed text-[var(--text-muted)]">
                      {cardDescription}
                    </span>
                  </span>
                </button>

                <div className="mt-2.5 flex items-center gap-2 pl-[1.9rem]">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onComplete(note.id);
                      }}
                      className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-[var(--sage)] px-3 text-[11px] font-semibold leading-none text-[var(--on-sage)] shadow-sm active:translate-y-px soft-interaction"
                    >
                      <CheckCircle2 size={12} />{" "}
                      {gardenName("complete", appLanguage)}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onCultivate(note.id);
                      }}
                      className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-[var(--bg-app)]/70 px-3 text-[11px] font-semibold leading-none text-[var(--sage)] ring-1 ring-[var(--border)] active:translate-y-px soft-interaction hover:bg-[var(--surface-hover)]"
                    >
                      <Sprout size={12} />{" "}
                      {appLanguage === "en" ? "Convert" : "Convertir"}
                    </button>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onShowActions(note.id);
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--text-muted)] opacity-100 transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--sage)] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    aria-label="Más opciones"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              </GestureNoteSurface>
            );
          })
        )}
        {inboxList.hasMore && (
          <div className="xl:col-span-2">
            <ProgressiveListMoreButton
              remaining={inboxList.remaining}
              onClick={inboxList.showMore}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
