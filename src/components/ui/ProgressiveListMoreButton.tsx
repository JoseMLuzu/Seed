/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo } from "react";
import { appLanguage } from "../../app/i18n";

export const ProgressiveListMoreButton = memo(function ProgressiveListMoreButton({
  remaining,
  onClick,
}: {
  remaining: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex h-11 w-full items-center justify-center rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-strong)] text-sm font-semibold text-[var(--sage)] shadow-sm soft-interaction"
    >
      {appLanguage === "en" ? `Show ${remaining} more` : `Ver ${remaining} más`}
    </button>
  );
});
