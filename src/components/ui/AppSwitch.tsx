/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function AppSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent p-0.5 outline-none transition-colors focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[var(--sage)]" : "bg-[var(--border)]"
      }`}
    >
      <span
        className={`h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
