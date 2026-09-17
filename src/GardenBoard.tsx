import { useMemo, useState } from 'react';
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowRight, Box, Check, GripVertical, LayoutGrid, Lightbulb, Link2, List, PanelsTopLeft, Plus, StickyNote, Undo2, X } from 'lucide-react';
import type { SeedNote } from './types';
import { NoteCareStatus } from './NoteCareStatus';
import { BOARD_CARD_HEIGHT, BOARD_CARD_WIDTH, BOARD_HEIGHT, BOARD_WIDTH, connectBoardCards, emptyGardenBoard, moveBoardCard, nextBoardPosition, readGardenBoard, removeBoardCard, restoreBoardCard, type BoardCard, type BoardConnection, type GardenBoardData } from './boardLogic';
import './styles/gardenBoard.css';

const cardTitle = (card: BoardCard, notes: SeedNote[], en: boolean) => card.kind === 'sticky' ? card.text?.trim().split('\n')[0] || (en ? 'Sticky note' : 'Nota adhesiva') : notes.find(note => note.id === card.noteId)?.title || (en ? 'Note unavailable' : 'Nota no disponible');

export function GardenBoardPreview({ raw, notes, language, onOpen }: { raw: string | null; notes: SeedNote[]; language: 'es' | 'en'; onOpen: () => void }) {
  const en = language === 'en';
  let board = emptyGardenBoard();
  let failed = false;
  try { board = readGardenBoard(raw); } catch { failed = true; }
  return <section className="garden-board-preview" aria-label={gardenName('board', language)}>
    <div className="dashboard-card-heading"><span className="dashboard-icon"><PanelsTopLeft size={21} strokeWidth={1.6} /></span><span className="dashboard-eyebrow">{en ? 'SPACE TO CONNECT' : 'ESPACIO PARA CONECTAR'}</span></div>
    <h3>{gardenName('board', language)}</h3>
    <p>{failed ? en ? 'Your board couldn’t be loaded. Open it to retry.' : 'No se pudo cargar la pizarra. Ábrela para reintentar.' : board.cards.length ? en ? `${board.cards.length} cards · ${board.connections.length} connections` : `${board.cards.length} tarjetas · ${board.connections.length} conexiones` : en ? 'Give your ideas room. Bring notes together and discover how they connect.' : 'Dale espacio a tus ideas. Reúne notas y descubre cómo se conectan.'}</p>
    {board.cards.length > 0 && <div className="board-mini-cards" aria-hidden="true">{board.cards.slice(0, 3).map(card => <span key={card.id} className={card.kind === 'sticky' ? 'is-sticky' : ''}>{cardTitle(card, notes, en)}</span>)}</div>}
    <button type="button" className="dashboard-text-button" onClick={onOpen}>{en ? 'Open the table' : 'Abrir la mesa'}<ArrowRight size={16} /></button>
  </section>;
}

function DraggableBoardCard({ card, note, language, canvas, onPatch, onRemove, onOpen }: {
  card: BoardCard; note?: SeedNote; language: 'es' | 'en'; canvas: boolean;
  onPatch: (id: string, patch: Partial<BoardCard>) => void; onRemove: (id: string) => void; onOpen: (id: string) => void;
}) {
  const en = language === 'en';
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: card.id, disabled: !canvas });
  return <article ref={setNodeRef} className={`board-card ${card.kind === 'sticky' ? 'is-sticky' : ''} ${isDragging ? 'is-dragging' : ''}`} style={canvas ? { left: card.x, top: card.y, transform: CSS.Translate.toString(transform), zIndex: isDragging ? 5 : 2 } : undefined}>
    <div className="board-card-heading">
      <span className="board-card-kind">{card.kind === 'sticky' ? <StickyNote size={15} /> : note?.isGrowth ? <Box size={15} /> : <Lightbulb size={15} />}{card.kind === 'sticky' ? en ? 'Sticky note' : 'Adhesiva' : note?.isGrowth ? gardenName('project', language, true) : en ? 'Seed / note' : 'Semilla / apunte'}</span>
      {note && <NoteCareStatus note={note} compact language={language} />}
      {canvas && <button type="button" ref={setActivatorNodeRef} {...listeners} {...attributes} className="board-card-drag" aria-label={`${en ? 'Move' : 'Mover'} ${card.kind === 'sticky' ? (en ? 'sticky note' : 'nota adhesiva') : note?.title || (en ? 'card' : 'tarjeta')}`} style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}><GripVertical size={17} /></button>}
      <button type="button" className="board-card-remove" title={en ? 'Remove from board, not from your garden' : 'Quitar de la pizarra, no del jardín'} aria-label={`${en ? 'Remove from board' : 'Quitar de la pizarra'}: ${note?.title || (en ? 'sticky note' : 'nota adhesiva')}`} onClick={() => onRemove(card.id)}><X size={16} /></button>
    </div>
    {card.kind === 'sticky' ? <textarea className="board-sticky-writing" aria-label={en ? 'Sticky note text' : 'Texto de la nota adhesiva'} value={card.text || ''} placeholder={en ? 'An idea to explore…' : 'Una idea por explorar…'} onChange={event => onPatch(card.id, { text: event.target.value })} /> : <button type="button" className="board-note-open" disabled={!note} onClick={() => note && onOpen(note.id)}><h3>{note?.title || (en ? 'Note unavailable' : 'Nota no disponible')}</h3><p>{note?.content || (note ? en ? 'Open to see its next steps.' : 'Abre para ver sus próximos pasos.' : en ? 'The original was removed. This card doesn’t recreate it.' : 'El original se eliminó. Esta tarjeta no lo recrea.')}</p>{note && <span>{en ? 'Open original' : 'Abrir original'}<ArrowRight size={14} /></span>}</button>}
    <label className="board-card-group"><span className="sr-only">{en ? 'Group or theme' : 'Grupo o tema'}</span><input aria-label={en ? 'Group or theme' : 'Grupo o tema'} placeholder={en ? 'Add a theme…' : 'Añadir un tema…'} value={card.group} onChange={event => onPatch(card.id, { group: event.target.value })} /></label>
  </article>;
}

export function GardenBoard({ raw, notes, language, onSave, onOpenNote, onExit }: {
  raw: string | null; notes: SeedNote[]; language: 'es' | 'en'; onSave: (board: GardenBoardData) => boolean; onOpenNote: (id: string) => void; onExit: () => void;
}) {
  const en = language === 'en';
  const copy = (es: string, eng: string) => en ? eng : es;
  const initial = useMemo(() => { try { return { board: readGardenBoard(raw), error: false }; } catch { return { board: emptyGardenBoard(), error: true }; } }, []);
  const [board, setBoard] = useState(initial.board);
  const [readError, setReadError] = useState(initial.error);
  const [saveFailed, setSaveFailed] = useState(false);
  const [mode, setMode] = useState<'canvas' | 'list'>(() => window.matchMedia('(max-width: 639px)').matches ? 'list' : 'canvas');
  const [panel, setPanel] = useState<'add' | 'connect' | null>(null);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [undo, setUndo] = useState<{ card: BoardCard; connections: BoardConnection[] } | null>(null);
  const [message, setMessage] = useState('');
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }), useSensor(KeyboardSensor));
  const commit = (next: GardenBoardData) => { if (readError) return; setBoard(next); setSaveFailed(!onSave(next)); };
  const patch = (id: string, change: Partial<BoardCard>) => { if (theme && change.group !== undefined) setTheme(change.group.trim()); commit({ ...board, cards: board.cards.map(card => card.id === id ? { ...card, ...change } : card) }); };
  const addNote = (note: SeedNote) => { if (board.cards.some(card => card.noteId === note.id)) return; commit({ ...board, cards: [...board.cards, { id: crypto.randomUUID(), kind: 'note', noteId: note.id, group: '', ...nextBoardPosition(board) }] }); setMessage(copy('Nota añadida sin duplicar el original.', 'Note added without duplicating the original.')); };
  const addSticky = () => { commit({ ...board, cards: [...board.cards, { id: crypto.randomUUID(), kind: 'sticky', text: '', group: '', ...nextBoardPosition(board) }] }); setTheme(''); setMessage(copy('Nota adhesiva añadida.', 'Sticky note added.')); };
  const remove = (id: string) => {
    const card = board.cards.find(item => item.id === id);
    if (!card) return;
    setUndo({ card, connections: board.connections.filter(edge => edge.from === id || edge.to === id) });
    const next = removeBoardCard(board, id);
    if (theme && !next.cards.some(item => item.group.trim() === theme)) setTheme('');
    commit(next);
    setMessage(card.kind === 'note' ? copy('Tarjeta retirada. La nota original sigue en tu jardín.', 'Card removed. The original note stays in your garden.') : copy('Adhesiva retirada. Puedes deshacerlo.', 'Sticky removed. You can undo this.'));
  };
  const onDragEnd = ({ active, delta }: DragEndEvent) => { const card = board.cards.find(item => item.id === active.id); if (card) commit(moveBoardCard(board, card.id, card.x + delta.x, card.y + delta.y)); };
  const groups = [...new Set(board.cards.map(card => card.group.trim()).filter(Boolean))];
  const cards = board.cards.filter(card => !theme || card.group.trim() === theme);
  const availableNotes = notes.filter(note => !board.cards.some(card => card.noteId === note.id) && `${note.title} ${note.content}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const visibleIds = new Set(cards.map(card => card.id));
  const edges = board.connections.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  const validConnection = from && to && from !== to && board.cards.some(card => card.id === from) && board.cards.some(card => card.id === to) && !board.connections.some(edge => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from));
  const renderCard = (card: BoardCard) => <DraggableBoardCard key={card.id} card={card} note={notes.find(note => note.id === card.noteId)} language={language} canvas={mode === 'canvas'} onPatch={patch} onRemove={remove} onOpen={onOpenNote} />;

  return <div className="garden-board-view">
    <header className="board-page-heading"><button type="button" className="board-icon-button" onClick={onExit} aria-label={copy('Volver a Hoy', 'Back to Today')}><ArrowLeft size={21} /></button><div><p className="dashboard-eyebrow">{copy('IDEAS QUE SE ENCUENTRAN', 'IDEAS COME TOGETHER')}</p><h1>{gardenName('board', language)}</h1></div></header>
    <p className="board-intro">{copy('Un espacio para explorar, conectar y darle forma a lo que tienes en mente.', 'A space to explore, connect and shape what’s on your mind.')}</p>
    {readError ? <section className="board-load-error" role="alert"><h2>{copy('No pudimos leer tu pizarra.', 'We couldn’t read your board.')}</h2><p>{copy('Los datos guardados no se han sobrescrito. Puedes intentar cargarla de nuevo.', 'Stored data hasn’t been overwritten. You can try loading it again.')}</p><button type="button" className="dashboard-primary-button" onClick={() => { try { const loaded = readGardenBoard(raw); setBoard(loaded); setReadError(false); } catch { /* Keep the original safe. */ } }}>{copy('Reintentar', 'Retry')}</button></section> : <>
      <div className="board-toolbar"><div className="board-toolbar-actions"><button type="button" className="dashboard-primary-button" onClick={() => setPanel(panel === 'add' ? null : 'add')} aria-expanded={panel === 'add'}><Plus size={17} />{copy('Traer del jardín', 'Bring from garden')}</button><button type="button" className="board-tool-button" onClick={addSticky}><StickyNote size={17} />{copy('Adhesiva', 'Sticky')}</button><button type="button" className="board-tool-button" onClick={() => setPanel(panel === 'connect' ? null : 'connect')} disabled={board.cards.length < 2} aria-expanded={panel === 'connect'}><Link2 size={17} />{copy('Conectar', 'Connect')}</button></div><div className="board-view-toggle" role="group" aria-label={copy('Vista de la pizarra', 'Board view')}><button type="button" aria-pressed={mode === 'canvas'} onClick={() => setMode('canvas')}><LayoutGrid size={16} />{copy('Lienzo', 'Canvas')}</button><button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')}><List size={16} />{copy('Lista', 'List')}</button></div></div>
      <div className="board-save-status"><span role={saveFailed ? 'alert' : 'status'}>{saveFailed ? copy('No se pudo guardar. Los cambios siguen aquí; libera espacio y reintenta.', 'Couldn’t save. Your changes are still here; free up space and retry.') : <><Check size={13} />{copy('Guardado en este dispositivo · por cuenta y jardín', 'Saved on this device · per account and garden')}</>}</span>{saveFailed && <button type="button" className="dashboard-text-button" onClick={() => setSaveFailed(!onSave(board))}>{copy('Reintentar guardar', 'Retry saving')}</button>}</div>
      {panel === 'add' && <section className="board-add-panel" aria-label={copy('Añadir notas existentes', 'Add existing notes')}><div className="board-panel-heading"><h2>{copy('Trae una idea, nota o proyecto', 'Bring an idea, note or project')}</h2><button type="button" className="board-icon-button" onClick={() => setPanel(null)} aria-label={copy('Cerrar selector', 'Close selector')}><X size={18} /></button></div><input type="search" className="board-search" placeholder={copy('Buscar en tu jardín…', 'Search your garden…')} aria-label={copy('Buscar notas para la pizarra', 'Search notes for the board')} value={query} onChange={event => setQuery(event.target.value)} /><div className="board-note-picker">{availableNotes.map(note => <button type="button" key={note.id} onClick={() => { addNote(note); setTheme(''); }}><span>{note.isGrowth ? <Box size={16} /> : <Lightbulb size={16} />}{note.title}</span><NoteCareStatus note={note} compact language={language} /><Plus size={16} /></button>)}</div>{!availableNotes.length && <p className="board-muted">{copy('No hay más notas que coincidan. También puedes empezar con una adhesiva.', 'No more matching notes. You can also start with a sticky note.')}</p>}</section>}
      {panel === 'connect' && <form className="board-connect-panel" onSubmit={event => { event.preventDefault(); if (!validConnection) return; commit(connectBoardCards(board, from, to, crypto.randomUUID())); setMessage(copy('Conexión creada en la pizarra.', 'Board connection created.')); setPanel(null); setFrom(''); setTo(''); }}><h2>{copy('Relacionar dos tarjetas', 'Connect two cards')}</h2><div><label>{copy('Desde', 'From')}<select required value={from} onChange={event => setFrom(event.target.value)}><option value="">{copy('Elegir tarjeta', 'Choose card')}</option>{board.cards.map(card => <option key={card.id} value={card.id}>{cardTitle(card, notes, en)}</option>)}</select></label><label>{copy('Hasta', 'To')}<select required value={to} onChange={event => setTo(event.target.value)}><option value="">{copy('Elegir tarjeta', 'Choose card')}</option>{board.cards.map(card => <option key={card.id} value={card.id}>{cardTitle(card, notes, en)}</option>)}</select></label><button type="submit" className="dashboard-primary-button" disabled={!validConnection}><Link2 size={16} />{copy('Conectar', 'Connect')}</button><button type="button" className="dashboard-text-button" onClick={() => setPanel(null)}>{copy('Cancelar', 'Cancel')}</button></div></form>}
      {groups.length > 0 && <div className="board-group-filters" role="group" aria-label={copy('Filtrar por tema', 'Filter by theme')}><button type="button" aria-pressed={!theme} onClick={() => setTheme('')}>{copy('Todo', 'All')} {board.cards.length}</button>{groups.map(group => <button key={group} type="button" aria-pressed={theme === group} onClick={() => setTheme(group)}>{group}</button>)}</div>}
      <p className="board-action-feedback" role="status">{message}{undo && <button type="button" className="dashboard-text-button" onClick={() => { commit(restoreBoardCard(board, undo.card, undo.connections)); setUndo(null); setMessage(copy('Tarjeta y conexiones restauradas.', 'Card and connections restored.')); }}><Undo2 size={15} />{copy('Deshacer retirada', 'Undo removal')}</button>}</p>
      {!board.cards.length ? <section className="board-empty"><PanelsTopLeft size={42} strokeWidth={1.2} /><h2>{copy('Tu jardín también puede verse así.', 'Your garden can look like this too.')}</h2><p>{copy('Trae una nota o crea una adhesiva. Después, conecta lo que tenga sentido para ti.', 'Bring a note or create a sticky. Then connect what makes sense to you.')}</p><button type="button" className="dashboard-primary-button" onClick={() => setPanel('add')}><Plus size={17} />{copy('Añadir la primera tarjeta', 'Add the first card')}</button></section> : <DndContext sensors={sensors} onDragEnd={onDragEnd} accessibility={{ screenReaderInstructions: { draggable: copy('Pulsa Espacio en el asa para mover una tarjeta, usa las flechas y pulsa Espacio para soltar o Escape para cancelar.', 'Press Space on the handle to move a card, use arrows, Space to drop or Escape to cancel.') } }}>
        {mode === 'canvas' ? <><p className="board-canvas-hint">{copy('Arrastra desde el asa de puntos. Desliza el fondo para recorrer el lienzo.', 'Drag the dotted handle. Scroll the background to explore the canvas.')}</p><div className="board-canvas-scroll" tabIndex={0} aria-label={copy('Lienzo desplazable de la pizarra', 'Scrollable board canvas')}><div className="board-canvas" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}><svg className="board-lines" width={BOARD_WIDTH} height={BOARD_HEIGHT} aria-hidden="true">{edges.map(edge => { const a = board.cards.find(card => card.id === edge.from)!, b = board.cards.find(card => card.id === edge.to)!; return <line key={edge.id} x1={a.x + BOARD_CARD_WIDTH / 2} y1={a.y + BOARD_CARD_HEIGHT / 2} x2={b.x + BOARD_CARD_WIDTH / 2} y2={b.y + BOARD_CARD_HEIGHT / 2} />; })}</svg>{cards.map(renderCard)}</div></div></> : <div className="board-list">{cards.map(renderCard)}</div>}
      </DndContext>}
      {theme && !cards.length && <p className="board-muted">{copy('Este tema ya no tiene tarjetas. Selecciona Todo para ver la pizarra.', 'This theme has no cards now. Select All to view the board.')}</p>}
      {board.connections.length > 0 && <section className="board-connections"><h2><Link2 size={17} />{copy('Conexiones', 'Connections')} · {board.connections.length}</h2>{board.connections.map(edge => { const a = board.cards.find(card => card.id === edge.from)!, b = board.cards.find(card => card.id === edge.to)!; return <div key={edge.id}><span>{cardTitle(a, notes, en)} <span aria-hidden="true">↔</span> {cardTitle(b, notes, en)}</span><button type="button" className="board-icon-button" aria-label={`${copy('Quitar conexión', 'Remove connection')}: ${cardTitle(a, notes, en)} / ${cardTitle(b, notes, en)}`} onClick={() => { commit({ ...board, connections: board.connections.filter(connection => connection.id !== edge.id) }); setMessage(copy('Conexión retirada; las tarjetas no cambian.', 'Connection removed; cards are unchanged.')); }}><X size={16} /></button></div>; })}</section>}
    </>}
  </div>;
}
import { gardenName } from './gardenVocabulary';
