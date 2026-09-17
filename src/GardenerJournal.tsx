import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, Pencil, Plus, X } from 'lucide-react';
import type { JournalMood, SeedNote } from './types';
import { getDailyEntryForDate, isDailyEntryNote, localDateKey } from './seedLogic';
import { getJournalEntries, journalReflection, JOURNAL_MOODS } from './journalLogic';
import './styles/gardenerJournal.css';

export type JournalDraft = { entryId?: string; reflection: string; mood?: JournalMood; linkedNoteId?: string };

function entryDate(note: SeedNote, en: boolean) {
  const key = note.dailyEntry?.date || localDateKey(note.harvestedAt || note.createdAt);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(en ? 'en-US' : 'es', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function GardenerJournal({ notes, language, onSave, onSelectNote }: {
  notes: SeedNote[]; language: 'es' | 'en'; onSave: (draft: JournalDraft) => void; onSelectNote: (id: string) => void;
}) {
  const en = language === 'en';
  const copy = (es: string, eng: string) => en ? eng : es;
  const entries = getJournalEntries(notes);
  const latest = entries[0];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<JournalDraft>({ reflection: '' });
  const [initialDraft, setInitialDraft] = useState('');
  const [discard, setDiscard] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewport, setViewport] = useState({ height: window.innerHeight, top: 0 });
  const dialogRef = useRef<HTMLElement>(null);
  const dirty = editing && JSON.stringify(draft) !== initialDraft;
  const selectedEntry = notes.find(note => note.id === draft.entryId);
  const linkedNotes = notes.filter(note => !isDailyEntryNote(note));
  const draftMood = JOURNAL_MOODS.find(mood => mood.id === draft.mood);
  const latestMood = JOURNAL_MOODS.find(mood => mood.id === latest?.dailyEntry?.journalMood);
  const canSave = Boolean(draft.reflection.trim() || draft.mood || draft.linkedNoteId || draft.entryId);

  const startEntry = (entry?: SeedNote) => {
    const next: JournalDraft = {
      entryId: entry?.id,
      reflection: entry ? journalReflection(entry) : '',
      mood: entry?.dailyEntry?.journalMood,
      linkedNoteId: entry?.dailyEntry?.journalLinkedNoteId,
    };
    setDraft(next); setInitialDraft(JSON.stringify(next)); setEditing(true); setSaved(false); setOpen(true);
  };
  const requestClose = () => { if (dirty) setDiscard(true); else setOpen(false); };
  const showHistory = () => { if (dirty) setDiscard(true); else { setEditing(false); setSaved(false); } };

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const updateViewport = () => setViewport({ height: window.visualViewport?.height || window.innerHeight, top: window.visualViewport?.offsetTop || 0 });
    updateViewport();
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      document.body.style.overflow = oldOverflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open) dialogRef.current?.querySelector<HTMLButtonElement>(discard ? '.journal-discard button' : 'header button')?.focus();
  }, [discard, editing, open]);

  return <>
    <section className="gardener-journal-card" aria-label={copy('Diario del jardinero', 'Gardener’s journal')}>
      <div className="dashboard-card-heading"><span className="dashboard-icon"><BookOpen size={21} strokeWidth={1.6} /></span><span className="dashboard-eyebrow">{copy('UN MOMENTO PARA TI', 'A MOMENT FOR YOU')}</span></div>
      <h3>{copy('Diario del jardinero', 'Gardener’s journal')}</h3>
      {latest ? <><p className="journal-card-excerpt">{journalReflection(latest) || copy('Un momento guardado, incluso sin palabras.', 'A moment saved, even without words.')}</p><p className="journal-card-date">{latestMood && <span>{latestMood.symbol} {en ? latestMood.en : latestMood.es} · </span>}{entryDate(latest, en)}</p></> : <p className="journal-card-excerpt">{copy('¿Cómo estuvo tu jardín hoy? No todo lo que crece se mide en tareas.', 'How was your garden today? Not everything that grows can be measured in tasks.')}</p>}
      <div className="journal-card-actions"><button type="button" className="dashboard-primary-button" onClick={() => startEntry(getDailyEntryForDate(notes))}><Pencil size={16} />{copy('Escribir un momento', 'Write a moment')}</button><button type="button" className="dashboard-text-button" onClick={() => { setEditing(false); setSaved(false); setOpen(true); }}>{copy('Abrir diario', 'Open journal')}<ArrowRight size={15} /></button></div>
    </section>
    {open && createPortal(<div className="journal-overlay" style={{ '--journal-height': `${viewport.height}px`, '--journal-top': `${viewport.top}px` } as CSSProperties} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (discard) setDiscard(false); else requestClose(); }
      if (event.key === 'Tab') {
        const root = discard ? dialogRef.current?.querySelector('.journal-discard') : dialogRef.current;
        const controls = Array.from(root?.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, select, [tabindex="0"]') || []).filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="journal-backdrop" aria-hidden="true" onClick={requestClose} />
      <section className="journal-sheet" role="dialog" aria-modal="true" aria-labelledby="journal-heading" ref={dialogRef}>
        <div className="journal-handle" aria-hidden="true" />
        <header className="journal-header" inert={discard || undefined}>
          <button type="button" className="journal-icon-button" aria-label={editing ? copy('Volver al historial', 'Back to history') : copy('Cerrar diario', 'Close journal')} onClick={editing ? showHistory : requestClose}>{editing ? <ArrowLeft size={21} /> : <X size={21} />}</button>
          <h2 id="journal-heading">{copy('Diario del jardinero', 'Gardener’s journal')}</h2>
          {editing ? <button type="button" className="journal-save" disabled={!canSave} onClick={() => { onSave(draft); setEditing(false); setSaved(true); }}><Check size={17} />{copy('Guardar', 'Save')}</button> : <button type="button" className="journal-icon-button" aria-label={copy('Escribir hoy', 'Write today')} onClick={() => startEntry(getDailyEntryForDate(notes))}><Plus size={22} /></button>}
        </header>
        <div className="journal-content" inert={discard || undefined}>
          {saved && <p className="journal-saved" role="status"><Check size={16} />{copy('Tu momento está guardado.', 'Your moment is saved.')}</p>}
          {editing ? <>
            <p className="dashboard-eyebrow">{selectedEntry ? entryDate(selectedEntry, en) : new Date().toLocaleDateString(en ? 'en-US' : 'es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h3>{copy('¿Cómo estuvo tu jardín?', 'How was your garden?')}</h3>
            <p className="journal-hint">{copy('Una idea, algo que sentiste o simplemente unas palabras. Este espacio es tuyo.', 'An idea, something you felt, or just a few words. This space is yours.')}</p>
            <textarea className="journal-writing" aria-label={copy('Tu reflexión', 'Your reflection')} placeholder={copy('Hoy, en mi jardín…', 'Today, in my garden…')} value={draft.reflection} onChange={event => setDraft({ ...draft, reflection: event.target.value })} />
            <fieldset className="journal-moods"><legend>{copy('El clima de tu día', 'The weather of your day')} <span>{copy('· opcional', '· optional')}</span></legend><div>{JOURNAL_MOODS.map(mood => <button type="button" key={mood.id} aria-pressed={draft.mood === mood.id} onClick={() => setDraft({ ...draft, mood: draft.mood === mood.id ? undefined : mood.id })}><span aria-hidden="true">{mood.symbol}</span>{en ? mood.en : mood.es}</button>)}</div></fieldset>
            <label className="journal-link-label">{copy('Vincular con tu jardín · opcional', 'Link to your garden · optional')}<select value={draft.linkedNoteId || ''} onChange={event => setDraft({ ...draft, linkedNoteId: event.target.value || undefined })}><option value="">{copy('Sin vínculo', 'No link')}</option>{draft.linkedNoteId && !linkedNotes.some(note => note.id === draft.linkedNoteId) && <option value={draft.linkedNoteId}>{copy('Elemento no disponible', 'Item unavailable')}</option>}{linkedNotes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label>
            <p className="journal-footnote">{copy('Se guarda junto a tu reflexión de cierre. Escribir aquí no cierra el día ni cuenta como riego.', 'Saved with your daily reflection. Writing here doesn’t close the day or count as watering.')}{draftMood && <span className="sr-only"> {en ? draftMood.en : draftMood.es}</span>}</p>
          </> : <>
            <div className="journal-history-intro"><p className="dashboard-eyebrow">{copy('TU JARDÍN, CON EL TIEMPO', 'YOUR GARDEN, OVER TIME')}</p><h3>{copy('Lo que también está creciendo.', 'What else is growing.')}</h3><p className="journal-hint">{copy('Tus palabras y las reflexiones del cierre del día, en un mismo lugar. Sin rachas ni prisa.', 'Your words and daily reflections, together. No streaks, no hurry.')}</p></div>
            {entries.length ? <div className="journal-history">{entries.map(entry => {
              const mood = JOURNAL_MOODS.find(item => item.id === entry.dailyEntry?.journalMood);
              const linkedId = entry.dailyEntry?.journalLinkedNoteId || entry.dailyEntry?.linkedNoteId;
              const linked = linkedNotes.find(note => note.id === linkedId);
              return <article className="journal-history-entry" key={entry.id}>
                <div className="journal-entry-heading">
                  <time dateTime={entry.dailyEntry?.date || localDateKey(entry.harvestedAt || entry.createdAt)}>{entryDate(entry, en)}</time>
                  <button type="button" className="journal-icon-button" aria-label={`${copy('Editar entrada del', 'Edit entry for')} ${entryDate(entry, en)}`} onClick={() => startEntry(entry)}><Pencil size={16} /></button>
                </div>
                {mood && <p className="journal-entry-mood">{mood.symbol} {en ? mood.en : mood.es}</p>}
                <p className="journal-entry-text">{journalReflection(entry) || copy('Un día guardado, sin necesidad de añadir palabras.', 'A day saved, without needing to add words.')}</p>
                {linked && <button type="button" className="dashboard-text-button journal-entry-link" onClick={() => { setOpen(false); onSelectNote(linked.id); }}>{linked.title}<ArrowRight size={14} /></button>}
                {entry.dailyEntry?.closedAt && <p className="journal-entry-closed">{copy('Reflexión del cierre del día', 'Daily closing reflection')}</p>}
              </article>;
            })}</div> : <div className="journal-empty"><BookOpen size={34} strokeWidth={1.3} /><h3>{copy('Tu primera página está abierta.', 'Your first page is open.')}</h3><p>{copy('Puedes escribir cuando quieras. Unas palabras son suficientes.', 'Write whenever you like. A few words are enough.')}</p><button type="button" className="dashboard-primary-button" onClick={() => startEntry(getDailyEntryForDate(notes))}>{copy('Escribir un momento', 'Write a moment')}<Pencil size={16} /></button></div>}
          </>}
        </div>
        {discard && <div className="journal-discard" role="alertdialog" aria-modal="true" aria-labelledby="journal-discard-title"><h3 id="journal-discard-title">{copy('¿Salir sin guardar?', 'Leave without saving?')}</h3><p>{copy('Los cambios de este momento todavía no están guardados.', 'Your changes to this moment haven’t been saved yet.')}</p><button type="button" className="dashboard-primary-button" onClick={() => setDiscard(false)}>{copy('Seguir escribiendo', 'Keep writing')}</button><button type="button" className="dashboard-text-button" onClick={() => { setDiscard(false); setOpen(false); }}>{copy('Descartar cambios', 'Discard changes')}</button></div>}
      </section>
    </div>, document.body)}
  </>;
}
