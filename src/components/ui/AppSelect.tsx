/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ChevronDown } from "lucide-react";

export type AppSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function AppSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Seleccionar",
  ariaLabel,
}: {
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 288,
    y: 6,
  });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const updateMenuLayout = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 8;
    const margin = 12;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < 190 && spaceAbove > spaceBelow;
    const available = Math.max(
      150,
      Math.min(288, (openUp ? spaceAbove : spaceBelow) - gap),
    );
    setMenuLayout({
      left: Math.max(
        margin,
        Math.min(rect.left, window.innerWidth - rect.width - margin),
      ),
      top: openUp
        ? Math.max(margin, rect.top - available - gap)
        : Math.min(rect.bottom + gap, viewportHeight - margin - available),
      width: rect.width,
      maxHeight: available,
      y: openUp ? -6 : 6,
    });
  };

  useLayoutEffect(() => {
    if (open) updateMenuLayout();
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const update = () => updateMenuLayout();
    window.addEventListener("click", close);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) setOpen((current) => !current);
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[1.15rem] bg-[var(--surface-strong)]/72 px-3.5 py-2.5 text-left text-sm font-bold text-[var(--earth)] outline-none ring-1 ring-[var(--border)] transition-all hover:bg-[var(--surface-strong)] focus:ring-1 focus:ring-[var(--border)] disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="min-w-0">
          <span className="block truncate">
            {selected?.label || placeholder}
          </span>
          {selected?.description && (
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--text-muted)]">
              {selected.description}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--sage)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: menuLayout.y * -1, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: menuLayout.y * -1, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                left: menuLayout.left,
                top: menuLayout.top,
                width: menuLayout.width,
                maxHeight: menuLayout.maxHeight,
              }}
              className="z-[120] overflow-y-auto rounded-[1.25rem] bg-[var(--surface-strong)]/98 p-1.5 shadow-2xl shadow-black/12 ring-1 ring-[var(--border)] backdrop-blur-xl app-scrollbar"
            >
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-[var(--sage)] text-[var(--on-sage)] shadow-sm"
                        : "text-[var(--earth)] hover:bg-[var(--bg-app)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">
                        {option.label}
                      </span>
                      {option.description && (
                        <span
                          className={`mt-0.5 block truncate text-[11px] font-semibold ${active ? "text-white/75" : "text-[var(--text-muted)]"}`}
                        >
                          {option.description}
                        </span>
                      )}
                    </span>
                    {active && <CheckCircle2 size={15} className="shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
