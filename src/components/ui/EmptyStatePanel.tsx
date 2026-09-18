/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LucideIcon } from "lucide-react";

export function EmptyStatePanel({
  icon: Icon,
  eyebrow,
  title,
  detail,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  variant = "default",
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  variant?: "default" | "compact";
}) {
  const isCompact = variant === "compact";

  return (
    <section
      className={`relative overflow-hidden bg-[linear-gradient(180deg,var(--surface-strong),var(--surface-soft))] text-center shadow-sm ring-1 ring-[var(--border)] ${
        isCompact
          ? "mx-auto max-w-3xl rounded-[1.7rem] px-5 py-5 sm:px-6 sm:py-6"
          : "rounded-[2rem] p-6"
      }`}
    >
      <div
        className={`pointer-events-none absolute rounded-full bg-[var(--sage)]/8 blur-3xl ${
          isCompact ? "inset-x-16 top-3 h-16" : "inset-x-8 top-6 h-24"
        }`}
      />
      <div
        className={`relative mx-auto grid place-items-end ${
          isCompact ? "mb-0 h-14 w-20" : "mb-1 h-20 w-24"
        }`}
      >
        <div
          className={`absolute rounded-[999px] bg-[var(--bg-app)] shadow-inner ring-1 ring-[var(--border)] ${
            isCompact ? "bottom-1 h-5 w-14" : "bottom-2 h-7 w-20"
          }`}
        />
        <div
          className={`absolute rounded-full bg-[var(--tone-seed)]/55 ${
            isCompact ? "bottom-4 left-6 h-5 w-1.5" : "bottom-5 left-7 h-7 w-2"
          }`}
        />
        <div
          className={`absolute origin-bottom-left -rotate-12 rounded-[70%_30%_65%_35%] bg-[var(--tone-sprout-bg)] ring-1 ring-[var(--tone-sprout-border)] ${
            isCompact ? "bottom-7 left-7 h-5 w-7" : "bottom-10 left-8 h-6 w-8"
          }`}
        />
        <div
          className={`absolute grid place-items-center bg-[var(--surface-strong)] text-[var(--sage)] shadow-sm ring-1 ring-[var(--border)] ${
            isCompact
              ? "bottom-6 right-7 h-9 w-9 rounded-2xl"
              : "bottom-9 right-8 h-11 w-11 rounded-[1.15rem]"
          }`}
        >
          <Icon size={isCompact ? 18 : 21} />
        </div>
      </div>
      {eyebrow && (
        <p
          className={`relative font-black uppercase text-[var(--text-muted)] ${
            isCompact
              ? "mt-3 text-[9px] tracking-[0.2em]"
              : "mt-5 text-[10px] tracking-[0.22em]"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h3
        className={`relative mx-auto mt-2 font-semibold tracking-tight text-[var(--earth)] ${
          isCompact ? "max-w-lg text-xl sm:text-[1.35rem]" : "max-w-sm text-2xl"
        }`}
      >
        {title}
      </h3>
      <p
        className={`relative mx-auto mt-2 font-medium leading-relaxed text-[var(--text-muted)] ${
          isCompact ? "max-w-xl text-sm" : "max-w-sm text-sm"
        }`}
      >
        {detail}
      </p>
      {(actionLabel || secondaryLabel) && (
        <div
          className={`mx-auto grid gap-2 ${
            isCompact
              ? "mt-5 max-w-md grid-cols-2"
              : "mt-6 max-w-sm sm:grid-cols-2"
          }`}
        >
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className={`flex items-center justify-center rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] shadow-sm soft-interaction ${
                isCompact ? "h-10" : "h-11"
              }`}
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className={`flex items-center justify-center rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)] ring-1 ring-[var(--border)] soft-interaction ${
                isCompact ? "h-10" : "h-11"
              }`}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
