import { gardenName } from './gardenVocabulary';
import { useEffect, useMemo, useState } from 'react';
import { Box, CalendarDays, ChevronDown, ChevronRight, Flag, Pencil, Sparkles, Check, X } from 'lucide-react';
import type { SeedNote } from './types';
import { localDateKey } from './seedLogic';
import { getUpcomingItems } from './upcoming';
import { NoteCareStatus } from './NoteCareStatus';
import { parseLocalDueDate } from './dashboardInsights';
import './styles/upcoming.css';

type Filter = 'all' | 'dates' | 'important';

export function UpcomingPanel({ notes, language, onSelectNote, onOpenCalendar, onUpdateNote }: {
  notes: SeedNote[];
  language: 'es' | 'en';
  onSelectNote: (id: string) => void;
  onOpenCalendar: () => void;
  onUpdateNote: (id: string, updates: Partial<SeedNote>) => void;
}) {
  const [now, setNow] = useState(Date.now);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState('');
  const en = language === 'en';
  const copy = (es: string, english: string) => en ? english : es;
  const locale = en ? 'en-US' : 'es-EC';
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);
  const items = useMemo(() => getUpcomingItems(notes, now), [notes, now]);
  const filtered = items.filter(item => filter === 'all' || (filter === 'dates' ? item.dueSoon : item.important));
  const visible = expanded ? filtered : filtered.slice(0, 3);
  const overdue = items.filter(item => item.daysUntilDue !== null && item.daysUntilDue < 0).length;
  const groupLabel = (days: number | null) => days === null ? copy('SIN FECHA · IMPORTANTES', 'NO DATE · IMPORTANT') : days < 0 ? copy('FECHAS VENCIDAS', 'OVERDUE DATES') : days === 0 ? copy('HOY', 'TODAY') : days <= 7 ? copy('PRÓXIMOS 7 DÍAS', 'NEXT 7 DAYS') : copy('MÁS ADELANTE · IMPORTANTES', 'LATER · IMPORTANT');
  const dateLabel = (days: number | null, timestamp?: number) => {
    if (days === null) return copy('Sin fecha', 'No date');
    if (days < 0) return days === -1 ? copy('Venció ayer', 'Due yesterday') : copy('Hace ' + Math.abs(days) + ' días', Math.abs(days) + ' days overdue');
    if (days === 0) return copy('Hoy', 'Today');
    if (days === 1) return copy('Mañana', 'Tomorrow');
    if (days <= 7) return copy('En ' + days + ' días', 'In ' + days + ' days');
    return new Date(timestamp!).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(new Date(timestamp!).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' as const } : {}) });
  };

  return (
    <section className="dashboard-upcoming" aria-labelledby="dashboard-upcoming-heading">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-eyebrow">{copy('LO QUE VIENE', 'WHAT’S AHEAD')}</p>
          <h2 id="dashboard-upcoming-heading">{gardenName('upcoming', language)}<span className="upcoming-count">{items.length}</span></h2>
        </div>
        <button type="button" className="dashboard-text-button upcoming-calendar" onClick={onOpenCalendar} title={gardenName('calendar', language)}><CalendarDays size={16} />{copy('Calendario', 'Calendar')}<ChevronRight size={14} /></button>
      </div>
      <div className="upcoming-panel">
        <div className="upcoming-intro">
          <span>{copy('Próximos 7 días y tus prioridades.', 'The next 7 days and your priorities.')}</span>
          {overdue > 0 && <span className="upcoming-overdue-summary">{overdue} {copy(overdue === 1 ? 'fecha vencida' : 'fechas vencidas', overdue === 1 ? 'overdue' : 'overdue')}</span>}
        </div>
        {items.length > 0 && <div className="upcoming-filters" role="group" aria-label={copy('Filtrar próximos elementos', 'Filter upcoming items')}>
          {([
            { id: 'all', label: copy('Todo', 'All'), count: items.length },
            { id: 'dates', label: copy('Con fecha', 'Due soon'), count: items.filter(item => item.dueSoon).length },
            { id: 'important', label: copy('Importantes', 'Important'), count: items.filter(item => item.important).length },
          ] as const).map(option => <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => { setFilter(option.id); setExpanded(false); }}>{option.label}<span>{option.count}</span></button>)}
        </div>}
        {visible.length > 0 ? <ul id="dashboard-upcoming-list" className="upcoming-list">
          {visible.map(({ note, daysUntilDue, important }, index) => {
            const project = note.isGrowth && !note.inbox;
            const expired = daysUntilDue !== null && daysUntilDue < 0;
            const dueToday = daysUntilDue === 0;
            const date = daysUntilDue !== null ? new Date(note.dueDate!) : null;
            const nextTask = project ? note.tasks.find(task => !task.completed) : undefined;
            const group = groupLabel(daysUntilDue);
            return <li key={note.id}>
              {(index === 0 || groupLabel(visible[index - 1].daysUntilDue) !== group) && <p className="upcoming-group-heading">{group}</p>}
              <button type="button" className={`upcoming-row ${expired ? 'is-overdue' : dueToday ? 'is-today' : ''}`} onClick={() => onSelectNote(note.id)}>
                <span className="upcoming-date-tile" aria-hidden="true">{date ? <><strong>{date.getDate()}</strong><small>{date.toLocaleDateString(locale, { month: 'short' })}</small></> : <Flag size={20} strokeWidth={1.6} />}</span>
                <span className="upcoming-note">
                  <strong>{note.title || copy('Sin título', 'Untitled')}</strong>
                  <span className="upcoming-note-meta"><span>{project ? <Box size={13} /> : <Pencil size={13} />}{gardenName(project ? 'project' : 'note', language, true)}</span>{project && note.tasks.length > 0 && <span>{note.tasks.filter(task => task.completed).length}/{note.tasks.length} {gardenName('task', language).toLocaleLowerCase()}</span>}{important && <span className="upcoming-important"><Flag size={11} />{copy('Importante', 'Important')}</span>}<NoteCareStatus note={note} language={language} now={now} /></span>
                  {nextTask && <span className="upcoming-next-step">{copy('Siguiente: ', 'Next: ')}{nextTask.text}</span>}
                </span>
                <span className="upcoming-due">{date ? <time dateTime={localDateKey(note.dueDate!)} title={date.toLocaleDateString(locale, { dateStyle: 'full' })}>{dateLabel(daysUntilDue, note.dueDate)}</time> : <span>{dateLabel(null)}</span>}</span>
                <ChevronRight className="upcoming-row-arrow" size={16} />
              </button>
              {editingId === note.id ? <form className="upcoming-date-editor" onSubmit={event => { event.preventDefault(); const date = parseLocalDueDate(dateDraft); if (date !== null) { onUpdateNote(note.id, { dueDate: date }); setEditingId(null); } }}>
                <label><span>{copy('Fecha para ', 'Date for ')}{note.title}</span><input type="date" required autoFocus value={dateDraft} onChange={event => setDateDraft(event.target.value)} /></label>
                <div><button type="submit" className="dashboard-text-button" disabled={parseLocalDueDate(dateDraft) === null}><Check size={15} />{copy('Guardar', 'Save')}</button>{date && <button type="button" className="dashboard-text-button" onClick={() => { onUpdateNote(note.id, { dueDate: undefined }); setEditingId(null); }}>{copy('Quitar fecha', 'Remove date')}</button>}<button type="button" className="dashboard-icon-button" onClick={() => setEditingId(null)} aria-label={copy('Cancelar cambio de fecha', 'Cancel date change')}><X size={16} /></button></div>
              </form> : <div className="upcoming-row-actions"><button type="button" className="dashboard-text-button" onClick={() => { setEditingId(note.id); setDateDraft(date ? localDateKey(note.dueDate!) : ''); }} aria-label={(date ? copy('Reprogramar ', 'Reschedule ') : copy('Asignar fecha a ', 'Set date for ')) + note.title}><CalendarDays size={13} />{date ? copy('Reprogramar', 'Reschedule') : copy('Asignar fecha', 'Set date')}</button></div>}
            </li>;
          })}
        </ul> : <div className="upcoming-empty">
          <span><Sparkles size={22} strokeWidth={1.5} /></span>
          <div><h3>{items.length ? copy('Nada en este filtro.', 'Nothing in this filter.') : copy('Un poco de espacio por delante.', 'A little room ahead.')}</h3><p>{items.length ? copy('Prueba con Todo para ver tus otros pendientes.', 'Choose All to see your other items.') : copy('Asigna una fecha o marca una nota o proyecto como importante. Aparecerá aquí automáticamente.', 'Set a date or mark a note or project as important. It will appear here automatically.')}</p></div>
        </div>}
        {filtered.length > 3 && <button type="button" className="upcoming-show-more" aria-expanded={expanded} aria-controls="dashboard-upcoming-list" onClick={() => setExpanded(current => !current)}>{expanded ? copy('Ver menos', 'Show less') : copy('Ver ' + (filtered.length - 3) + ' más', 'Show ' + (filtered.length - 3) + ' more')}<ChevronDown size={15} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} /></button>}
      </div>
    </section>
  );
}
