import { useState } from 'react';
import { ArrowRight, Calendar, Check, CheckCircle2, Circle, Pencil, Play, Sprout, Sun, X } from 'lucide-react';
import { gardenName } from './gardenVocabulary';
import { GardenMotif } from './GardenMotif';
import { NoteCareStatus } from './NoteCareStatus';
import { getDailyFocusState } from './dailyFocus';
import type { SeedNote } from './types';

export function DailyFocusCard({ entry, intention, notes, previousEntry, language, onSave, onStart, onToggleComplete, onContinuePrevious, onDismissPrevious }: {
  entry?: SeedNote; intention: string; notes: SeedNote[]; previousEntry?: SeedNote; language: 'es' | 'en';
  onSave: (intention: string, noteId?: string, taskId?: string) => void;
  onStart: () => void; onToggleComplete: () => void;
  onContinuePrevious: (entry: SeedNote) => void; onDismissPrevious: (id: string) => void;
}) {
  const copy = (es: string, en: string) => language === 'en' ? en : es;
  const focus = getDailyFocusState(entry, notes);
  const saved = entry?.dailyEntry ? focus.intention : intention.trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [selected, setSelected] = useState<[string, string] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const projects = notes.filter(note => note.isGrowth && !note.inbox && !note.paused && note.growthStage !== 'withered' && note.tasks.some(task => !task.completed));
  const selectedProject = selected
    ? projects.find(note => note.id === selected[0])
    : undefined;
  const suggestion = projects.flatMap(note => note.tasks.filter(task => !task.completed).slice(0, 1).map(task => ({ note, task })))[0];
  const yesterday = previousEntry?.dailyEntry;
  const resumeYesterday = Boolean(previousEntry && yesterday?.intention && !yesterday.dismissedAt && !yesterday.continuedAt && yesterday.nextStep === 'tomorrow' && !focus.closed);
  const edit = () => {
    setDraft(saved);
    setSelected(
      focus.task && !focus.task.completed && focus.linkedNote
        ? [focus.linkedNote.id, focus.task.id]
        : null,
    );
    setConfirmClear(false);
    setEditing(true);
  };

  return <section className="dashboard-today-grid" aria-label={gardenName('dailyFocus', language)}>
    <article className="dashboard-focus dashboard-focus-v2" data-garden-stage={focus.complete ? 'bloom' : saved ? 'sprout' : 'seed'}>
      <GardenMotif stage={focus.complete ? 'bloom' : saved ? 'sprout' : 'seed'} className="dashboard-focus-motif" />
      <div className="dashboard-card-heading"><span className="dashboard-eyebrow"><Sprout size={16} aria-hidden="true" />{gardenName('dailyFocus', language)}</span>{focus.closed ? <CheckCircle2 size={19} aria-label={copy('Día cerrado', 'Day closed')} /> : saved && !editing && !focus.complete && <button type="button" className="dashboard-icon-button" onClick={edit} aria-label={copy('Editar mi labor de hoy', 'Edit today’s task')}><Pencil size={16} /></button>}</div>
      {editing && !focus.closed ? <form className="dashboard-focus-editor" onSubmit={event => { event.preventDefault(); if (!draft.trim()) return; onSave(draft.trim(), selected?.[0], selected?.[1]); setEditing(false); }}>
        <p className="dashboard-focus-editor-title">{copy('Una labor pequeña para hoy.', 'One small task for today.')}</p>
        <p className="dashboard-focus-editor-hint">{copy('Escribe tu objetivo o elige una tarea pendiente. Lo demás puede esperar.', 'Write your goal or pick a pending task. Everything else can wait.')}</p>
        <label className="dashboard-focus-choice-label" htmlFor="daily-focus-task">{copy('Elige una tarea pendiente o escribe una propia', 'Pick a pending task or write your own')}</label>
        <select id="daily-focus-task" value={selected ? JSON.stringify(selected) : ''} onChange={event => {
          if (!event.target.value) { setSelected(null); return; }
          const choice = JSON.parse(event.target.value) as [string, string];
          const task = notes.find(note => note.id === choice[0])?.tasks.find(task => task.id === choice[1]);
          setSelected(choice); if (task) setDraft(task.text);
        }}><option value="">{copy('Escribir una labor propia', 'Write my own task')}</option>{projects.map(note => <optgroup key={note.id} label={note.title}>{note.tasks.filter(task => !task.completed).map(task => <option key={task.id} value={JSON.stringify([note.id, task.id])}>{task.text}</option>)}</optgroup>)}</select>
        {selectedProject && <p className="dashboard-focus-selected-source"><Sprout size={14} aria-hidden="true" />{copy('Labor de', 'Task from')} <strong>{selectedProject.title}</strong><span>·</span>{copy('Pendiente', 'Pending')}</p>}
        {!selected && <input id="daily-focus-intention" aria-label={copy('Mi labor de hoy', 'Today’s task')} value={draft} onChange={event => setDraft(event.target.value)} placeholder={copy('Por ejemplo: preparar el primer boceto…', 'For example: prepare the first sketch…')} maxLength={280} />}
        <div className="dashboard-focus-actions"><button type="submit" className="dashboard-primary-button" disabled={!draft.trim()}><Check size={16} />{copy('Guardar labor', 'Save task')}</button><button type="button" className="dashboard-text-button" onClick={() => setEditing(false)}>{copy('Cancelar', 'Cancel')}</button></div>
      </form> : <>
        {saved && <span className={'dashboard-focus-status' + (focus.complete ? ' is-done' : '')}>{focus.complete ? <Sun size={15} /> : <Circle size={14} />}{focus.complete ? copy('LABOR LOGRADA', 'TASK ACHIEVED') : copy('TU ÚNICA LABOR DE HOY', 'YOUR ONE TASK TODAY')}</span>}
        <h3>{saved || (focus.closed ? copy('Hoy ya tiene su cierre.', 'Today is wrapped up.') : copy('Hoy no necesitas hacerlo todo.', 'You don’t need to do everything today.'))}</h3>
        <p>{focus.complete ? copy('Este paso ya cuenta. No tienes que terminar todo el proyecto.', 'This step counts. You don’t need to finish the whole project.') : saved ? copy('Dale espacio a esto. Lo demás puede esperar.', 'Make room for this. Everything else can wait.') : focus.closed ? copy('Tu día está guardado. Mañana puedes elegir un nuevo paso.', 'Your day is saved. Tomorrow you can choose a new step.') : copy('Elige algo pequeño y concreto para darle dirección a tu día.', 'Choose something small and specific to give your day direction.')}</p>
        {focus.linkedNote && <div className="dashboard-focus-context"><span>{copy('Una labor de', 'A task from')} <strong>{focus.linkedNote.title}</strong></span><NoteCareStatus note={focus.linkedNote} language={language} compact /></div>}
        {focus.sourceMissing && <p className="dashboard-focus-source-warning">{copy('El paso original ya no está disponible. Este objetivo sigue aquí para ti.', 'The original step is unavailable. This goal is still here for you.')}</p>}
        {saved && <div className="dashboard-focus-progress"><span>{focus.complete ? copy('Mi labor de hoy · logrado', 'Today’s task · achieved') : copy('Mi labor de hoy · pendiente', 'Today’s task · pending')}</span><progress max={1} value={focus.complete ? 1 : 0} aria-label={copy('Progreso del objetivo de hoy', 'Today’s task progress')} /></div>}
        {!focus.closed && <div className="dashboard-focus-actions"><button type="button" className="dashboard-primary-button" onClick={saved ? onStart : edit}>{saved ? focus.complete ? <Sun size={17} /> : <Play size={17} /> : <Sprout size={17} />}{saved ? focus.complete ? copy('Ver labor lograda', 'View achieved task') : gardenName('focus', language) : copy('Elegir mi labor', 'Choose my task')}<ArrowRight size={16} /></button>{saved && <button type="button" className="dashboard-focus-done" onClick={onToggleComplete}>{focus.complete ? <CheckCircle2 size={18} /> : <Circle size={18} />}{focus.complete ? copy('Marcar pendiente', 'Mark pending') : copy('Ya lo hice', 'Already done')}</button>}</div>}
        {!saved && !focus.closed && !resumeYesterday && suggestion && <button type="button" className="dashboard-suggestion" onClick={() => onSave(suggestion.task.text, suggestion.note.id, suggestion.task.id)}><Sprout size={16} /><span>{copy('Una labor posible: ', 'One possible task: ')}{suggestion.task.text}</span><ArrowRight size={16} /></button>}
        {saved && !focus.closed && <details className="dashboard-focus-options"><summary>{copy('Más opciones', 'More options')}</summary><button type="button" className="dashboard-text-button" onClick={() => setConfirmClear(true)}>{copy('Quitar mi labor de hoy', 'Clear today’s task')}</button></details>}
        {confirmClear && !focus.closed && <div className="dashboard-focus-clear" role="alertdialog" aria-labelledby="daily-focus-clear-title"><p id="daily-focus-clear-title">{copy('¿Quitar esta labor?', 'Clear this task?')}</p><p>{copy('Tu Diario, notas y avances se conservan.', 'Your journal, notes and progress are kept.')}</p><div><button type="button" className="dashboard-text-button" onClick={() => { onSave(''); setConfirmClear(false); }}>{copy('Sí, quitar labor', 'Yes, clear task')}</button><button type="button" className="dashboard-text-button" onClick={() => setConfirmClear(false)}>{copy('Cancelar', 'Cancel')}</button></div></div>}
      </>}
      {resumeYesterday && !saved && !editing && <div className="dashboard-focus-yesterday"><span><Calendar size={15} />{copy('Puedes retomar lo de ayer', 'You can pick up yesterday’s goal')}</span><p>{yesterday!.intention}</p><div><button type="button" className="dashboard-text-button" onClick={() => onContinuePrevious(previousEntry!)}>{copy('Elegir para hoy', 'Choose for today')}<ArrowRight size={14} /></button><button type="button" className="dashboard-icon-button" onClick={() => onDismissPrevious(previousEntry!.id)} aria-label={copy('Ocultar pendiente de ayer', 'Dismiss yesterday’s reminder')}><X size={15} /></button></div></div>}
    </article>
  </section>;
}
