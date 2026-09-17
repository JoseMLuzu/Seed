import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_CARD_HEIGHT, BOARD_CARD_WIDTH, BOARD_HEIGHT, BOARD_WIDTH, connectBoardCards, emptyGardenBoard, gardenBoardKey, moveBoardCard, nextBoardPosition, readGardenBoard, removeBoardCard, restoreBoardCard, type GardenBoardData } from './boardLogic';
import { readDashboardModules } from './dashboardModules';
import { accountScope, scopedStorageKey } from './accountScope';

const makeBoard = (): GardenBoardData => ({ version: 1, cards: [
  { id: 'a', kind: 'note', noteId: 'note-1', group: 'Ideas', x: 24, y: 24 },
  { id: 'b', kind: 'sticky', text: 'Texto\ncon dos líneas', group: 'Ideas', x: 304, y: 24 },
  { id: 'c', kind: 'note', noteId: 'project-1', group: '', x: 584, y: 24 },
], connections: [{ id: 'ab', from: 'a', to: 'b' }] });

test('board round trip preserves references, sticky text, themes, coordinates and connections', () => {
  const restored = readGardenBoard(JSON.stringify(makeBoard()));
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), makeBoard());
  assert.equal(restored.cards[0].noteId, 'note-1');
  assert.equal(restored.cards[0].text, undefined);
  assert.deepEqual(readGardenBoard(null), emptyGardenBoard());
});
test('invalid saved data fails safely instead of silently resetting a board', () => {
  for (const raw of ['{bad', '{}', 'null', '{"version":2,"cards":[],"connections":[]}']) assert.throws(() => readGardenBoard(raw));
});
test('normalization excludes duplicate notes, invalid cards, loops and orphan connections', () => {
  const board = makeBoard();
  const raw = { ...board, cards: [...board.cards, { ...board.cards[0], id: 'duplicate-note' }, { id: 'bad', kind: 'invalid' }], connections: [...board.connections, { id: 'ba', from: 'b', to: 'a' }, { id: 'aa', from: 'a', to: 'a' }, { id: 'orphan', from: 'a', to: 'missing' }] };
  const restored = readGardenBoard(JSON.stringify(raw));
  assert.equal(restored.cards.length, 3);
  assert.equal(restored.connections.length, 1);
});
test('moving is immutable, clamps to the canvas and rejects invalid coordinates', () => {
  const board = makeBoard();
  const moved = moveBoardCard(board, 'a', -100, 10000);
  assert.equal(moved.cards[0].x, 0);
  assert.equal(moved.cards[0].y, BOARD_HEIGHT - BOARD_CARD_HEIGHT);
  assert.equal(board.cards[0].x, 24);
  assert.equal(moveBoardCard(board, 'a', NaN, 10), board);
  const restored = readGardenBoard(JSON.stringify({ ...board, cards: [{ ...board.cards[0], x: 9000, y: -1 }] }));
  assert.equal(restored.cards[0].x, BOARD_WIDTH - BOARD_CARD_WIDTH);
  assert.equal(restored.cards[0].y, 0);
});
test('connections reject self-links, missing endpoints and reversed duplicates', () => {
  const board = makeBoard();
  assert.equal(connectBoardCards(board, 'a', 'a', 'aa'), board);
  assert.equal(connectBoardCards(board, 'a', 'missing', 'bad'), board);
  assert.equal(connectBoardCards(board, 'b', 'a', 'ba'), board);
  const connected = connectBoardCards(board, 'b', 'c', 'bc');
  assert.equal(connected.connections.length, 2);
  assert.equal(board.connections.length, 1);
});
test('removing a placement removes only its incident edges, never source notes', () => {
  const board = makeBoard();
  const removed = removeBoardCard(board, 'a');
  assert.deepEqual(removed.cards.map(card => card.id), ['b', 'c']);
  assert.equal(removed.connections.length, 0);
  assert.equal(board.cards[0].noteId, 'note-1');
});
test('undo restores a removed card and connections without replacing subsequent edits', () => {
  const board = makeBoard();
  const removed = removeBoardCard(board, 'a');
  const changed = { ...removed, cards: removed.cards.map(card => card.id === 'b' ? { ...card, text: 'Después de retirar' } : card) };
  const restored = restoreBoardCard(changed, board.cards[0], board.connections);
  assert.equal(restored.cards.find(card => card.id === 'b')?.text, 'Después de retirar');
  assert.equal(restored.cards.length, 3);
  assert.equal(restored.connections.length, 1);
  assert.equal(restoreBoardCard(restored, board.cards[0], board.connections), restored);
});
test('boards remain account and garden scoped including guest mode', () => {
  const keys = [null, 'user-a', 'user-b'].flatMap(userId => ['garden-a', 'garden-b'].map(planetId => scopedStorageKey(accountScope(userId), gardenBoardKey(planetId))));
  assert.equal(new Set(keys).size, 6);
});
test('board visibility migration preserves disabled cards and explicitly empty dashboards', () => {
  assert.deepEqual(readDashboardModules(null, null, '["focus","journal"]', 'board'), ['focus', 'journal', 'board']);
  assert.deepEqual(readDashboardModules(null, null, '[]', 'board'), []);
  assert.deepEqual(readDashboardModules('["focus"]', null, '["journal"]', 'board'), ['focus']);
});
test('initial card placement is inside the canvas', () => {
  const next = nextBoardPosition(makeBoard());
  assert.ok(next.x >= 0 && next.x + BOARD_CARD_WIDTH <= BOARD_WIDTH);
  assert.ok(next.y >= 0 && next.y + BOARD_CARD_HEIGHT <= BOARD_HEIGHT);
});

test('adding after removing a card uses free space rather than overlapping another card', () => {
  const board = removeBoardCard(makeBoard(), 'b');
  assert.deepEqual(nextBoardPosition(board), { x: 304, y: 24 });
});
