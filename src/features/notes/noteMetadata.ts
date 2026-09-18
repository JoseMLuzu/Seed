/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SeedNote } from "../../types";

export function noteUpdatedAt(note: SeedNote) {
  return note.updatedAt || note.createdAt || 0;
}
