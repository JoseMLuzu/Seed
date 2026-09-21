import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Circle, Clock, Pause, Play, RotateCcw, Square, Sun } from 'lucide-react';
import { gardenName } from './gardenVocabulary';
import { GardenMotif } from './GardenMotif';
import { getDailyFocusState } from './dailyFocus';
import { startFocusLiveActivity, stopFocusLiveActivity } from './native/liveActivity';
import type { SeedNote, Task } from './types';
import { FocusGardenTable } from './features/focus/FocusGardenTable';
import './styles/dailyFocus.css';

export function DailyFocusSession({ entry, notes, language, onToggleComplete, onToggleProjectTask, onLogMinutes, onUpdateProjectMemo, onQuickCapture, onExit }: {
  entry?: SeedNote; notes: SeedNote[]; language: 'es' | 'en';
  onToggleComplete: () => void; onLogMinutes: (minutes: number) => void; onExit: () => void;
  onToggleProjectTask?: (noteId: string, taskId: string) => void;
  onUpdateProjectMemo: (noteId: string, value: string) => void;
  onQuickCapture: (value: string) => void;
}) {
  const copy = (es: string, en: string) => language === 'en' ? en : es;
  const focus = useMemo(() => getDailyFocusState(entry, notes), [entry, notes]);
  const [duration, setDuration] = useState(10);
  const [remaining, setRemaining] = useState(600);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [savedMinutes, setSavedMinutes] = useState<number | null>(null);
  const [mobileTableOpen, setMobileTableOpen] = useState(false);
  const session = useRef<{ startedAt: number; endsAt: number; minutes: number; pausedAt?: number } | null>(null);
  const logRef = useRef(onLogMinutes);
  logRef.current = onLogMinutes;

  const saveSession = useCallback(() => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    const endedAt = current.pausedAt || Date.now();
    const minutes = Math.min(current.minutes, Math.max(0, Math.floor((endedAt - current.startedAt) / 60_000)));
    if (minutes > 0) logRef.current(minutes);
    setActive(false);
    setPaused(false);
    setSavedMinutes(minutes);
    void stopFocusLiveActivity();
  }, []);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (!session.current) return;
      const seconds = Math.max(0, Math.ceil((session.current.endsAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) saveSession();
    };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [active, saveSession]);

  useEffect(() => {
    if (focus.complete || focus.closed || !focus.intention) saveSession();
  }, [focus.complete, focus.closed, focus.intention, saveSession]);

  useEffect(() => () => {
    const current = session.current;
    session.current = null;
    if (!current) return;
    const endedAt = current.pausedAt || Date.now();
    const minutes = Math.min(current.minutes, Math.max(0, Math.floor((endedAt - current.startedAt) / 60_000)));
    if (minutes > 0) logRef.current(minutes);
    void stopFocusLiveActivity();
  }, []);

  const start = () => {
    if (!entry || !focus.intention || focus.closed || focus.complete) return;
    const startedAt = Date.now();
    session.current = { startedAt, endsAt: startedAt + duration * 60_000, minutes: duration };
    setRemaining(duration * 60);
    setSavedMinutes(null);
    setPaused(false);
    setActive(true);
    void startFocusLiveActivity({ noteId: entry.id, title: focus.intention, subtitle: copy('Solo tu objetivo de hoy.', 'Just today’s goal.'), endTimestamp: session.current.endsAt, progress: 0 });
  };

  const pause = () => {
    const current = session.current;
    if (!current || !active) return;
    current.pausedAt = Date.now();
    setActive(false);
    setPaused(true);
    void stopFocusLiveActivity();
  };

  const resume = () => {
    const current = session.current;
    if (!current?.pausedAt || !paused || !entry) return;
    const pausedFor = Date.now() - current.pausedAt;
    current.startedAt += pausedFor;
    current.endsAt += pausedFor;
    delete current.pausedAt;
    setPaused(false);
    setActive(true);
    void startFocusLiveActivity({ noteId: entry.id, title: focus.intention, subtitle: copy('Solo tu objetivo de hoy.', 'Just today’s goal.'), endTimestamp: current.endsAt, progress: 0 });
  };

  const sessionState = focus.complete
    ? 'complete'
    : active
      ? 'active'
      : paused
        ? 'paused'
        : savedMinutes !== null
          ? 'finished'
          : 'ready';
  const notebookEntry = focus.linkedNote || entry;
  const tableTasks: Task[] = useMemo(() => focus.linkedNote
    ? [...focus.linkedNote.tasks].sort((a, b) => Number(a.completed) - Number(b.completed)).slice(0, 3)
    : focus.intention
      ? [{ id: focus.task?.id || 'daily-focus-task', text: focus.intention, completed: focus.complete }]
      : [], [focus.complete, focus.intention, focus.linkedNote, focus.task?.id]);
  const toggleTableTask = useCallback((taskId: string) => {
    if (focus.linkedNote && onToggleProjectTask) {
      onToggleProjectTask(focus.linkedNote.id, taskId);
      return;
    }
    onToggleComplete();
  }, [focus.linkedNote, onToggleComplete, onToggleProjectTask]);
  const updateTableNote = useCallback((value: string) => {
    if (notebookEntry) onUpdateProjectMemo(notebookEntry.id, value);
  }, [notebookEntry, onUpdateProjectMemo]);
  const toggleMobileTable = useCallback(() => {
    setMobileTableOpen(open => !open);
  }, []);

  return <section className="daily-focus-session" data-active={active} aria-labelledby="daily-focus-heading">
    <div className="daily-focus-topbar">
    <button type="button" className="daily-focus-back" onClick={() => { saveSession(); onExit(); }}><ArrowLeft size={18} /><span>{copy('Volver a Hoy', 'Back to Today')}</span></button>
      <span className="daily-focus-mode">{active ? copy('Foco activo', 'Focus active') : paused ? copy('En pausa', 'Paused') : copy('Foco', 'Focus')}</span>
    </div>
    {!focus.intention ? <div className="daily-focus-room"><h1 id="daily-focus-heading">{copy('Elige tu labor de hoy.', 'Choose today’s task.')}</h1><p>{copy('Puedes elegirla desde Hoy. Tus notas siguen en su lugar.', 'Choose it from Today. Your notes are still safe.')}</p></div> : <div className="daily-focus-workspace">
      <FocusGardenTable
        language={language}
        compact={sessionState === 'ready'}
        mobileCollapsed={!mobileTableOpen}
        onMobileToggle={toggleMobileTable}
        sourceName={focus.linkedNote?.title || copy('Mi labor de hoy', 'My task today')}
        note={notebookEntry?.focusNote || ''}
        tasks={tableTasks}
        onNoteChange={updateTableNote}
        onToggleTask={toggleTableTask}
        onQuickCapture={onQuickCapture}
      />
      <div className="daily-focus-room" data-active={active} data-state={sessionState} data-complete={focus.complete}>
      <div className="daily-focus-ambient" aria-hidden="true" />
      <div className="daily-focus-content">
      <span className="dashboard-eyebrow">{active ? copy('UNA SOLA COSA', 'ONE THING ONLY') : gardenName('focus', language)}</span>
      <GardenMotif stage={focus.complete ? 'bloom' : active ? 'sprout' : 'seed'} className="daily-focus-plant" />
      <h1 id="daily-focus-heading">{focus.complete ? copy('Lo que elegiste hoy, logrado.', 'Today’s chosen goal, achieved.') : focus.intention}</h1>
      {focus.complete && <p className="daily-focus-achieved">{focus.intention}</p>}
      <p className="daily-focus-guidance">{focus.complete ? copy('Ese paso cuenta. El resto del proyecto puede esperar.', 'This step counts. The rest of the project can wait.') : copy('No necesitas terminar todo el proyecto. Solo darle espacio a este paso.', 'You don’t need to finish the whole project. Just make room for this step.')}</p>
      {focus.linkedNote && <span className="daily-focus-source">{focus.linkedNote.title}</span>}
      {focus.sourceMissing && <p className="daily-focus-source-warning">{copy('El paso original ya no está disponible. Puedes completar este objetivo de forma independiente.', 'The original step is unavailable. You can complete this goal independently.')}</p>}
      {!focus.complete && !focus.closed && <>
        {sessionState === 'finished' ? <div className="daily-focus-result" role="status"><span><Sun size={20} /></span><strong>{savedMinutes && savedMinutes > 0 ? copy(`${savedMinutes} minutos cultivados`, `${savedMinutes} focused minutes`) : copy('Sesión breve completada', 'Short session completed')}</strong><p>{savedMinutes && savedMinutes > 0 ? copy('Tu tiempo quedó guardado en el día de hoy.', 'Your focused time was saved to today.') : copy('Terminaste antes del primer minuto. Puedes empezar otra cuando quieras.', 'You ended before the first full minute. Start another whenever you are ready.')}</p></div> : <div className="daily-focus-clock" role="timer" aria-label={copy('Tiempo restante', 'Time remaining')}>{String(Math.floor(remaining / 60)).padStart(2, '0')}<span>:</span>{String(remaining % 60).padStart(2, '0')}</div>}
        {(sessionState === 'ready' || sessionState === 'finished') && <div className="daily-focus-durations" role="group" aria-label={copy('Duración de la sesión', 'Session duration')}>{[5, 10, 25].map(minutes => <button type="button" key={minutes} aria-pressed={duration === minutes} onClick={() => { setDuration(minutes); setRemaining(minutes * 60); }}>{minutes} min</button>)}</div>}
        {sessionState === 'active' ? <div className="daily-focus-session-actions"><button type="button" className="daily-focus-action-primary" onClick={pause}><Pause size={17} />{copy('Pausar', 'Pause')}</button><button type="button" className="daily-focus-action-secondary" onClick={saveSession}><Square size={15} />{copy('Terminar', 'End')}</button></div> : sessionState === 'paused' ? <div className="daily-focus-session-actions"><button type="button" className="daily-focus-action-primary" onClick={resume}><Play size={17} />{copy('Continuar', 'Resume')}</button><button type="button" className="daily-focus-action-secondary" onClick={saveSession}><Square size={15} />{copy('Terminar', 'End')}</button></div> : <button type="button" className="daily-focus-action-primary daily-focus-start" onClick={start}>{sessionState === 'finished' ? <RotateCcw size={17} /> : <Play size={17} />}{sessionState === 'finished' ? copy('Comenzar otra sesión', 'Start another session') : copy('Empezar sesión', 'Start session')}</button>}
      </>}
      {!focus.closed && <button type="button" className={'daily-focus-complete' + (focus.complete ? ' is-done' : '')} onClick={() => { saveSession(); onToggleComplete(); }}>{focus.complete ? <CheckCircle2 size={21} /> : <Circle size={21} />}{focus.complete ? copy('Labor realizada · marcar pendiente', 'Task done · mark pending') : copy('Ya hice esta labor', 'I’ve done this task')}</button>}
      {focus.complete && <button type="button" className="dashboard-primary-button daily-focus-start" onClick={onExit}><Sun size={18} />{copy('Volver a mi día', 'Back to my day')}</button>}
      {focus.closed && <p className="daily-focus-status"><Check size={16} />{copy('Este día ya está cerrado.', 'This day is already closed.')}</p>}
      {paused && <p className="daily-focus-status" role="status"><Clock size={15} />{copy('El tiempo está en pausa.', 'The timer is paused.')}</p>}
      </div>
      </div>
    </div>}
  </section>;
}
