/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Plus, Sprout } from "lucide-react";

export function QuickCaptureBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  buttonLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  buttonLabel: string;
}) {
  const canSubmit = Boolean(value.trim());

  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-app)] p-2 shadow-inner shadow-black/[0.02] transition-all focus-within:border-[var(--border)] focus-within:bg-[var(--surface-strong)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-h-14 flex-1 items-center gap-3 rounded-[1.2rem] px-3 py-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--surface-strong)] text-[var(--sage)]">
            <Sprout size={17} />
          </span>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && canSubmit) {
                event.preventDefault();
                onSubmit();
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="h-10 w-full resize-none overflow-hidden bg-transparent py-2 text-base font-semibold leading-6 text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)] sm:text-sm"
          />
        </label>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[1.15rem] bg-[var(--sage)] px-5 text-sm font-black text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20 transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          <Plus size={17} /> {buttonLabel}
        </button>
      </div>
    </div>
  );
}
