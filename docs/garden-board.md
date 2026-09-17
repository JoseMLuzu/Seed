# Pizarra del jardín

The board is available from the sidebar and an optional, reorderable Today module.
It references existing notes by ID rather than copying note content. Sticky notes,
themes, positions and connections belong to the board, not to the referenced notes.
Removing a card never deletes a note; undo restores that card and its connections
without replacing subsequent edits elsewhere on the board.

## Persistence

Each board uses `seed-garden-board-v1:<encoded planet ID>` through account-scoped
storage. Boards are local to the current device/browser and are **not cloud synced**.
JSON backups include boards as well as garden notes; earlier backups without boards
remain importable. Deleting a garden or all local garden data also removes its boards
after the existing confirmations. Deleting an account clears its scoped storage.

Invalid saved JSON is not automatically overwritten. Failed writes keep the current
draft visible, report the failure and offer a retry. A deleted source note appears as
unavailable instead of being recreated or silently removed from the board.

## Interaction

Desktop starts in canvas mode. iPhone starts in list mode, with canvas available.
Only the dotted handles initiate mouse, touch or keyboard dragging; the background
remains scrollable. Space and arrow keys move a card; Escape cancels the drag.
Themes filter both cards and their visible connecting lines. Connections can also
be inspected and removed from the accessible list below the board.

The first version does not include freehand drawing, infinite canvas or cloud sync.
