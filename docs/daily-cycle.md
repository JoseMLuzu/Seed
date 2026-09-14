# Daily focus and closure cycle

The Today experience is backed by an internal, synchronized daily entry. It connects a morning focus with real garden activity, a short closure, and an optional handoff to the next day.

## Storage model

Daily entries reuse `SeedNote` persistence because notes already have offline storage, account isolation, incremental sync, realtime updates, revisions, and tombstones. They are identified by:

- `systemKind: "daily-entry"`
- the `daily-entry` tag
- a deterministic ID: `daily-entry:{planetId}:{localDate}`
- structured data in `dailyEntry`

The deterministic ID prevents two devices from creating separate entries for the same garden and local day. Daily entries are filtered out before garden views, tree generation, counters, reminders, and user-facing exports, while backups retain them.

## Daily flow

1. The user writes a custom focus or adopts Today’s suggested note.
2. Seeds creates or updates the daily entry and stores the linked note ID when applicable.
3. Task completions receive `completedAt`; focus sessions are appended to `focusHistory` with `startedAt`, `endedAt`, and their duration.
4. The closure summarizes planted notes, watered notes, completed steps, harvests, and focus minutes for the local day.
5. If the focus is unfinished, the user chooses tomorrow, garden, or shed.
6. The following day, Seeds shows the previous intention/reflection. A carry-forward creates today’s entry and marks yesterday’s entry as continued.

## Synchronization

Daily entries travel through the existing note sync pipeline and JSON payload, so no SQL schema migration is required. The entry itself, its dismissal state, and its carry-forward state synchronize between signed-in devices. Guest entries remain in the account-scoped offline store.

## Product rules

- Closing a day never breaks a streak or applies a penalty.
- A closed entry is read-only from Today.
- Sending a linked focus to the shed pauses the linked note.
- Returning it to the garden leaves the note active.
- Choosing tomorrow does not duplicate the underlying note; it carries only the daily focus reference.
- Internal daily entries never create trees or affect idea and harvest counts.

## Compatibility

Legacy local daily intentions are migrated into the synchronized daily entry the first time the garden loads. Existing `daily-closure` notes are recognized as system entries and no longer appear as ordinary harvests.
