import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Menu } from "lucide-react";

import type { AppLanguage } from "../../app/i18n";
import type { DraftTodo } from "../notes/composerTypes";

export function ProjectTodoDraftRow({
  todo,
  index,
  total,
  appLanguage,
  onToggle,
  onChange,
  onEnter,
  onRemove,
  onFocus,
}: {
  todo: DraftTodo;
  index: number;
  total: number;
  appLanguage: AppLanguage;
  onToggle: (id: string) => void;
  onChange: (id: string, text: string) => void;
  onEnter: (id: string) => void;
  onRemove: (id: string) => void;
  onFocus: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });
  const verticalTransform = transform
    ? { ...transform, x: 0, scaleX: 1, scaleY: 1 }
    : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(verticalTransform),
        transition,
        zIndex: isDragging ? 80 : undefined,
        boxShadow: isDragging ? "0 14px 34px rgba(0,0,0,0.14)" : undefined,
        willChange: isDragging ? "transform" : undefined,
      }}
      data-project-todo-row
      className={`relative flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--surface-strong)]/72 px-2.5 py-1.5 shadow-sm ring-1 ring-[var(--border)] ${
        isDragging ? "scale-[1.008]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(todo.id)}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
          todo.completed
            ? "border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)]"
            : "border-[var(--text-muted)]/38 text-transparent"
        }`}
        aria-label={appLanguage === "en" ? "Mark garden task" : "Marcar labor"}
      >
        <CheckCircle2 size={14} />
      </button>
      <input
        data-project-todo-id={todo.id}
        value={todo.text}
        onChange={(event) => onChange(todo.id, event.target.value)}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter(todo.id);
          }
          if (event.key === "Backspace" && !todo.text && total > 1) {
            event.preventDefault();
            onRemove(todo.id);
          }
        }}
        placeholder={
          index === 0
            ? appLanguage === "en"
              ? "First garden task"
              : "Primera labor"
            : appLanguage === "en"
              ? "Next garden task"
              : "Siguiente labor"
        }
        className={`min-w-0 flex-1 bg-transparent text-[1.03rem] font-medium leading-6 text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/45 ${
          todo.completed ? "line-through opacity-50" : ""
        }`}
      />
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="grid h-8 w-8 shrink-0 touch-none place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--earth)] active:scale-95 active:cursor-grabbing"
        aria-label={
          appLanguage === "en"
            ? "Drag to reorder task"
            : "Arrastrar para ordenar labor"
        }
      >
        <Menu size={17} />
      </button>
    </div>
  );
}
