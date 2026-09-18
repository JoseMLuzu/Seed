/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Menu, Settings } from "lucide-react";
import { t } from "../i18n";

type MobileAppHeaderProps = {
  hidden: boolean;
  gardenName: string;
  ideaCount: number;
  onOpenMenu: () => void;
  onGoHome: () => void;
  onOpenSettings: () => void;
};

export function MobileAppHeader({
  hidden,
  gardenName,
  ideaCount,
  onOpenMenu,
  onGoHome,
  onOpenSettings,
}: MobileAppHeaderProps) {
  return (
    <div
      className={`fixed left-4 right-4 top-[var(--safe-top-control)] z-40 h-12 items-center justify-between rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-strong)]/88 px-2 shadow-xl shadow-black/10 backdrop-blur-2xl md:hidden ${hidden ? "hidden" : "flex"}`}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--sage)] transition-colors active:bg-[var(--bg-app)]"
        aria-label="Abrir menú"
      >
        <Menu size={19} />
      </button>
      <button
        type="button"
        onClick={onGoHome}
        className="min-w-0 flex-1 px-2 text-center"
        aria-label="Ir a Hoy"
      >
        <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">
          {gardenName}
        </span>
        <span className="block truncate text-[11px] font-medium text-[var(--text-muted)]">
          {ideaCount} ideas
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--sage)] transition-colors active:bg-[var(--bg-app)]"
        aria-label={t("settings")}
      >
        <Settings size={18} strokeWidth={2.3} />
      </button>
    </div>
  );
}
