/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Planet, SeedNote } from "../../types";

export function touchNote(note: SeedNote, timestamp = Date.now()): SeedNote {
  return { ...note, updatedAt: timestamp };
}

export function touchPlanet(planet: Planet, timestamp = Date.now()): Planet {
  return { ...planet, updatedAt: timestamp };
}

export function shouldAcceptSyncedEntity(
  current: SeedNote | Planet,
  incoming: SeedNote | Planet,
) {
  if (
    current.syncVersion !== undefined &&
    incoming.syncVersion !== undefined &&
    current.syncVersion !== incoming.syncVersion
  ) {
    return incoming.syncVersion > current.syncVersion;
  }
  return (
    (incoming.updatedAt || incoming.createdAt || 0) >=
    (current.updatedAt || current.createdAt || 0)
  );
}
