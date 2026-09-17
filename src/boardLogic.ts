export type BoardCard = { id: string; kind: 'note' | 'sticky'; noteId?: string; text?: string; group: string; x: number; y: number };
export type BoardConnection = { id: string; from: string; to: string };
export type GardenBoardData = { version: 1; cards: BoardCard[]; connections: BoardConnection[] };
export const BOARD_WIDTH = 1800;
export const BOARD_HEIGHT = 1200;
export const BOARD_CARD_WIDTH = 240;
export const BOARD_CARD_HEIGHT = 240;
export const emptyGardenBoard = (): GardenBoardData => ({ version: 1, cards: [], connections: [] });
export const gardenBoardKey = (planetId: string) => `seed-garden-board-v1:${encodeURIComponent(planetId)}`;
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export function readGardenBoard(raw: string | null): GardenBoardData {
  if (!raw) return emptyGardenBoard();
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !Array.isArray(data.cards) || !Array.isArray(data.connections)) throw new Error('Invalid garden board');
  const ids = new Set<string>();
  const notes = new Set<string>();
  const cards: BoardCard[] = data.cards.flatMap((card: any) => {
    if (!card || typeof card.id !== 'string' || !card.id || ids.has(card.id) || !['note', 'sticky'].includes(card.kind)) return [];
    if (card.kind === 'note' && (typeof card.noteId !== 'string' || !card.noteId || notes.has(card.noteId))) return [];
    ids.add(card.id);
    if (card.kind === 'note') notes.add(card.noteId);
    return [{ id: card.id, kind: card.kind, noteId: card.kind === 'note' ? card.noteId : undefined, text: card.kind === 'sticky' && typeof card.text === 'string' ? card.text : undefined, group: typeof card.group === 'string' ? card.group : '', x: clamp(Number.isFinite(card.x) ? card.x : 24, BOARD_WIDTH - BOARD_CARD_WIDTH), y: clamp(Number.isFinite(card.y) ? card.y : 24, BOARD_HEIGHT - BOARD_CARD_HEIGHT) }];
  });
  const pairs = new Set<string>();
  const connectionIds = new Set<string>();
  const connections: BoardConnection[] = data.connections.flatMap((edge: any) => {
    if (!edge || typeof edge.id !== 'string' || connectionIds.has(edge.id) || typeof edge.from !== 'string' || typeof edge.to !== 'string' || edge.from === edge.to || !ids.has(edge.from) || !ids.has(edge.to)) return [];
    const pair = JSON.stringify([edge.from, edge.to].sort());
    if (pairs.has(pair)) return [];
    pairs.add(pair); connectionIds.add(edge.id);
    return [{ id: edge.id, from: edge.from, to: edge.to }];
  });
  return { version: 1, cards, connections };
}

export function moveBoardCard(board: GardenBoardData, id: string, x: number, y: number): GardenBoardData {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return board;
  return { ...board, cards: board.cards.map(card => card.id === id ? { ...card, x: clamp(Math.round(x), BOARD_WIDTH - BOARD_CARD_WIDTH), y: clamp(Math.round(y), BOARD_HEIGHT - BOARD_CARD_HEIGHT) } : card) };
}

export function removeBoardCard(board: GardenBoardData, id: string): GardenBoardData {
  return { ...board, cards: board.cards.filter(card => card.id !== id), connections: board.connections.filter(edge => edge.from !== id && edge.to !== id) };
}

export function connectBoardCards(board: GardenBoardData, from: string, to: string, id: string): GardenBoardData {
  if (from === to || !board.cards.some(card => card.id === from) || !board.cards.some(card => card.id === to) || board.connections.some(edge => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))) return board;
  return { ...board, connections: [...board.connections, { id, from, to }] };
}

export function restoreBoardCard(board: GardenBoardData, card: BoardCard, connections: BoardConnection[]): GardenBoardData {
  if (board.cards.some(item => item.id === card.id || (card.kind === 'note' && item.noteId === card.noteId))) return board;
  return connections.reduce((current, edge) => connectBoardCards(current, edge.from, edge.to, edge.id), { ...board, cards: [...board.cards, card] });
}

export function nextBoardPosition(board: GardenBoardData) {
  for (let index = 0; index < 24; index++) {
    const x = 24 + (index % 6) * 280, y = 24 + Math.floor(index / 6) * 280;
    if (!board.cards.some(card => Math.abs(card.x - x) < BOARD_CARD_WIDTH && Math.abs(card.y - y) < BOARD_CARD_HEIGHT)) return { x, y };
  }
  return { x: 24 + (board.cards.length % 6) * 20, y: 24 + (board.cards.length % 4) * 20 };
}
