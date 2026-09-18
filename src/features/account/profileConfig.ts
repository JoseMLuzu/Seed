/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const PROFILE_PURPOSES = [
  "Trabajo",
  "Estudios",
  "Proyectos creativos",
  "Ideas personales",
  "Todo un poco",
];

export const PROFILE_PURPOSE_OPTIONS = PROFILE_PURPOSES.map((purpose) => ({
  value: purpose,
  label: purpose,
}));
