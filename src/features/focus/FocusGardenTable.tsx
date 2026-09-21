import { memo, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Leaf,
  Lightbulb,
  ListChecks,
  NotebookPen,
  Plus,
  X,
} from "lucide-react";
import type { AppLanguage } from "../../app/i18n";
import type { Task } from "../../types";

export const FocusGardenTable = memo(function FocusGardenTable({
  language,
  compact = false,
  mobileCollapsed = false,
  onMobileToggle,
  sourceName,
  note,
  tasks,
  onNoteChange,
  onToggleTask,
  onQuickCapture,
}: {
  language: AppLanguage;
  compact?: boolean;
  mobileCollapsed?: boolean;
  onMobileToggle?: () => void;
  sourceName: string;
  note: string;
  tasks: Task[];
  onNoteChange: (value: string) => void;
  onToggleTask: (taskId: string) => void;
  onQuickCapture: (value: string) => void;
}) {
  const copy = (es: string, en: string) => (language === "en" ? en : es);
  const reduceMotion = useReducedMotion();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capture, setCapture] = useState("");
  const [saved, setSaved] = useState(false);
  const date = useMemo(() => new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-EC", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date()), [language]);

  const saveCapture = () => {
    const value = capture.trim();
    if (!value) return;
    onQuickCapture(value);
    setCapture("");
    setSaved(true);
  };

  return (
    <motion.section
      layout={!reduceMotion}
      transition={{ layout: { duration: reduceMotion ? 0 : 0.52, ease: [0.22, 1, 0.36, 1] } }}
      className={`focus-garden-table${compact ? " is-compact" : ""}${mobileCollapsed ? " is-mobile-collapsed" : ""}`}
      aria-label={copy("Mesa del jardinero", "Gardener's table")}
    >
      <div className="focus-garden-table-header">
        <span className="focus-garden-table-pin" aria-hidden="true" />
        <div>
          <span><Leaf size={13} />{copy("Mesa del jardinero", "Gardener's table")}</span>
          <strong>{sourceName}</strong>
        </div>
        <time><CalendarDays size={14} />{date}</time>
        {!compact && onMobileToggle && (
          <button
            type="button"
            className="focus-garden-mobile-toggle"
            onClick={onMobileToggle}
            aria-expanded={!mobileCollapsed}
            aria-label={mobileCollapsed ? copy("Abrir mesa", "Open table") : copy("Cerrar mesa", "Close table")}
          >
            {mobileCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        )}
      </div>

      <AnimatePresence initial={false} mode="popLayout">
      {compact ? (
        <motion.div
          key="table-preview"
          className="focus-garden-table-preview"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          <span><ListChecks size={16} />{copy("Lista para cultivar", "Ready to cultivate")}</span>
          <strong>{tasks.find((task) => !task.completed)?.text || tasks[0]?.text || copy("Tu labor de hoy", "Today's task")}</strong>
          <p>{copy(
            "Tus notas, labores y captura rápida aparecerán al comenzar.",
            "Your notes, tasks, and quick capture will appear when you start.",
          )}</p>
        </motion.div>
      ) : <motion.div
        key="table-expanded"
        className="focus-garden-table-expanded"
        initial={{ opacity: 0, scaleY: reduceMotion ? 1 : 0.96 }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.34, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
      <motion.div
        className="focus-garden-table-grid"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : 0.18 }}
      >
        <label className="focus-garden-note">
          <span><NotebookPen size={15} />{copy("Nota de enfoque", "Focus note")}</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            placeholder={copy(
              "Anota una decisión o algo que no quieras olvidar…",
              "Write down a decision or something you don't want to forget…",
            )}
          />
          <small>{copy("Se guarda automáticamente", "Saved automatically")}</small>
        </label>

        <div className="focus-garden-tasks">
          <span><ListChecks size={15} />{copy("A mano", "At hand")}</span>
          {tasks.length ? (
            <ul>
              {tasks.slice(0, 3).map((task) => (
                <li key={task.id} className={task.completed ? "is-done" : ""}>
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    aria-label={task.completed ? copy("Marcar pendiente", "Mark pending") : copy("Completar labor", "Complete task")}
                  >
                    {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <span>{task.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{copy("Nada más compite por tu atención.", "Nothing else is competing for your attention.")}</p>
          )}
        </div>
      </motion.div>

      <motion.div
        className="focus-garden-capture"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.25 }}
      >
        {!captureOpen ? (
          <button type="button" onClick={() => { setCaptureOpen(true); setSaved(false); }}>
            <Lightbulb size={15} />{copy("Captura rápida", "Quick capture")}
          </button>
        ) : (
          <div>
            <Lightbulb size={15} />
            <input
              autoFocus
              value={capture}
              onChange={(event) => { setCapture(event.target.value); setSaved(false); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveCapture();
                }
              }}
              placeholder={copy("Guarda una idea para después…", "Save a thought for later…")}
            />
            {saved && <span><Check size={14} />{copy("Guardada", "Saved")}</span>}
            <button type="button" onClick={saveCapture} disabled={!capture.trim()} aria-label={copy("Guardar semilla", "Save seed")}><Plus size={16} /></button>
            <button type="button" onClick={() => setCaptureOpen(false)} aria-label={copy("Cerrar captura", "Close capture")}><X size={16} /></button>
          </div>
        )}
      </motion.div>
      </motion.div>}
      </AnimatePresence>
    </motion.section>
  );
});
