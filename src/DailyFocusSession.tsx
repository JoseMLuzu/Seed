import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Circle, Clock, Play, Square, Sun } from 'lucide-react';
import { gardenName } from './gardenVocabulary';
import { GardenMotif } from './GardenMotif';
import { getDailyFocusState } from './dailyFocus';
import { startFocusLiveActivity, stopFocusLiveActivity } from './native/liveActivity';
import type { SeedNote } from './types';
import './styles/dailyFocus.css';

export function DailyFocusSession({ entry, notes, language, onToggleComplete, onLogMinutes, onExit }: {
  entry?: SeedNote; notes: SeedNote[]; language: 'es' | 'en';
  onToggleComplete: () => void; onLogMinutes: (minutes: number) => void; onExit: () => void;
}) {
  const copy = (es: string, en: string) => language === 'en' ? en : es;
  const focus = getDailyFocusState(entry, notes);
  const [duration, setDuration] = useState(10);
  const [remaining, setRemaining] = useState(600);
  const [active, setActive] = useState(false);
  const [savedMinutes, setSavedMinutes] = useState<number | null>(null);
  const session = useRef<{ startedAt: number; endsAt: number; minutes: number } | null>(null);
  const logRef = useRef(onLogMinutes);
  logRef.current = onLogMinutes;

  const saveSession = useCallback(() => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    const minutes = Math.min(current.minutes, Math.max(0, Math.floor((Date.now() - current.startedAt) / 60_000)));
    if (minutes > 0) logRef.current(minutes);
    setActive(false);
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
    const timer = window.setInterval(tick, 500);
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
    const minutes = Math.min(current.minutes, Math.max(0, Math.floor((Date.now() - current.startedAt) / 60_000)));
    if (minutes > 0) logRef.current(minutes);
    void stopFocusLiveActivity();
  }, []);

  const start = () => {
    if (!entry || !focus.intention || focus.closed || focus.complete) return;
    const startedAt = Date.now();
    session.current = { startedAt, endsAt: startedAt + duration * 60_000, minutes: duration };
    setRemaining(duration * 60);
    setSavedMinutes(null);
    setActive(true);
    void startFocusLiveActivity({ noteId: entry.id, title: focus.intention, subtitle: copy('Solo tu objetivo de hoy.', 'Just today’s goal.'), endTimestamp: session.current.endsAt, progress: 0 });
  };

  return <section className="daily-focus-session" aria-labelledby="daily-focus-heading">
    <button type="button" className="daily-focus-back" onClick={() => { saveSession(); onExit(); }}><ArrowLeft size={18} />{copy('Volver a mi paseo', 'Back to my walk')}</button>
    {!focus.intention ? <div className="daily-focus-room"><h1 id="daily-focus-heading">{copy('Elige tu labor de hoy.', 'Choose today’s task.')}</h1><p>{copy('Puedes elegirla desde tu paseo. Tus notas siguen en su lugar.', 'Choose it from your dashboard. Your notes are still safe.')}</p></div> : <div className="daily-focus-room" data-complete={focus.complete}>
      <span className="dashboard-eyebrow">{gardenName('focus', language)}</span>
      <GardenMotif stage={focus.complete ? 'bloom' : active ? 'sprout' : 'seed'} className="daily-focus-plant" />
      <h1 id="daily-focus-heading">{focus.complete ? copy('Lo que elegiste hoy, logrado.', 'Today’s chosen goal, achieved.') : focus.intention}</h1>
      {focus.complete && <p className="daily-focus-achieved">{focus.intention}</p>}
      <p>{focus.complete ? copy('Ese paso cuenta. El resto del proyecto puede esperar.', 'This step counts. The rest of the project can wait.') : copy('No necesitas terminar todo el proyecto. Solo darle espacio a este paso.', 'You don’t need to finish the whole project. Just make room for this step.')}</p>
      {focus.linkedNote && <span className="daily-focus-source">{focus.linkedNote.title}</span>}
      {focus.sourceMissing && <p className="daily-focus-source-warning">{copy('El paso original ya no está disponible. Puedes completar este objetivo de forma independiente.', 'The original step is unavailable. You can complete this goal independently.')}</p>}
      {!focus.complete && !focus.closed && <>
        <div className="daily-focus-clock" role="timer" aria-label={copy('Tiempo restante', 'Time remaining')}>{String(Math.floor(remaining / 60)).padStart(2, '0')}<span>:</span>{String(remaining % 60).padStart(2, '0')}</div>
        {!active && <div className="daily-focus-durations" role="group" aria-label={copy('Duración de la sesión', 'Session duration')}>{[5, 10, 25].map(minutes => <button type="button" key={minutes} aria-pressed={duration === minutes} onClick={() => { setDuration(minutes); setRemaining(minutes * 60); }}>{minutes} min</button>)}</div>}
        <button type="button" className="dashboard-primary-button daily-focus-start" onClick={active ? saveSession : start}>{active ? <Square size={16} /> : <Play size={17} />}{active ? copy('Guardar sesión', 'Save session') : copy('Empezar sesión', 'Start session')}</button>
      </>}
      {!focus.closed && <button type="button" className={'daily-focus-complete' + (focus.complete ? ' is-done' : '')} onClick={() => { saveSession(); onToggleComplete(); }}>{focus.complete ? <CheckCircle2 size={21} /> : <Circle size={21} />}{focus.complete ? copy('Labor realizada · marcar pendiente', 'Task done · mark pending') : copy('Ya hice esta labor', 'I’ve done this task')}</button>}
      {focus.complete && <button type="button" className="dashboard-primary-button daily-focus-start" onClick={onExit}><Sun size={18} />{copy('Volver a mi día', 'Back to my day')}</button>}
      {focus.closed && <p className="daily-focus-status"><Check size={16} />{copy('Este día ya está cerrado.', 'This day is already closed.')}</p>}
      {savedMinutes !== null && <p className="daily-focus-status" role="status"><Clock size={15} />{savedMinutes > 0 ? copy(`${savedMinutes} min de enfoque guardados.`, `${savedMinutes} focused min saved.`) : copy('Sesión terminada. Aún no transcurrió un minuto completo.', 'Session ended. Less than a full minute elapsed.')}</p>}
    </div>}
  </section>;
}
