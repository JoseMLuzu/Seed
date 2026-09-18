/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { format } from "date-fns";
import { appDateLocale, appLanguage } from "./i18n";

export function formatMonthYear(date: number | Date) {
  return format(date, "MMMM yyyy", { locale: appDateLocale });
}

export function formatDayMonth(date: number | Date) {
  return appLanguage === "en"
    ? format(date, "MMMM d", { locale: appDateLocale })
    : format(date, "d 'de' MMMM", { locale: appDateLocale });
}

export function formatShortDate(date: number | Date) {
  return format(date, "d MMM", { locale: appDateLocale });
}

export function dateInputToEndOfDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

export function timestampToDateInput(value: number) {
  return format(new Date(value), "yyyy-MM-dd");
}
