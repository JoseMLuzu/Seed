/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { startFocusLiveActivity, stopFocusLiveActivity, updateFocusLiveActivity } from './native/liveActivity';
import { updateSeedWidget } from './native/widget';
import { 
  Plus, 
  Search, 
  Cloud,
  Clock,
  Leaf, 
  Sprout, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  ArrowRight,
  TrendingUp,
  X,
  Calendar as CalendarIcon,
  Tag,
  Flag,
  ListChecks,
  Skull,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  LayoutGrid,
  Box,
  Settings,
  Droplets,
  Pause,
  Archive,
  Inbox,
  Target,
  Download,
  Sparkles,
  Star,
  User,
  Maximize2,
  MoreHorizontal,
  type LucideIcon
} from 'lucide-react';
import { Theme, SeedNote, Planet } from './types';
import { addFocusMinutes, DAY_MS, daysSince, toggleTaskForNote, wateringDue, waterNote as waterSeedNote } from './seedLogic';
import { loadNotesFromDb, migrateLocalNotesToDb, saveNotesToDb } from './storage';
import { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import { deleteNoteFromSupabase, deletePlanetFromSupabase, pushGardenToSupabase, syncGardenWithSupabase } from './supabaseSync';
import { normalizeNote, normalizeNotes } from './normalize';
import { playSeedSound, preloadSeedSounds, unlockSeedAudio, type SeedSoundKind } from './sound';

const Garden3D = lazy(() => import('./components/Garden3D'));

type AccountProfile = {
  name: string;
  email: string;
  role: string;
  purpose?: string;
  mantra?: string;
};

type AppView = 'today' | 'inbox' | 'projects' | 'focus' | 'garden' | 'profile' | 'harvest' | 'calendar' | '3D';
type AppLanguage = 'es' | 'en';
type CreateMode = 'seed' | 'sprout' | 'journal';
type TodayWidgetId = 'summary' | 'watering' | 'path' | 'learning';
type QuickEntryPicker = 'type' | 'priority' | 'garden' | null;
type DraftTodo = { id: string; text: string; completed: boolean };
type SettingsPage = 'root' | 'profile' | 'appearance' | 'today' | 'watering' | 'data';

const DEFAULT_TODAY_WIDGETS: TodayWidgetId[] = ['watering'];
const TODAY_WIDGET_IDS = new Set<TodayWidgetId>(['summary', 'watering', 'path', 'learning']);
const IDEA_CARD_RADIUS = 'rounded-[1.35rem]';
const IDEA_CARD_WRAPPER = `${IDEA_CARD_RADIUS} bg-[var(--surface-strong)]`;
const IDEA_CARD_SURFACE = `group relative overflow-hidden ${IDEA_CARD_RADIUS} bg-[var(--surface-strong)] shadow-sm ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]`;
const IDEA_CARD_ROW = 'flex min-h-[4.45rem] w-full items-start gap-3 px-4 py-3 text-left';
const IDEA_ICON_TILE = 'relative grid h-10 w-10 shrink-0 place-items-center rounded-[1rem] ring-1';

function detectDeviceLanguage(): AppLanguage {
  const languages = typeof navigator !== 'undefined'
    ? [navigator.language, ...(navigator.languages || [])]
    : [];
  return languages.some(language => language?.toLowerCase().startsWith('en')) ? 'en' : 'es';
}

const appLanguage = detectDeviceLanguage();
const appDateLocale = appLanguage === 'en' ? enUS : es;
const appCopy = {
  es: {
    today: 'Hoy',
    seeds: 'Semillas',
    sprouts: 'Brotes',
    garden: 'Jardín',
    planet: 'Planeta',
    path: 'Camino',
    profile: 'Perfil',
    settings: 'Ajustes',
    cancel: 'Cancelar',
    plant: 'Plantar',
    newSeed: 'Nueva semilla',
    options: 'Opciones',
    date: 'Fecha',
    goodMorning: 'Buenos días',
    goodAfternoon: 'Buenas tardes',
    goodEvening: 'Buenas noches',
    streak: 'racha',
    activeDays: 'días activos',
    now: 'Ahora',
    waterNow: 'Regar ahora',
    focus: 'Enfocar',
    viewSeeds: 'Ver semillas',
    openGarden: 'Abrir jardín',
    quietGarden: 'Tu jardín está tranquilo',
    captureIdea: 'Captura una idea cuando aparezca',
    seedWaiting: 'Hay una semilla esperando forma',
    noPressure: 'Sin presión: una revisión basta',
    wateringUpToDate: 'Riego al día',
    wateringQueue: 'por regar',
    monthPath: 'Mira el mes y los días activos',
    quietDay: 'Día tranquilo',
    noActivity: 'Sin actividad',
    plantedSeed: 'Semilla plantada',
    ideaCreated: 'Idea creada',
    wateredIdea: 'Idea regada',
    advancedIdea: 'Idea avanzada',
    harvestDone: 'Cosecha lograda',
    dueDate: 'Fecha objetivo',
    pendingSeeds: 'ideas por decidir',
    noPendingSeeds: 'Sin semillas pendientes',
    plusReady: 'El botón + siempre está listo para una idea.',
    readyToDecide: 'Lista para decidir.',
    done: 'Hecho',
    project: 'Proyecto',
    later: 'Guardar para después',
    delete: 'Eliminar',
  },
  en: {
    today: 'Today',
    seeds: 'Seeds',
    sprouts: 'Sprouts',
    garden: 'Garden',
    planet: 'Planet',
    path: 'Path',
    profile: 'Profile',
    settings: 'Settings',
    cancel: 'Cancel',
    plant: 'Plant',
    newSeed: 'New seed',
    options: 'Options',
    date: 'Date',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    streak: 'streak',
    activeDays: 'active days',
    now: 'Now',
    waterNow: 'Water now',
    focus: 'Focus',
    viewSeeds: 'View seeds',
    openGarden: 'Open garden',
    quietGarden: 'Your garden is calm',
    captureIdea: 'Capture an idea when it appears',
    seedWaiting: 'A seed is waiting to take shape',
    noPressure: 'No pressure: one review is enough',
    wateringUpToDate: 'Watering is up to date',
    wateringQueue: 'to water',
    monthPath: 'See the month and active days',
    quietDay: 'Quiet day',
    noActivity: 'No activity',
    plantedSeed: 'Seed planted',
    ideaCreated: 'Idea created',
    wateredIdea: 'Idea watered',
    advancedIdea: 'Idea advanced',
    harvestDone: 'Harvest completed',
    dueDate: 'Due date',
    pendingSeeds: 'ideas to decide',
    noPendingSeeds: 'No pending seeds',
    plusReady: 'The + button is always ready for an idea.',
    readyToDecide: 'Ready to decide.',
    done: 'Done',
    project: 'Project',
    later: 'Save for later',
    delete: 'Delete',
  },
} as const;

function t(key: keyof typeof appCopy.es) {
  return appCopy[appLanguage][key];
}

function formatMonthYear(date: number | Date) {
  return format(date, 'MMMM yyyy', { locale: appDateLocale });
}

function formatDayMonth(date: number | Date) {
  return appLanguage === 'en'
    ? format(date, 'MMMM d', { locale: appDateLocale })
    : format(date, "d 'de' MMMM", { locale: appDateLocale });
}

function formatShortDate(date: number | Date) {
  return format(date, 'd MMM', { locale: appDateLocale });
}

function dateInputToEndOfDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function timestampToDateInput(value: number) {
  return format(new Date(value), 'yyyy-MM-dd');
}

function getStoredItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private contexts; app state should still work in memory.
  }
}

function removeStoredItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

function getStoredNumber(key: string, fallback: number, min = -Infinity, max = Infinity) {
  const value = Number(getStoredItem(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function getStoredBoolean(key: string, fallback: boolean) {
  const value = getStoredItem(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'earth', label: 'Pradera', icon: '🌾' },
  { id: 'forest', label: 'Bosque', icon: '🌲' },
  { id: 'bloom', label: 'Floración', icon: '🌸' },
  { id: 'night', label: 'Nocturno', icon: '🌙' },
  { id: 'jungle', label: 'Jungla', icon: '🌴' },
  { id: 'alien', label: 'Alien', icon: '🪐' },
  { id: 'desert', label: 'Desierto', icon: '🌵' },
  { id: 'arctic', label: 'Ártico', icon: '❄️' },
];

const DEFAULT_PLANET_ID = 'personal';

const DEFAULT_PLANETS: Planet[] = [
  { id: DEFAULT_PLANET_ID, name: 'Personal', description: 'Ideas de vida, habitos y pendientes propios.', theme: 'earth', createdAt: 0 },
];
const LEGACY_DEFAULT_PLANET_IDS = new Set(['work', 'study']);
const THEME_IDS = new Set(THEMES.map(theme => theme.id));

function normalizePlanets(values: unknown): Planet[] {
  if (!Array.isArray(values)) return [];

  return values.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const raw = value as Partial<Planet>;
    if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return [];
    return [{
      id: raw.id,
      name: raw.name.trim() || 'Personal',
      description: typeof raw.description === 'string' ? raw.description : '',
      theme: raw.theme && THEME_IDS.has(raw.theme) ? raw.theme : 'earth',
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
    }];
  });
}

function touchNote(note: SeedNote, timestamp = Date.now()): SeedNote {
  return { ...note, updatedAt: timestamp };
}

function touchPlanet(planet: Planet, timestamp = Date.now()): Planet {
  return { ...planet, updatedAt: timestamp };
}

function noteUpdatedAt(note: SeedNote) {
  return note.updatedAt || note.createdAt || 0;
}

const SEED_TYPES: { id: NonNullable<SeedNote['seedType']>; label: string; task: string }[] = [
  { id: 'idea', label: 'Idea', task: 'Aclarar por qué vale la pena cultivar esta idea' },
  { id: 'project', label: 'Proyecto', task: 'Definir el primer entregable pequeño' },
  { id: 'goal', label: 'Meta', task: 'Elegir una acción medible para esta semana' },
  { id: 'learning', label: 'Aprendizaje', task: 'Practicar o resumir el primer concepto' },
];

const PRIORITY_OPTIONS: {
  id: NonNullable<SeedNote['priority']>;
  label: string;
  labelEn: string;
  detail: string;
  detailEn: string;
}[] = [
  { id: 'light', label: 'Ligera', labelEn: 'Light', detail: 'Puede esperar', detailEn: 'Can wait' },
  { id: 'normal', label: 'Normal', labelEn: 'Normal', detail: 'Ritmo natural', detailEn: 'Natural pace' },
  { id: 'important', label: 'Importante', labelEn: 'Important', detail: 'Sube en Hoy', detailEn: 'Rises in Today' },
];

function priorityWeight(note: SeedNote) {
  return note.priority === 'important' ? 8 : note.priority === 'light' ? -3 : 0;
}

function priorityLabel(option: (typeof PRIORITY_OPTIONS)[number]) {
  return appLanguage === 'en' ? option.labelEn : option.label;
}

function priorityDetail(option: (typeof PRIORITY_OPTIONS)[number]) {
  return appLanguage === 'en' ? option.detailEn : option.detail;
}

const ONBOARDING_STEPS = [
  {
    icon: Leaf,
    eyebrow: 'Captura',
    title: 'Planta',
    text: 'Guarda una idea en una línea. Sin categoría, fecha ni proyecto.',
    action: 'Captura ahora. Decide después.',
    detail: 'El semillero existe para ideas incompletas.',
  },
  {
    icon: Droplets,
    eyebrow: 'Riega',
    title: 'Vuelve',
    text: 'Seed te muestra una cosa viva: regar, avanzar o decidir.',
    action: 'Una acción clara.',
    detail: 'No hace falta ordenar toda tu vida.',
  },
  {
    icon: CheckCircle2,
    eyebrow: 'Cosecha',
    title: 'Recuerda',
    text: 'Lo terminado deja una huella visual y, si quieres, una lección breve.',
    action: 'Tu progreso se vuelve visible.',
    detail: 'El jardín crece porque tú avanzaste.',
  },
];

const PROFILE_PURPOSES = [
  'Trabajo',
  'Estudios',
  'Proyectos creativos',
  'Ideas personales',
  'Todo un poco',
];

const PROFILE_PURPOSE_OPTIONS = PROFILE_PURPOSES.map(purpose => ({ value: purpose, label: purpose }));

const THEME_SELECT_OPTIONS = THEMES.map(item => ({
  value: item.id,
  label: `${item.icon} ${item.label}`,
  description: item.id === 'earth' ? 'Claro y tranquilo' : item.id === 'forest' ? 'Profundo y natural' : item.id === 'bloom' ? 'Creativo y luminoso' : item.id === 'night' ? 'Calma nocturna' : item.id === 'jungle' ? 'Vivo y explorador' : item.id === 'alien' ? 'Experimental' : item.id === 'desert' ? 'Minimal y cálido' : 'Limpio y sereno',
}));

const WATERING_INTERVAL_OPTIONS = [
  { value: '1', label: 'Diario', description: 'Ideas importantes' },
  { value: '3', label: 'Cada 3 días', description: 'Equilibrado' },
  { value: '7', label: 'Semanal', description: 'Baja presión' },
];

type AppSelectOption = {
  value: string;
  label: string;
  description?: string;
};

function AppSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Seleccionar',
  ariaLabel,
}: {
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState({ left: 0, top: 0, width: 0, maxHeight: 288, y: 6 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const selected = options.find(option => option.value === value);
  const updateMenuLayout = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 8;
    const margin = 12;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < 190 && spaceAbove > spaceBelow;
    const available = Math.max(150, Math.min(288, (openUp ? spaceAbove : spaceBelow) - gap));
    setMenuLayout({
      left: Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin)),
      top: openUp ? Math.max(margin, rect.top - available - gap) : Math.min(rect.bottom + gap, viewportHeight - margin - available),
      width: rect.width,
      maxHeight: available,
      y: openUp ? -6 : 6,
    });
  };

  useLayoutEffect(() => {
    if (open) updateMenuLayout();
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const update = () => updateMenuLayout();
    window.addEventListener('click', close);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) setOpen(current => !current);
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[1.15rem] bg-[var(--surface-strong)]/72 px-3.5 py-2.5 text-left text-sm font-bold text-[var(--earth)] outline-none ring-1 ring-[var(--border)] transition-all hover:bg-[var(--surface-strong)] focus:ring-1 focus:ring-[var(--border)] disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="min-w-0">
          <span className="block truncate">{selected?.label || placeholder}</span>
          {selected?.description && (
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--text-muted)]">{selected.description}</span>
          )}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--sage)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: menuLayout.y * -1, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: menuLayout.y * -1, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'fixed',
              left: menuLayout.left,
              top: menuLayout.top,
              width: menuLayout.width,
              maxHeight: menuLayout.maxHeight,
            }}
            className="z-[120] overflow-y-auto rounded-[1.25rem] bg-[var(--surface-strong)]/98 p-1.5 shadow-2xl shadow-black/12 ring-1 ring-[var(--border)] backdrop-blur-xl app-scrollbar"
          >
            {options.map(option => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-[var(--sage)] text-[var(--on-sage)] shadow-sm'
                      : 'text-[var(--earth)] hover:bg-[var(--bg-app)]'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{option.label}</span>
                    {option.description && (
                      <span className={`mt-0.5 block truncate text-[11px] font-semibold ${active ? 'text-white/75' : 'text-[var(--text-muted)]'}`}>
                        {option.description}
                      </span>
                    )}
                  </span>
                  {active && <CheckCircle2 size={15} className="shrink-0" />}
                </button>
              );
            })}
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function ProjectTodoDraftRow({
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
        boxShadow: isDragging ? '0 14px 34px rgba(0,0,0,0.14)' : undefined,
        willChange: isDragging ? 'transform' : undefined,
      }}
      data-project-todo-row
      className={`relative flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--surface-strong)]/72 px-2.5 py-1.5 shadow-sm ring-1 ring-[var(--border)] ${
        isDragging ? 'scale-[1.008]' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(todo.id)}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
          todo.completed
            ? 'border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)]'
            : 'border-[var(--text-muted)]/38 text-transparent'
        }`}
        aria-label={appLanguage === 'en' ? 'Mark step' : 'Marcar paso'}
      >
        <CheckCircle2 size={14} />
      </button>
      <input
        data-project-todo-id={todo.id}
        value={todo.text}
        onChange={(event) => onChange(todo.id, event.target.value)}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter(todo.id);
          }
          if (event.key === 'Backspace' && !todo.text && total > 1) {
            event.preventDefault();
            onRemove(todo.id);
          }
        }}
        placeholder={index === 0
          ? appLanguage === 'en' ? 'First step' : 'Primer paso'
          : appLanguage === 'en' ? 'Next step' : 'Siguiente paso'}
        className={`min-w-0 flex-1 bg-transparent text-[1.03rem] font-medium leading-6 text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/45 ${
          todo.completed ? 'line-through opacity-50' : ''
        }`}
      />
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="grid h-8 w-8 shrink-0 touch-none place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--earth)] active:scale-95 active:cursor-grabbing"
        aria-label={appLanguage === 'en' ? 'Drag to reorder step' : 'Arrastrar para ordenar paso'}
      >
        <Menu size={17} />
      </button>
    </div>
  );
}

function AppSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent p-0.5 outline-none transition-colors focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[var(--sage)]' : 'bg-[var(--border)]'
      }`}
    >
      <span
        className={`h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function QuickCaptureBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  buttonLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  buttonLabel: string;
}) {
  const canSubmit = Boolean(value.trim());

  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-app)] p-2 shadow-inner shadow-black/[0.02] transition-all focus-within:border-[var(--border)] focus-within:bg-[var(--surface-strong)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-h-14 flex-1 items-center gap-3 rounded-[1.2rem] px-3 py-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--surface-strong)] text-[var(--sage)]">
            <Sprout size={17} />
          </span>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && canSubmit) {
                event.preventDefault();
                onSubmit();
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="h-10 w-full resize-none overflow-hidden bg-transparent py-2 text-base font-semibold leading-6 text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)] sm:text-sm"
          />
        </label>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[1.15rem] bg-[var(--sage)] px-5 text-sm font-black text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20 transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          <Plus size={17} /> {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function EmptyStatePanel({
  icon: Icon,
  eyebrow,
  title,
  detail,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  variant = 'default',
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  variant?: 'default' | 'compact';
}) {
  const isCompact = variant === 'compact';

  return (
    <section className={`relative overflow-hidden bg-[linear-gradient(180deg,var(--surface-strong),var(--surface-soft))] text-center shadow-sm ring-1 ring-[var(--border)] ${
      isCompact ? 'mx-auto max-w-3xl rounded-[1.7rem] px-5 py-5 sm:px-6 sm:py-6' : 'rounded-[2rem] p-6'
    }`}>
      <div className={`pointer-events-none absolute rounded-full bg-[var(--sage)]/8 blur-3xl ${
        isCompact ? 'inset-x-16 top-3 h-16' : 'inset-x-8 top-6 h-24'
      }`} />
      <div className={`relative mx-auto grid place-items-end ${
        isCompact ? 'mb-0 h-14 w-20' : 'mb-1 h-20 w-24'
      }`}>
        <div className={`absolute rounded-[999px] bg-[var(--bg-app)] shadow-inner ring-1 ring-[var(--border)] ${
          isCompact ? 'bottom-1 h-5 w-14' : 'bottom-2 h-7 w-20'
        }`} />
        <div className={`absolute rounded-full bg-[var(--tone-seed)]/55 ${
          isCompact ? 'bottom-4 left-6 h-5 w-1.5' : 'bottom-5 left-7 h-7 w-2'
        }`} />
        <div className={`absolute origin-bottom-left -rotate-12 rounded-[70%_30%_65%_35%] bg-[var(--tone-sprout-bg)] ring-1 ring-[var(--tone-sprout-border)] ${
          isCompact ? 'bottom-7 left-7 h-5 w-7' : 'bottom-10 left-8 h-6 w-8'
        }`} />
        <div className={`absolute grid place-items-center bg-[var(--surface-strong)] text-[var(--sage)] shadow-sm ring-1 ring-[var(--border)] ${
          isCompact ? 'bottom-6 right-7 h-9 w-9 rounded-2xl' : 'bottom-9 right-8 h-11 w-11 rounded-[1.15rem]'
        }`}>
          <Icon size={isCompact ? 18 : 21} />
        </div>
      </div>
      {eyebrow && (
        <p className={`relative font-black uppercase text-[var(--text-muted)] ${
          isCompact ? 'mt-3 text-[9px] tracking-[0.2em]' : 'mt-5 text-[10px] tracking-[0.22em]'
        }`}>{eyebrow}</p>
      )}
      <h3 className={`relative mx-auto mt-2 font-semibold tracking-tight text-[var(--earth)] ${
        isCompact ? 'max-w-lg text-xl sm:text-[1.35rem]' : 'max-w-sm text-2xl'
      }`}>{title}</h3>
      <p className={`relative mx-auto mt-2 font-medium leading-relaxed text-[var(--text-muted)] ${
        isCompact ? 'max-w-xl text-sm' : 'max-w-sm text-sm'
      }`}>{detail}</p>
      {(actionLabel || secondaryLabel) && (
        <div className={`mx-auto grid gap-2 ${
          isCompact ? 'mt-5 max-w-md grid-cols-2' : 'mt-6 max-w-sm sm:grid-cols-2'
        }`}>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className={`flex items-center justify-center rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] shadow-sm soft-interaction ${
                isCompact ? 'h-10' : 'h-11'
              }`}
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className={`flex items-center justify-center rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)] ring-1 ring-[var(--border)] soft-interaction ${
                isCompact ? 'h-10' : 'h-11'
              }`}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function formatReviewAge(note: SeedNote) {
  const days = daysSince(note.lastWateredAt || note.createdAt);
  if (!Number.isFinite(days) || days <= 0) return appLanguage === 'en' ? 'reviewed today' : 'revisada hoy';
  if (appLanguage === 'en') return `${days} day${days === 1 ? '' : 's'} without review`;
  return `${days} día${days === 1 ? '' : 's'} sin revisión`;
}

const DAILY_CLOSURE_TAG = 'daily-closure';

function isDailyClosureForDate(note: SeedNote, date = Date.now()) {
  const noteDate = note.harvestedAt || note.createdAt;
  const legacyDailyClosure = note.title === 'Cierre del día' || note.title === 'Today closure';
  return (
    note.seedType === 'learning' &&
    note.growthStage === 'bloom' &&
    format(noteDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
    (note.tags?.includes(DAILY_CLOSURE_TAG) || legacyDailyClosure)
  );
}

const STAGE_META: Record<SeedNote['growthStage'], { label: string; shortLabel: string; color: string; bg: string; aura: string }> = {
  seed: {
    label: 'Semilla',
    shortLabel: 'Idea nueva',
    color: 'text-[var(--tone-seed)]',
    bg: 'bg-[var(--tone-seed-bg)]',
    aura: 'from-[var(--tone-seed-bg)] via-[var(--surface-soft)] to-[var(--surface-strong)]',
  },
  sprout: {
    label: 'En Brote',
    shortLabel: 'En progreso',
    color: 'text-[var(--tone-sprout)]',
    bg: 'bg-[var(--tone-sprout-bg)]',
    aura: 'from-[var(--tone-sprout-bg)] via-[var(--surface-soft)] to-[var(--surface-strong)]',
  },
  bloom: {
    label: 'Cosechada',
    shortLabel: 'Completada',
    color: 'text-[var(--tone-harvest)]',
    bg: 'bg-[var(--tone-harvest-bg)]',
    aura: 'from-[var(--tone-harvest-bg)] via-[var(--surface-soft)] to-[var(--surface-strong)]',
  },
  withered: {
    label: 'Marchita',
    shortLabel: 'Vencida',
    color: 'text-[var(--tone-warning)]',
    bg: 'bg-[var(--tone-warning-bg)]',
    aura: 'from-[var(--tone-warning-bg)] via-[var(--surface-soft)] to-[var(--surface-strong)]',
  },
};

function getIdeaGuidance(note: SeedNote) {
  const openTask = note.tasks.find(task => !task.completed);
  const daysWithoutReview = daysSince(note.lastWateredAt || note.createdAt);

  if (note.paused) {
    return {
      label: 'Pausada',
      title: 'Fuera de tu ruta',
      detail: 'No te distrae por ahora. Reactívala cuando vuelva a importar.',
      action: 'Reactivar',
      tone: 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning)] border-[var(--tone-warning-border)]',
      actionTone: 'bg-[var(--earth)] text-[var(--on-earth)]',
      kind: 'pause' as const,
    };
  }

  if (note.growthStage === 'bloom') {
    const hasLearning = Boolean(note.reflection?.trim() || note.takeaway?.trim());
    return {
      label: 'Cosechada',
      title: hasLearning ? 'Aprendizaje guardado' : 'Cierre opcional',
      detail: note.reflection || note.takeaway || 'Si esta idea te dejó algo, guárdalo en dos líneas.',
      action: hasLearning ? 'Ver' : 'Aprender',
      tone: 'bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)] border-[var(--tone-harvest-border)]',
      actionTone: 'bg-[var(--surface-soft)] text-[var(--sage)] border border-[var(--border)]',
      kind: 'open' as const,
    };
  }

  if (note.growthStage === 'withered') {
    return {
      label: 'Marchita',
      title: 'Revivir o soltar',
      detail: 'Decide si todavía vale la pena convertirla en acción.',
      action: 'Revivir',
      tone: 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning)] border-[var(--tone-warning-border)]',
      actionTone: 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning)] border border-[var(--tone-warning-border)]',
      kind: 'grow' as const,
    };
  }

  if (!note.isGrowth) {
    return {
      label: 'Sin paso',
      title: 'Define el primer paso',
      detail: 'Una idea empieza a crecer cuando tiene una acción pequeña.',
      action: 'Cultivar',
      tone: 'bg-[var(--tone-seed-bg)] text-[var(--tone-seed)] border-[var(--tone-seed-border)]',
      actionTone: 'bg-[var(--surface-soft)] text-[var(--sage)] border border-[var(--border)]',
      kind: 'grow' as const,
    };
  }

  if (wateringDue(note)) {
    return {
      label: 'Riego',
      title: 'Vale un riego',
      detail: `${daysWithoutReview} día${daysWithoutReview === 1 ? '' : 's'} sin mirar. Riégala en 20 segundos para que no se pierda.`,
      action: 'Regar',
      tone: 'bg-[var(--tone-water-bg)] text-[var(--tone-water)] border-[var(--tone-water-border)]',
      actionTone: 'bg-[var(--sage)] text-[var(--on-sage)]',
      kind: 'water' as const,
    };
  }

  if (openTask) {
    return {
      label: 'Siguiente',
      title: 'Lista para enfocar',
      detail: openTask.text || 'Describe el siguiente paso antes de enfocarte.',
      action: 'Enfocar',
      tone: 'bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)] border-[var(--tone-sprout-border)]',
      actionTone: 'bg-[var(--accent)] text-[var(--on-accent)]',
      kind: 'focus' as const,
    };
  }

  return {
    label: 'Paso',
    title: 'Añade una acción',
    detail: 'Esta idea necesita un siguiente paso para seguir avanzando.',
    action: 'Abrir',
    tone: 'bg-[var(--bg-app)] text-[var(--sage)] border-[var(--border)]',
    actionTone: 'bg-[var(--earth)] text-[var(--on-earth)]',
    kind: 'open' as const,
  };
}

function getAccountInitials(name: string, email: string) {
  const source = name.trim() || email.trim() || 'Jardinero Digital';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatAuthError(message: string) {
  if (message.toLowerCase().includes('email rate limit exceeded')) {
    return 'Límite de emails alcanzado. Para pruebas: Supabase > Authentication > Providers > Email > desactiva Confirm email, guarda y vuelve a intentar.';
  }

  return message;
}

function passwordPolicyError(password: string) {
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (!/[A-ZÁÉÍÓÚÑ]/.test(password)) return 'La contraseña debe incluir al menos una mayúscula.';
  if (!/\d/.test(password)) return 'La contraseña debe incluir al menos un número.';
  return '';
}

function GestureNoteSurface({
  children,
  className,
  wrapperClassName = '',
  onPress,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  rightLabel = 'Regar',
  leftLabel = 'Pausar',
  rightIcon: RightIcon = Droplets,
  leftIcon: LeftIcon = Pause,
  rightTone = 'bg-[var(--tone-water)] text-[var(--on-sage)]',
  leftTone = 'bg-[var(--tone-warning)] text-[var(--on-sage)]',
}: {
  children: ReactNode;
  className: string;
  wrapperClassName?: string;
  onPress?: () => void;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onLongPress?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  rightIcon?: typeof Droplets;
  leftIcon?: typeof Pause;
  rightTone?: string;
  leftTone?: string;
}) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const swipedRef = useRef(false);
  const [swipeHint, setSwipeHint] = useState<'right' | 'left' | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = () => {
    longPressFiredRef.current = false;
    swipedRef.current = false;
    clearLongPressTimer();
    if (!onLongPress || window.innerWidth >= 768) return;

    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress();
    }, 520);
  };

  return (
    <div className={`relative overflow-hidden bg-[var(--surface-strong)] ${wrapperClassName}`}>
      <AnimatePresence>
        {swipeHint && (
          <motion.div
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 z-0 flex h-10 -translate-y-1/2 items-center gap-2 rounded-full px-3 text-xs font-semibold shadow-sm ${
              swipeHint === 'right'
                ? `left-3 ${rightTone}`
                : `right-3 ${leftTone}`
            }`}
            initial={{ opacity: 0, scale: 0.86, x: swipeHint === 'right' ? -8 : 8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
          >
            {swipeHint === 'right' ? (
              <>
                <RightIcon size={15} />
                <span>{rightLabel}</span>
              </>
            ) : (
              <>
                <span>{leftLabel}</span>
                <LeftIcon size={15} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.045}
        onPointerDown={startLongPress}
        onPointerUp={() => {
          clearLongPressTimer();
          setSwipeHint(null);
        }}
        onPointerCancel={() => {
          clearLongPressTimer();
          setSwipeHint(null);
        }}
        onPointerLeave={() => {
          clearLongPressTimer();
          setSwipeHint(null);
        }}
        onDragStart={() => {
          clearLongPressTimer();
        }}
        onDrag={(_, info) => {
          const mostlyHorizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.4;
          if (!mostlyHorizontal || Math.abs(info.offset.x) < 28) {
            setSwipeHint(null);
            return;
          }
          setSwipeHint(info.offset.x > 0 ? 'right' : 'left');
        }}
        onDragEnd={(_, info) => {
          clearLongPressTimer();
          setSwipeHint(null);
          const mostlyHorizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.25;
          if (!mostlyHorizontal || Math.abs(info.offset.x) < 74) return;

          swipedRef.current = true;
          if (info.offset.x > 0) onSwipeRight?.();
          else onSwipeLeft?.();
          window.setTimeout(() => { swipedRef.current = false; }, 160);
        }}
        onClick={() => {
          if (longPressFiredRef.current || swipedRef.current) return;
          onPress?.();
        }}
        className={`relative z-10 ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

function CalendarView({ 
  currentMonth, 
  setCurrentMonth, 
  notes, 
  onSelectNote,
  onExit,
}: { 
  currentMonth: Date; 
  setCurrentMonth: (d: Date) => void; 
  notes: SeedNote[]; 
  onSelectNote: (id: string) => void;
  onExit: () => void;
  key?: string;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const mobileTodayRef = useRef<HTMLButtonElement | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => {
    const now = new Date();
    return isSameMonth(now, monthStart) ? now : monthStart;
  });

  const goToMonth = (date: Date) => {
    const nextMonth = startOfMonth(date);
    setCurrentMonth(nextMonth);
    setSelectedDay(nextMonth);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDay(today);
  };

  const activityByDay = useMemo(() => {
    type DayActivity = {
      planted: SeedNote[];
      watered: SeedNote[];
      harvested: SeedNote[];
      advanced: SeedNote[];
      due: SeedNote[];
    };

    const map: Record<string, DayActivity> = {};
    const ensureDay = (date: number | Date) => {
      const key = format(date, 'yyyy-MM-dd');
      if (!map[key]) map[key] = { planted: [], watered: [], harvested: [], advanced: [], due: [] };
      return map[key];
    };

    notes.forEach(note => {
      ensureDay(note.createdAt).planted.push(note);
      if (note.lastWateredAt) ensureDay(note.lastWateredAt).watered.push(note);
      if (note.harvestedAt) ensureDay(note.harvestedAt).harvested.push(note);
      if (note.dueDate) ensureDay(note.dueDate).due.push(note);
      if (note.updatedAt && !isSameDay(note.updatedAt, note.createdAt) && (!note.lastWateredAt || !isSameDay(note.updatedAt, note.lastWateredAt))) {
        ensureDay(note.updatedAt).advanced.push(note);
      }
    });
    return map;
  }, [notes]);

  const selectedKey = format(selectedDay, 'yyyy-MM-dd');
  const selectedActivity = activityByDay[selectedKey] || { planted: [], watered: [], harvested: [], advanced: [], due: [] };
  const buildDayEvents = (activity: typeof selectedActivity) => [
    ...activity.planted.map(note => ({ note, type: 'planted', label: note.growthStage === 'seed' ? t('plantedSeed') : t('ideaCreated'), icon: Sprout, tone: 'bg-[var(--tone-seed-bg)] text-[var(--tone-seed)] border-[var(--tone-seed-border)]' })),
    ...activity.watered.map(note => ({ note, type: 'watered', label: t('wateredIdea'), icon: Droplets, tone: 'bg-[var(--tone-water-bg)] text-[var(--tone-water)] border-[var(--tone-water-border)]' })),
    ...activity.advanced.map(note => ({ note, type: 'advanced', label: t('advancedIdea'), icon: TrendingUp, tone: 'bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)] border-[var(--tone-sprout-border)]' })),
    ...activity.harvested.map(note => ({ note, type: 'harvested', label: t('harvestDone'), icon: CheckCircle2, tone: 'bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)] border-[var(--tone-harvest-border)]' })),
    ...activity.due.map(note => ({ note, type: 'due', label: t('dueDate'), icon: Target, tone: 'bg-[var(--surface-soft)] text-[var(--seed-accent)] border-[var(--border)]' })),
  ];
  const selectedEvents = buildDayEvents(selectedActivity);

  const monthSummary = monthDays.reduce((summary, day) => {
    const activity = activityByDay[format(day, 'yyyy-MM-dd')];
    if (!activity) return summary;
    return {
      planted: summary.planted + activity.planted.length,
      watered: summary.watered + activity.watered.length,
      harvested: summary.harvested + activity.harvested.length,
      activeDays: summary.activeDays + (activity.planted.length + activity.watered.length + activity.harvested.length + activity.advanced.length > 0 ? 1 : 0),
    };
  }, { planted: 0, watered: 0, harvested: 0, activeDays: 0 });
  const activeDayKeys = new Set(monthDays
    .filter(day => {
      const activity = activityByDay[format(day, 'yyyy-MM-dd')];
      return activity && activity.planted.length + activity.watered.length + activity.harvested.length + activity.advanced.length > 0;
    })
    .map(day => format(day, 'yyyy-MM-dd')));
  const activeStreak = (() => {
    let cursor = new Date();
    if (!isSameMonth(cursor, monthStart)) return 0;
    let streak = 0;
    while (isSameMonth(cursor, monthStart) && activeDayKeys.has(format(cursor, 'yyyy-MM-dd'))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
    return streak;
  })();
  const monthProgress = Math.round((monthSummary.activeDays / Math.max(1, monthDays.length)) * 100);
  const daySummary = selectedEvents.length === 0
    ? 'Un claro libre en tu jardín. Puedes usarlo para plantar algo nuevo o descansar sin culpa.'
    : selectedActivity.harvested.length > 0
      ? `Día de cosecha: cerraste ${selectedActivity.harvested.length} idea${selectedActivity.harvested.length === 1 ? '' : 's'} y dejaste evidencia de avance.`
      : selectedActivity.watered.length > 0
        ? `Día de cuidado: regaste ${selectedActivity.watered.length} idea${selectedActivity.watered.length === 1 ? '' : 's'} para que no se pierdan.`
        : selectedActivity.planted.length > 0
          ? `Día de siembra: plantaste ${selectedActivity.planted.length} semilla${selectedActivity.planted.length === 1 ? '' : 's'} nueva${selectedActivity.planted.length === 1 ? '' : 's'}.`
          : `Día de avance: moviste ${selectedActivity.advanced.length} idea${selectedActivity.advanced.length === 1 ? '' : 's'} hacia adelante.`;
  const weekLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const monthStartOffset = (monthStart.getDay() + 6) % 7;
  const calendarDays = [
    ...Array.from({ length: monthStartOffset }, () => null),
    ...monthDays,
  ];
  const calendarCells = [
    ...calendarDays,
    ...Array.from({ length: Math.ceil(calendarDays.length / 7) * 7 - calendarDays.length }, () => null),
  ];
  const calendarRows = Math.max(5, calendarCells.length / 7);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  useEffect(() => {
    const now = new Date();
    if (!isSameMonth(now, monthStart)) return;

    const frame = window.requestAnimationFrame(() => {
      mobileTodayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentMonth]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.08}
      onDragEnd={(_, info) => {
        if (info.offset.x > 70) goToMonth(subMonths(currentMonth, 1));
        if (info.offset.x < -70) goToMonth(addMonths(currentMonth, 1));
      }}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)]"
    >
      <header className="relative z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface-strong)]/88 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-2xl sm:px-6">
        <div className="mb-3 flex items-center justify-end sm:hidden">
          <button
            onClick={onExit}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-app)]/80 px-3.5 text-sm font-semibold text-[var(--sage)] shadow-sm backdrop-blur-xl transition-colors active:bg-[var(--surface-soft)]"
            aria-label="Cerrar calendario"
          >
            <X size={14} />
            <span>{appLanguage === 'en' ? 'Done' : 'Listo'}</span>
          </button>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => goToMonth(subMonths(currentMonth, 1))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)] transition-colors hover:bg-[var(--surface-hover)]"
                aria-label="Mes anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <h3 className="min-w-0 truncate text-center text-xl font-semibold capitalize tracking-tight text-[var(--earth)] sm:text-3xl">
                {formatMonthYear(currentMonth)}
              </h3>
              <button
                onClick={() => goToMonth(addMonths(currentMonth, 1))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)] transition-colors hover:bg-[var(--surface-hover)]"
                aria-label="Mes siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-xs font-medium text-[var(--text-muted)]">
              <span>{monthSummary.activeDays} {t('activeDays')}</span>
              <span>·</span>
              <span>{activeStreak} {t('streak')}</span>
              <button onClick={goToToday} className="ml-1 rounded-full bg-[var(--bg-app)] px-2 py-1 text-xs font-semibold text-[var(--sage)]">{t('today')}</button>
            </div>
          </div>
          <div className="hidden items-center gap-2 overflow-x-auto pb-0.5 app-scrollbar sm:flex xl:flex-wrap xl:overflow-visible">
            {[
              { label: 'Dias', value: monthSummary.activeDays, icon: CalendarIcon, tone: 'text-[var(--sage)]' },
              { label: 'Plantadas', value: monthSummary.planted, icon: Sprout, tone: 'text-[var(--tone-seed)]' },
              { label: 'Riegos', value: monthSummary.watered, icon: Droplets, tone: 'text-[var(--tone-water)]' },
              { label: 'Cosechas', value: monthSummary.harvested, icon: CheckCircle2, tone: 'text-[var(--tone-harvest)]' },
            ].map(item => (
              <div key={item.label} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--bg-app)] px-2.5 sm:h-10 sm:gap-2 sm:px-3">
                <item.icon size={14} className={item.tone} />
                <span className="font-serif text-lg font-black text-[var(--earth)] sm:text-xl">{item.value}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] sm:text-[9px]">{item.label}</span>
              </div>
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 xl:ml-2 xl:gap-2">
              <button
                onClick={onExit}
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-app)]/80 text-[var(--sage)] shadow-sm transition-colors hover:bg-[var(--surface-soft)] sm:h-10 sm:w-10"
                aria-label="Cerrar mapa"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 sm:grid sm:grid-cols-1 sm:grid-rows-[minmax(0,1fr)_auto] sm:gap-0 xl:grid-cols-[minmax(0,1fr)_24rem] xl:grid-rows-1">
        <div className="h-full overflow-y-auto px-4 py-3 app-scrollbar sm:hidden">
          <div className="space-y-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {monthDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const activity = activityByDay[dateKey] || { planted: [], watered: [], harvested: [], advanced: [], due: [] };
              const dayEvents = buildDayEvents(activity);
              const activityCount = dayEvents.length;
              const isTodayDay = isToday(day);
              const isSelected = isSameDay(day, selectedDay);
              const isPastQuietDay = activityCount === 0 && day.getTime() < todayStart.getTime();
              const strongest =
                activity.harvested.length > 0 ? 'harvested' :
                activity.watered.length > 0 ? 'watered' :
                activity.advanced.length > 0 ? 'advanced' :
                activity.planted.length > 0 ? 'planted' :
                activity.due.length > 0 ? 'due' : 'empty';
              const DayIcon =
                strongest === 'harvested' ? CheckCircle2 :
                strongest === 'watered' ? Droplets :
                strongest === 'advanced' ? TrendingUp :
                strongest === 'planted' ? Sprout :
                strongest === 'due' ? Target :
                Leaf;
              const iconTone =
                strongest === 'harvested' ? 'bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)]' :
                strongest === 'watered' ? 'bg-[var(--tone-water-bg)] text-[var(--tone-water)]' :
                strongest === 'advanced' ? 'bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)]' :
                strongest === 'planted' ? 'bg-[var(--tone-seed-bg)] text-[var(--tone-seed)]' :
                strongest === 'due' ? 'bg-[var(--surface-soft)] text-[var(--seed-accent)]' :
                isPastQuietDay ? 'bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)]' :
                'bg-[var(--bg-app)] text-[var(--text-muted)]';

              return (
                <motion.button
                  key={dateKey}
                  ref={isTodayDay ? mobileTodayRef : undefined}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`w-full rounded-[1.35rem] border p-3 text-left shadow-sm transition-colors ${
                    isSelected
                      ? 'border-[var(--sage)] bg-[var(--surface-strong)] ring-2 ring-[var(--sage)]/12'
                      : 'border-[var(--border)] bg-[var(--surface-strong)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{format(day, 'EEE', { locale: appDateLocale })}</p>
                      <p className={`mt-1 text-2xl font-semibold leading-none ${isTodayDay ? 'text-[var(--sage)]' : 'text-[var(--earth)]'}`}>{format(day, 'd')}</p>
                    </div>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${iconTone}`}>
                      <DayIcon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold capitalize text-[var(--earth)]">{formatDayMonth(day)}</p>
                        {activityCount > 0 && (
                          <span className="shrink-0 rounded-full bg-[var(--bg-app)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sage)]">{activityCount}</span>
                        )}
                      </div>
                      {dayEvents.length === 0 ? (
                        <p className={`mt-1 text-sm font-medium ${isPastQuietDay ? 'text-[var(--tone-harvest)]' : 'text-[var(--text-muted)]'}`}>
                          {isPastQuietDay ? t('quietDay') : t('noActivity')}
                        </p>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 2).map((event, index) => (
                            <div key={`${event.type}-${event.note.id}-${index}`} className="flex min-w-0 items-center gap-2">
                              <event.icon size={12} className="shrink-0 opacity-70" />
                              <p className="truncate text-sm font-medium text-[var(--text-muted)]">{event.label}: {event.note.title}</p>
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <p className="text-xs font-medium text-[var(--sage)]">+{dayEvents.length - 2} más</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="relative hidden min-h-0 overflow-hidden p-3 sm:flex sm:p-4">
          <div className="mx-auto flex h-full w-full max-w-7xl min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-2 sm:p-4">
            <div className="grid shrink-0 grid-cols-7 gap-1 sm:gap-2">
              {weekLabels.map(label => (
                <div key={label} className="px-1 py-1 text-center text-[10px] font-semibold text-[var(--text-muted)] sm:px-2 sm:py-2">
                  {label}
                </div>
              ))}
            </div>

            <div
              className="mt-1 grid min-h-0 flex-1 grid-cols-7 gap-1 sm:mt-2 sm:gap-2"
              style={{ gridTemplateRows: `repeat(${calendarRows}, minmax(0, 1fr))` }}
            >
              {calendarCells.map((day, index) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${index}`}
	                      className="min-h-0 rounded-xl bg-[var(--bg-app)]/45 sm:rounded-2xl"
                    />
                  );
                }

                const dateKey = format(day, 'yyyy-MM-dd');
                const activity = activityByDay[dateKey] || { planted: [], watered: [], harvested: [], advanced: [], due: [] };
                const activityCount = activity.planted.length + activity.watered.length + activity.harvested.length + activity.advanced.length;
                const hasActivity = activityCount > 0;
                const isSelected = isSameDay(day, selectedDay);
                const isTodayDay = isToday(day);
                const isPastQuietDay = activityCount === 0 && day.getTime() < todayStart.getTime();
                const strongest =
                  activity.harvested.length > 0 ? 'harvested' :
                  activity.watered.length > 0 ? 'watered' :
                  activity.advanced.length > 0 ? 'advanced' :
                  activity.planted.length > 0 ? 'planted' : 'empty';
                const NodeIcon =
                  strongest === 'harvested' ? CheckCircle2 :
                  strongest === 'watered' ? Droplets :
                  strongest === 'advanced' ? TrendingUp :
                  strongest === 'planted' ? Sprout :
                  Leaf;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedDay(day)}
	                    className={`group relative flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-xl border p-0.5 text-center transition-colors sm:rounded-2xl sm:p-2 ${
                      isSelected
	                        ? 'border-[var(--sage)] bg-[var(--bg-app)] ring-2 ring-[var(--sage)]/18'
                        : isTodayDay
	                          ? 'border-[var(--earth)]/20 bg-[var(--bg-app)]'
                          : hasActivity
	                            ? 'border-[var(--border)] bg-[var(--surface-strong)]/70'
	                            : 'border-transparent bg-transparent hover:bg-[var(--bg-app)]'
                    }`}
                    aria-label={`Dia ${format(day, 'd')}`}
                  >
	                    <span className="absolute left-1.5 top-1.5 text-[10px] font-semibold text-[var(--text-muted)] sm:left-2 sm:top-2 sm:text-xs">
                      {format(day, 'd')}
                    </span>
                    {isTodayDay && (
	                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--earth)] sm:right-2 sm:top-2" />
                    )}

	                    <span className={`relative grid h-[clamp(1.65rem,4vh,3.2rem)] w-[clamp(1.65rem,4vh,3.2rem)] place-items-center rounded-full sm:h-[clamp(2rem,5vh,3.5rem)] sm:w-[clamp(2rem,5vh,3.5rem)] ${
                      isSelected
	                        ? 'bg-[var(--sage)] text-[var(--on-sage)]'
                        : isTodayDay
	                          ? 'bg-[var(--earth)] text-[var(--on-earth)]'
                          : strongest === 'harvested'
	                            ? 'bg-[var(--tone-harvest)] text-[var(--on-sage)]'
                            : strongest === 'watered'
	                              ? 'bg-[var(--tone-water)] text-[var(--on-sage)]'
                              : strongest === 'advanced'
	                                ? 'bg-[var(--tone-sprout)] text-[var(--on-sage)]'
                                : strongest === 'planted'
                                  ? 'bg-[var(--tone-seed)] text-[var(--on-sage)]'
		                                  : isPastQuietDay
                                    ? 'bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)]'
                                    : 'bg-[var(--bg-app)] text-[var(--text-muted)]'
                    }`}>
	                      <NodeIcon size={13} className="sm:h-5 sm:w-5" />
                      {activity.due.length > 0 && (
                        <span className="absolute -left-0.5 top-0.5 h-2 w-2 rounded-full bg-[var(--seed-accent)] sm:h-3 sm:w-3" />
                      )}
                      {(activity.harvested.length > 0 || activityCount >= 3) && (
	                        <span className="absolute -right-1 bottom-0 grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] sm:h-5 sm:w-5">
                          <Sparkles size={9} />
                        </span>
                      )}
                    </span>

	                    <span className={`mt-1 hidden max-w-full truncate rounded-full px-1.5 py-0.5 text-[7px] font-semibold min-[430px]:inline-flex sm:mt-2 sm:px-2.5 sm:py-1 sm:text-[9px] ${
                      hasActivity ? 'bg-[var(--surface-strong)] text-[var(--earth)]' : 'bg-[var(--surface-soft)] text-[var(--text-muted)]'
                    }`}>
                      {hasActivity ? `${activityCount} evento${activityCount === 1 ? '' : 's'}` : 'Libre'}
                    </span>

                    <span className="mt-0.5 hidden h-3 justify-center gap-0.5 min-[430px]:flex sm:mt-1.5 sm:h-4 sm:gap-1">
                      {activity.planted.length > 0 && <Sprout size={10} className="text-[var(--tone-seed)] sm:h-3 sm:w-3" />}
                      {activity.watered.length > 0 && <Droplets size={10} className="text-[var(--tone-water)] sm:h-3 sm:w-3" />}
                      {activity.advanced.length > 0 && <TrendingUp size={10} className="text-[var(--tone-sprout)] sm:h-3 sm:w-3" />}
                      {activity.harvested.length > 0 && <CheckCircle2 size={10} className="text-[var(--tone-harvest)] sm:h-3 sm:w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="hidden max-h-[30vh] min-h-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-strong)] p-4 app-scrollbar sm:block sm:max-h-[34vh] sm:p-5 xl:max-h-none xl:border-l xl:border-t-0">
          <h4 className="text-xl font-semibold capitalize tracking-tight text-[var(--earth)] sm:text-2xl">
            {formatDayMonth(selectedDay)}
          </h4>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)] sm:line-clamp-none">{daySummary}</p>

          <div className="mt-3 grid grid-cols-4 gap-1.5 text-center sm:gap-2">
            {[
              { label: 'Plant', value: selectedActivity.planted.length, tone: 'text-[var(--tone-seed)]' },
              { label: 'Riego', value: selectedActivity.watered.length, tone: 'text-[var(--tone-water)]' },
              { label: 'Avance', value: selectedActivity.advanced.length, tone: 'text-[var(--tone-sprout)]' },
              { label: 'Cosecha', value: selectedActivity.harvested.length, tone: 'text-[var(--tone-harvest)]' },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-[var(--bg-app)] px-2 py-2">
                <p className={`text-sm font-semibold sm:text-base ${item.tone}`}>{item.value}</p>
                <p className="mt-0.5 text-[9px] font-medium text-[var(--text-muted)]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {selectedEvents.length === 0 ? (
              <div className="rounded-2xl bg-[var(--bg-app)] p-4 text-center">
                <Leaf className="mx-auto text-[var(--sage)] opacity-45" size={22} />
                <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">Sin actividad este día.</p>
              </div>
            ) : selectedEvents.map((event, index) => (
              <button
                key={`${event.type}-${event.note.id}-${index}`}
                type="button"
                onClick={() => {
                  onSelectNote(event.note.id);
                  onExit();
                }}
	                className={`w-full rounded-2xl border p-3 text-left transition-colors ${event.tone}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)]/80">
                    <event.icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold opacity-70">{event.label}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold">{event.note.title}</p>
                    <p className="mt-0.5 text-xs font-medium opacity-70">{STAGE_META[event.note.growthStage].shortLabel}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </motion.div>
  );
}

function TodayView({
  accountName,
  notes,
  quickNote,
  setQuickNote,
  onQuickCapture,
  onOpenWatering,
  onSkipWatering,
  onSelectNote,
  onToggleTask,
  onFocusNote,
  onStartPlanting,
  onCloseDay,
  onNavigate,
  onShowWateringQueue,
  todayWidgets,
  wateredToday,
  wateringStreak,
  getProgress,
  dailyIntention,
  setDailyIntention,
}: {
  accountName: string;
  notes: SeedNote[];
  quickNote: string;
  setQuickNote: (value: string) => void;
  onQuickCapture: () => void;
  onOpenWatering: (id: string) => void;
  onSkipWatering: (id: string) => void;
  onSelectNote: (id: string) => void;
  onToggleTask: (noteId: string, taskId: string) => void;
  onFocusNote: (id: string) => void;
  onStartPlanting: () => void;
  onCloseDay: (reflection: string, intention: string, intentionOutcome?: 'yes' | 'some' | 'no' | '') => void;
  onNavigate: (view: AppView) => void;
  onShowWateringQueue: () => void;
  todayWidgets: TodayWidgetId[];
  wateredToday: boolean;
  wateringStreak: number;
  getProgress: (note: SeedNote) => number;
  dailyIntention: string;
  setDailyIntention: (value: string) => void;
}) {
  const [showTodayMore, setShowTodayMore] = useState(false);
  const [showDaySummary, setShowDaySummary] = useState(false);
  const [dayReflection, setDayReflection] = useState('');
  const [intentionDraft, setIntentionDraft] = useState(dailyIntention);
  const [isEditingIntention, setIsEditingIntention] = useState(!dailyIntention.trim());
  const [intentionOutcome, setIntentionOutcome] = useState<'yes' | 'some' | 'no' | ''>('');
  const todayData = useMemo(() => {
    const today = new Date();
    const activeNotes = notes.filter(note => note.growthStage !== 'bloom' && note.growthStage !== 'withered' && !note.paused);
    const allThirstyNotes = activeNotes
      .filter(note => wateringDue(note))
      .sort((a, b) => {
        const aAge = daysSince(a.lastWateredAt || a.createdAt);
        const bAge = daysSince(b.lastWateredAt || b.createdAt);
        const aSeedBoost = a.inbox ? 2 : 0;
        const bSeedBoost = b.inbox ? 2 : 0;
        return (priorityWeight(b) + bAge + bSeedBoost) - (priorityWeight(a) + aAge + aSeedBoost);
      });
    const firstWatering = allThirstyNotes[0];
    const nextAction = notes
      .filter(note => !note.inbox && note.isGrowth && !note.paused && note.growthStage !== 'bloom' && !wateringDue(note))
      .map(note => ({ note, task: note.tasks.find(task => !task.completed) }))
      .filter((item): item is { note: SeedNote; task: NonNullable<typeof item.task> } => Boolean(item.task))
      .sort((a, b) => priorityWeight(b.note) - priorityWeight(a.note))[0];
    const firstInboxNote = notes
      .filter(note => note.inbox)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const inboxCount = notes.filter(note => note.inbox).length;
    const sproutCount = notes.filter(note => !note.inbox && note.isGrowth && !note.paused && note.growthStage !== 'bloom').length;
    const harvestCount = notes.filter(note => !note.inbox && note.growthStage === 'bloom').length;
    const completedToday = notes.filter(note => note.harvestedAt && isToday(note.harvestedAt)).length;
    const dayClosure = notes.find(note => isDailyClosureForDate(note));
    const plantedToday = notes.filter(note => isToday(note.createdAt)).length;
    const wateredTodayCount = notes.filter(note => note.lastWateredAt && isToday(note.lastWateredAt)).length;
    const stepsToday = notes.filter(note =>
      note.updatedAt &&
      isToday(note.updatedAt) &&
      note.tasks.some(task => task.completed)
    ).length;
    const activeDaysThisMonth = new Set(notes
      .flatMap(note => [note.createdAt, note.lastWateredAt, note.harvestedAt].filter((date): date is number => Boolean(date)))
      .filter(date => isSameMonth(date, today))
      .map(date => format(date, 'yyyy-MM-dd'))).size;
    const learningMemory = notes
      .filter(note => note.growthStage === 'bloom' && (note.reflection?.trim() || note.takeaway?.trim()))
      .sort((a, b) => (b.harvestedAt || b.updatedAt || b.createdAt) - (a.harvestedAt || a.updatedAt || a.createdAt))[0];
    const hour = today.getHours();
    const greeting = hour < 12 ? t('goodMorning') : hour < 19 ? t('goodAfternoon') : t('goodEvening');
    const firstName = accountName.trim().split(/\s+/)[0] || (appLanguage === 'en' ? 'there' : 'jardinero');
    const todayWeekday = format(today, 'EEEE', { locale: appDateLocale });
    const todayDate = formatDayMonth(today);
    const dailyPhraseSeed = Number(format(today, 'd')) + notes.length + wateringStreak;
    const motivationalPhrases = appLanguage === 'en'
      ? [
          'One small return is enough.',
          'Keep it light. Keep it alive.',
          'A seed only needs one next move.',
          'No rush. Just choose what still matters.',
          'Good ideas grow quietly.',
          'Today can be one clear step.',
        ]
      : [
          'Volver un poco también cuenta.',
          'Cuida una idea, no toda la lista.',
          'Una semilla solo necesita el siguiente paso.',
          'Sin prisa. Solo elige lo que sigue vivo.',
          'Las buenas ideas crecen en silencio.',
          'Hoy puede ser un paso claro.',
        ];
    const motivationalText = motivationalPhrases[dailyPhraseSeed % motivationalPhrases.length];
    const doneTodayText = wateredToday
      ? appLanguage === 'en'
        ? `${wateringStreak}-day streak`
        : `Racha de ${wateringStreak} día${wateringStreak === 1 ? '' : 's'}`
      : motivationalText;
    const primaryMode = firstWatering ? 'water' : nextAction ? 'focus' : inboxCount > 0 ? 'seed' : 'calm';
    const primaryTitle = firstWatering?.title || nextAction?.note.title || firstInboxNote?.title || t('quietGarden');
    const primaryDetail = firstWatering
      ? formatReviewAge(firstWatering)
      : nextAction
        ? nextAction.task.text
        : firstInboxNote
          ? t('seedWaiting')
          : t('captureIdea');
    const primaryEyebrow = firstWatering
      ? appLanguage === 'en' ? 'Review gently' : 'Riego amable'
      : nextAction
        ? appLanguage === 'en' ? 'One small step' : 'Un paso pequeño'
        : inboxCount > 0
          ? appLanguage === 'en' ? 'Decide later, now' : 'Decidir sin presión'
          : appLanguage === 'en' ? 'Quiet garden' : 'Jardín tranquilo';
    const PrimaryIcon = firstWatering ? Droplets : nextAction ? Target : inboxCount > 0 ? Sprout : Leaf;
    const primaryActionLabel = firstWatering
      ? t('waterNow')
      : nextAction
        ? t('focus')
        : inboxCount > 0
          ? t('viewSeeds')
          : appLanguage === 'en' ? 'Plant seed' : 'Plantar semilla';
    const secondaryActionLabel = firstWatering
      ? appLanguage === 'en' ? 'Later today' : 'Más tarde'
      : nextAction
        ? appLanguage === 'en' ? 'Open sprout' : 'Abrir brote'
        : inboxCount > 0
          ? appLanguage === 'en' ? 'Plant another' : 'Plantar otra'
          : appLanguage === 'en' ? 'View garden' : 'Ver jardín';
    const primaryAccent =
      primaryMode === 'water' ? 'text-[var(--sage)]' :
      primaryMode === 'focus' ? 'text-[var(--seed-accent)]' :
      primaryMode === 'seed' ? 'text-[var(--tone-seed)]' :
      'text-[var(--sage)]';
    const todayPlan = firstWatering
        ? firstWatering?.inbox
          ? appLanguage === 'en'
            ? `Today, decide if "${firstWatering.title}" is still alive.`
            : `Hoy conviene decidir si "${firstWatering.title}" sigue viva.`
          : appLanguage === 'en'
            ? `Today, water ${allThirstyNotes.length} idea${allThirstyNotes.length === 1 ? '' : 's'} before moving forward.`
            : `Hoy conviene regar ${allThirstyNotes.length} idea${allThirstyNotes.length === 1 ? '' : 's'} antes de avanzar.`
      : nextAction
        ? appLanguage === 'en'
          ? 'Today, finish one small step and keep the day quiet.'
          : 'Hoy conviene completar un paso pequeño y cerrar el día sin ruido.'
        : inboxCount > 0
          ? appLanguage === 'en'
            ? `Today, decide one of ${inboxCount} waiting seed${inboxCount === 1 ? '' : 's'}.`
            : `Hoy conviene decidir ${Math.min(inboxCount, 1)} semilla${inboxCount === 1 ? '' : ' de las que esperan'}.`
          : learningMemory
            ? appLanguage === 'en'
              ? 'Garden is quiet. Review one lesson or plant something new.'
              : 'Jardín tranquilo. Puedes revisar un aprendizaje o plantar algo nuevo.'
            : appLanguage === 'en'
              ? 'Garden is quiet. Capture an idea or rest without guilt.'
              : 'Jardín tranquilo. Captura una idea o descansa sin culpa.';
    const contextualPhrase = firstWatering
      ? appLanguage === 'en'
        ? 'Before adding more, return to what may still be alive.'
        : 'Antes de sumar más, vuelve a lo que todavía puede seguir vivo.'
      : nextAction
        ? appLanguage === 'en'
          ? 'A small step keeps the sprout awake.'
          : 'Un paso pequeño mantiene el brote despierto.'
        : inboxCount > 0
          ? appLanguage === 'en'
            ? 'Choose one seed. The rest can wait.'
            : 'Elige una semilla. Las demás pueden esperar.'
          : appLanguage === 'en'
            ? 'Your garden is quiet. That is also progress.'
            : 'Tu jardín está tranquilo. Eso también es avance.';
    const gardenMood = firstWatering
      ? {
          label: appLanguage === 'en' ? 'Garden asks for water' : 'El jardín pide agua',
          detail: appLanguage === 'en' ? `${allThirstyNotes.length} idea${allThirstyNotes.length === 1 ? '' : 's'} waiting` : `${allThirstyNotes.length} idea${allThirstyNotes.length === 1 ? '' : 's'} esperando`,
          icon: Droplets,
          tone: 'text-[var(--sage)]',
        }
      : nextAction
        ? {
            label: appLanguage === 'en' ? 'Garden is growing' : 'El jardín está creciendo',
            detail: appLanguage === 'en' ? 'One next step is ready' : 'Hay un siguiente paso listo',
            icon: Sprout,
            tone: 'text-[var(--tone-sprout)]',
          }
        : inboxCount > 0
          ? {
              label: appLanguage === 'en' ? 'Garden is collecting seeds' : 'El jardín junta semillas',
              detail: appLanguage === 'en' ? `${inboxCount} to decide` : `${inboxCount} por decidir`,
              icon: Leaf,
              tone: 'text-[var(--tone-seed)]',
            }
          : {
              label: appLanguage === 'en' ? 'Garden feels calm' : 'El jardín se siente tranquilo',
              detail: appLanguage === 'en' ? 'Nothing urgent today' : 'Nada urgente por hoy',
              icon: CheckCircle2,
              tone: 'text-[var(--sage)]',
            };

    return {
      activeDaysThisMonth,
      allThirstyNotes,
      completedToday,
      contextualPhrase,
      dayAlreadyClosed: Boolean(dayClosure),
      doneTodayText,
      firstWatering,
      gardenMood,
      greeting,
      harvestCount,
      inboxCount,
      learningMemory,
      nextAction,
      plantedToday,
      PrimaryIcon,
      primaryAccent,
      primaryActionLabel,
      primaryDetail,
      primaryEyebrow,
      primaryTitle,
      secondaryActionLabel,
      sproutCount,
      stepsToday,
      todayDate,
      todayPlan,
      todayWeekday,
      wateredTodayCount,
      firstName,
    };
  }, [accountName, notes, wateredToday, wateringStreak]);
  const {
    activeDaysThisMonth,
    allThirstyNotes,
    completedToday,
    contextualPhrase,
    dayAlreadyClosed,
    doneTodayText,
    firstWatering,
    gardenMood,
    greeting,
    harvestCount,
    inboxCount,
    learningMemory,
    nextAction,
    plantedToday,
    PrimaryIcon,
    primaryAccent,
    primaryActionLabel,
    primaryDetail,
    primaryEyebrow,
    primaryTitle,
    secondaryActionLabel,
    sproutCount,
    stepsToday,
    todayDate,
    todayPlan,
    todayWeekday,
    wateredTodayCount,
    firstName,
  } = todayData;
  const GardenMoodIcon = gardenMood.icon;
  const todayRoutes = [
    {
      label: t('seeds'),
      value: inboxCount,
      detail: inboxCount > 0 ? (appLanguage === 'en' ? 'to decide' : 'por decidir') : (appLanguage === 'en' ? 'clear' : 'limpio'),
      icon: Sprout,
      onClick: () => onNavigate('inbox'),
      tone: 'text-[var(--tone-seed)]',
    },
    {
      label: t('sprouts'),
      value: sproutCount,
      detail: nextAction ? (appLanguage === 'en' ? 'next step' : 'siguiente') : (appLanguage === 'en' ? 'active' : 'activos'),
      icon: Target,
      onClick: () => onNavigate('projects'),
      tone: 'text-[var(--tone-sprout)]',
    },
    {
      label: appLanguage === 'en' ? 'Harvests' : 'Cosechas',
      value: harvestCount,
      detail: completedToday > 0 ? (appLanguage === 'en' ? 'today' : 'hoy') : (appLanguage === 'en' ? 'saved' : 'guardados'),
      icon: Archive,
      onClick: () => onNavigate('harvest'),
      tone: 'text-[var(--tone-harvest)]',
    },
  ];
  const todayModules = [
    ...(todayWidgets.includes('watering') ? [{
      id: 'watering',
      icon: Droplets,
      eyebrow: appLanguage === 'en' ? 'Watering' : 'Riego',
      title: allThirstyNotes.length > 0
        ? firstWatering?.title || t('waterNow')
        : t('wateringUpToDate'),
      detail: allThirstyNotes.length > 0
        ? `${daysSince(firstWatering?.lastWateredAt || firstWatering?.createdAt)} ${appLanguage === 'en' ? 'days still' : 'días quieta'} · ${allThirstyNotes.length} ${t('wateringQueue')}`
        : doneTodayText,
      metric: allThirstyNotes.length > 0 ? `${allThirstyNotes.length}` : 'OK',
      action: allThirstyNotes.length > 0 ? t('waterNow') : (appLanguage === 'en' ? 'View garden' : 'Ver jardín'),
      onClick: () => allThirstyNotes.length > 1 ? onShowWateringQueue() : firstWatering ? onOpenWatering(firstWatering.id) : onNavigate('garden'),
      tone: 'text-[var(--sage)]',
    }] : []),
    ...(todayWidgets.includes('learning') && learningMemory ? [{
      id: 'learning',
      icon: Archive,
      eyebrow: appLanguage === 'en' ? 'Learned' : 'Lo aprendido',
      title: learningMemory.title,
      detail: learningMemory.reflection?.trim()
        ? `“${learningMemory.reflection}”`
        : learningMemory.takeaway?.trim()
          ? `${appLanguage === 'en' ? 'Left you' : 'Te dejó'}: ${learningMemory.takeaway}`
          : appLanguage === 'en' ? 'Closure saved' : 'Cierre guardado',
      metric: `${Math.max(0, daysSince(learningMemory.harvestedAt || learningMemory.updatedAt || learningMemory.createdAt))}d`,
      action: appLanguage === 'en' ? 'Open' : 'Abrir',
      onClick: () => onNavigate('harvest'),
      tone: 'text-[var(--tone-harvest)]',
    }] : []),
    ...(todayWidgets.includes('path') ? [{
      id: 'path',
      icon: CalendarIcon,
      eyebrow: t('path'),
      title: appLanguage === 'en' ? `${activeDaysThisMonth} active days this month` : `${activeDaysThisMonth} días activos este mes`,
      detail: appLanguage === 'en'
        ? `${plantedToday} planted · ${wateredTodayCount} watered · ${completedToday} closed today`
        : `${plantedToday} plantadas · ${wateredTodayCount} riegos · ${completedToday} cierres hoy`,
      metric: String(activeDaysThisMonth),
      action: appLanguage === 'en' ? 'Calendar' : 'Calendario',
      onClick: () => onNavigate('calendar'),
      tone: 'text-[var(--sage)]',
    }] : []),
  ];
  const primaryClick = () => {
    if (firstWatering) {
      onOpenWatering(firstWatering.id);
      return;
    }
    if (nextAction) {
      onFocusNote(nextAction.note.id);
      return;
    }
    if (inboxCount > 0) {
      onNavigate('inbox');
      return;
    }
    onStartPlanting();
  };
  const secondaryClick = () => {
    if (firstWatering) {
      onSkipWatering(firstWatering.id);
      return;
    }
    if (nextAction) {
      onSelectNote(nextAction.note.id);
      return;
    }
    if (inboxCount > 0) {
      onStartPlanting();
      return;
    }
    onNavigate('garden');
  };
  const savedIntention = dailyIntention.trim();
  const cleanIntentionDraft = intentionDraft.trim();
  const saveIntention = () => {
    setDailyIntention(cleanIntentionDraft);
    setIsEditingIntention(!cleanIntentionDraft);
  };
  const closeDaySummary = () => {
    setShowDaySummary(false);
    setIntentionOutcome('');
  };

  useEffect(() => {
    setIntentionDraft(dailyIntention);
    setIsEditingIntention(!dailyIntention.trim());
  }, [dailyIntention]);

  return (
    <motion.div
      key="today-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="space-y-4 pb-2 md:pb-8"
    >
      <div>
        <div className="min-w-0">
          <p className="text-sm font-medium capitalize text-[var(--text-muted)]">{todayWeekday} · {todayDate}</p>
          <h3 className="mt-0.5 truncate text-3xl font-semibold tracking-tight text-[var(--earth)]">{greeting}, {firstName}</h3>
          <p className="mt-1 max-w-[22rem] text-sm font-medium leading-relaxed text-[var(--text-muted)]">{todayPlan}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-[var(--sage)] shadow-sm ring-1 ring-[var(--border)]">{doneTodayText}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] shadow-sm ring-1 ring-[var(--border)]">
              <GardenMoodIcon size={12} className={gardenMood.tone} />
              {gardenMood.label}
            </span>
            {completedToday > 0 && (
              <span className="rounded-full bg-[var(--tone-harvest-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--tone-harvest)] ring-1 ring-[var(--tone-harvest-border)]">
                {appLanguage === 'en'
                  ? `${completedToday} closure${completedToday === 1 ? '' : 's'} today`
                  : `${completedToday} cierre${completedToday === 1 ? '' : 's'} hoy`}
              </span>
            )}
          </div>
        </div>
      </div>

      <form
        className="flex min-h-[3.25rem] items-center gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)]/86 px-3 py-2 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          onQuickCapture();
        }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] text-[var(--sage)]">
          <Leaf size={16} />
        </span>
        <input
          value={quickNote}
          onChange={(event) => setQuickNote(event.target.value)}
          placeholder={appLanguage === 'en' ? 'Plant a quick seed...' : 'Planta una semilla rápida...'}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/62"
        />
        <button
          type="submit"
          disabled={!quickNote.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sage)] text-[var(--on-sage)] shadow-sm transition disabled:bg-[var(--bg-app)] disabled:text-[var(--text-muted)] disabled:shadow-none"
          aria-label={appLanguage === 'en' ? 'Plant quick seed' : 'Plantar semilla rápida'}
        >
          <Plus size={17} />
        </button>
      </form>

      <section className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface-strong)]/82 p-3 shadow-sm">
        {isEditingIntention ? (
          <form
            className="flex items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveIntention();
            }}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] text-[var(--sage)]">
              <Target size={17} />
            </span>
            <label className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {appLanguage === 'en' ? 'Choose a small direction' : 'Elige una dirección pequeña'}
              </span>
              <input
                value={intentionDraft}
                onChange={(event) => setIntentionDraft(event.target.value)}
                placeholder={appLanguage === 'en' ? 'Today I want to care for...' : 'Hoy quiero cuidar...'}
                className="mt-0.5 h-8 w-full bg-transparent text-base font-semibold text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/62"
              />
            </label>
            <button
              type="submit"
              disabled={!cleanIntentionDraft}
              className="h-9 shrink-0 rounded-full bg-[var(--sage)] px-3 text-xs font-semibold text-[var(--on-sage)] shadow-sm transition disabled:bg-[var(--bg-app)] disabled:text-[var(--text-muted)] disabled:shadow-none"
            >
              {appLanguage === 'en' ? 'Save' : 'Guardar'}
            </button>
          </form>
        ) : (
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] text-[var(--sage)]">
              <CheckCircle2 size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {appLanguage === 'en' ? 'Today you are caring for' : 'Hoy estás cuidando'}
              </p>
              <p className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-[var(--earth)]">{savedIntention}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setIsEditingIntention(true)}
                className="h-8 rounded-full bg-[var(--bg-app)] px-3 text-xs font-semibold text-[var(--sage)] ring-1 ring-[var(--border)]"
              >
                {appLanguage === 'en' ? 'Edit' : 'Cambiar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDailyIntention('');
                  setIntentionDraft('');
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--earth)]"
                aria-label={appLanguage === 'en' ? 'Clear today intention' : 'Borrar intención de hoy'}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-soft))] p-4 shadow-sm sm:p-5">
        <p className="mb-4 rounded-full bg-[var(--bg-app)] px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
          {contextualPhrase}
        </p>
        <button type="button" onClick={primaryClick} className="flex w-full items-start gap-4 text-left">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] shadow-sm ring-1 ring-[var(--border)] ${primaryAccent}`}>
            <PrimaryIcon size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{primaryEyebrow}</span>
            <span className="mt-1 block truncate text-xl font-semibold tracking-tight text-[var(--earth)]">{primaryTitle}</span>
            <span className="mt-1 block line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">{primaryDetail}</span>
          </span>
          <ChevronRight size={18} className="mt-3 shrink-0 text-[var(--text-muted)]" />
        </button>
        <div className="mt-5 grid grid-cols-[1.4fr_1fr] gap-2">
          <button
            onClick={primaryClick}
            className="flex h-11 items-center justify-center rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] shadow-sm active:translate-y-px soft-interaction"
          >
            {primaryActionLabel}
          </button>
          <button
            onClick={secondaryClick}
            className="flex h-11 items-center justify-center rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)] ring-1 ring-[var(--border)] active:translate-y-px soft-interaction"
          >
            {secondaryActionLabel}
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-[var(--text-muted)]">
            {appLanguage === 'en'
              ? `${wateredTodayCount} watered · ${stepsToday} steps · ${completedToday} harvests today`
              : `${wateredTodayCount} riegos · ${stepsToday} pasos · ${completedToday} cosechas hoy`}
          </p>
          <button
            type="button"
            onClick={() => {
              if (dayAlreadyClosed) {
                onNavigate('harvest');
                return;
              }
              setIntentionOutcome('');
              setShowDaySummary(true);
            }}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 ring-[var(--border)] transition-colors ${
              dayAlreadyClosed
                ? 'bg-[var(--surface-strong)] text-[var(--text-muted)]'
                : 'bg-[var(--bg-app)] text-[var(--sage)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {dayAlreadyClosed ? <CheckCircle2 size={14} /> : <Archive size={14} />}
            {dayAlreadyClosed
              ? appLanguage === 'en' ? 'Day closed' : 'Día cerrado'
              : appLanguage === 'en' ? 'Close day' : 'Cerrar día'}
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setShowTodayMore(value => !value)}
        className="mx-auto flex h-9 items-center gap-1.5 rounded-full bg-[var(--surface-strong)] px-4 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--sage)]"
      >
        {showTodayMore
          ? appLanguage === 'en' ? 'Hide garden state' : 'Ocultar estado'
          : appLanguage === 'en' ? 'View garden state' : 'Ver estado'}
        <ChevronDown size={14} className={`transition-transform ${showTodayMore ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {showTodayMore && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-3"
          >
            {todayWidgets.includes('summary') && (
              <section className="grid grid-cols-3 gap-1.5 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-strong)] p-1.5 shadow-sm">
                {todayRoutes.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="flex min-h-[5.25rem] min-w-0 flex-col items-center justify-center rounded-[1rem] px-1.5 py-2.5 text-center soft-interaction hover:bg-[var(--surface-hover)]"
                  >
                    <div className="flex min-w-0 items-center justify-center gap-1.5">
                      <item.icon size={14} className={item.tone} />
                      <p className="text-lg font-semibold leading-none text-[var(--earth)]">{item.value}</p>
                    </div>
                    <p className="mt-1 w-full truncate text-[10px] font-medium text-[var(--text-muted)]">{item.label}</p>
                    <p className="mt-0.5 w-full truncate text-[9px] font-semibold text-[var(--text-muted)]/75">{item.detail}</p>
                  </button>
                ))}
              </section>
            )}

            {todayModules.length > 0 && (
              <section className="grid gap-3">
                {todayModules.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-left shadow-sm transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)]">
                        <item.icon size={18} className={item.tone} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{item.eyebrow}</span>
                        <span className="mt-1 block truncate text-[15px] font-semibold text-[var(--earth)]">{item.title}</span>
                        <span className="mt-1 block line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">{item.detail}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-black text-[var(--sage)]">{item.metric}</span>
                        <ChevronRight size={16} className="text-[var(--text-muted)]" />
                      </span>
                    </div>
                    <span className="mt-3 inline-flex h-8 items-center rounded-full bg-[var(--bg-app)] px-3 text-xs font-semibold text-[var(--sage)]">
                      {item.action}
                    </span>
                  </button>
                ))}
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDaySummary && (
          <motion.div
            className="fixed inset-0 z-[75] flex items-end justify-center bg-black/20 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-md sm:items-center sm:pb-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDaySummary}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.24)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {appLanguage === 'en' ? 'Day summary' : 'Resumen del día'}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--earth)]">
                    {appLanguage === 'en' ? 'What moved today?' : '¿Qué se movió hoy?'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeDaySummary}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--text-muted)]"
                  aria-label={appLanguage === 'en' ? 'Close day summary' : 'Cerrar resumen del día'}
                >
                  <X size={16} />
                </button>
              </div>

              {dailyIntention.trim() && (
                <div className="mt-4 rounded-2xl bg-[var(--bg-app)] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {appLanguage === 'en' ? 'Intention' : 'Intención'}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[var(--earth)]">{dailyIntention}</p>
                </div>
              )}

              {savedIntention && (
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-3">
                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                    {appLanguage === 'en' ? 'Did you move your intention?' : '¿Lograste mover tu intención?'}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { id: 'yes', label: appLanguage === 'en' ? 'Yes' : 'Sí' },
                      { id: 'some', label: appLanguage === 'en' ? 'A little' : 'Un poco' },
                      { id: 'no', label: appLanguage === 'en' ? 'Not today' : 'No hoy' },
                    ].map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setIntentionOutcome(option.id as 'yes' | 'some' | 'no')}
                        className={`h-10 rounded-full px-2 text-xs font-semibold transition ${
                          intentionOutcome === option.id
                            ? 'bg-[var(--sage)] text-[var(--on-sage)] shadow-sm'
                            : 'bg-[var(--surface-strong)] text-[var(--text-muted)] ring-1 ring-[var(--border)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: appLanguage === 'en' ? 'Planted' : 'Plantadas', value: plantedToday, icon: Leaf },
                  { label: appLanguage === 'en' ? 'Watered' : 'Riegos', value: wateredTodayCount, icon: Droplets },
                  { label: appLanguage === 'en' ? 'Moved' : 'Avances', value: stepsToday, icon: Target },
                  { label: appLanguage === 'en' ? 'Harvests' : 'Cosechas', value: completedToday, icon: Archive },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl bg-[var(--bg-app)] p-3 text-center">
                    <item.icon size={16} className="mx-auto text-[var(--sage)]" />
                    <p className="mt-1 text-xl font-semibold leading-none text-[var(--earth)]">{item.value}</p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-[var(--text-muted)]">{item.label}</p>
                  </div>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  {dailyIntention.trim()
                    ? appLanguage === 'en'
                      ? `What did "${dailyIntention}" leave you today?`
                      : `¿Qué te dejó "${dailyIntention}" hoy?`
                    : appLanguage === 'en'
                      ? 'One last reflection'
                      : 'Una última reflexión'}
                </span>
                <textarea
                  value={dayReflection}
                  onChange={(event) => setDayReflection(event.target.value)}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3 text-sm font-medium leading-relaxed text-[var(--earth)] outline-none focus:border-[var(--border)]"
                  placeholder={appLanguage === 'en' ? 'Write one sentence...' : 'Escribe una frase...'}
                />
              </label>

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onCloseDay(dayReflection, dailyIntention, intentionOutcome);
                    setDayReflection('');
                    closeDaySummary();
                  }}
                  className="h-11 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] shadow-sm"
                >
                  {appLanguage === 'en' ? 'Save closure' : 'Guardar cierre'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDayReflection('');
                    closeDaySummary();
                  }}
                  className="h-11 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                >
                  {appLanguage === 'en' ? 'Not now' : 'Ahora no'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InboxView({
  notes,
  quickNote,
  setQuickNote,
  onQuickCapture,
  onCultivate,
  onComplete,
  onSaveLater,
  onDelete,
  onSelectNote,
  onShowActions,
  recentlyCreatedNoteId,
  onStartPlanting,
}: {
  notes: SeedNote[];
  quickNote: string;
  setQuickNote: (value: string) => void;
  onQuickCapture: () => void;
  onCultivate: (id: string) => void;
  onComplete: (id: string) => void;
  onSaveLater: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectNote: (id: string) => void;
  onShowActions: (id: string) => void;
  recentlyCreatedNoteId: string | null;
  onStartPlanting: () => void;
}) {
  const inboxNotes = useMemo(() => notes.filter(note => note.inbox), [notes]);

  return (
    <motion.div
      key="inbox-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="pb-2 md:pb-8"
    >
      <div className="mb-5">
        <h3 className="text-3xl font-semibold tracking-tight text-[var(--earth)]">{t('seeds')}</h3>
        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">{inboxNotes.length} {t('pendingSeeds')}</p>
      </div>

      <div className={inboxNotes.length === 0 ? '' : 'space-y-3'}>
        {inboxNotes.length === 0 ? (
          <EmptyStatePanel
            icon={Inbox}
            eyebrow={appLanguage === 'en' ? 'Seedbed clear' : 'Semillero limpio'}
            title={t('noPendingSeeds')}
            detail={appLanguage === 'en'
              ? 'Capture ideas without organizing them. They will wait here until you decide what deserves a next step.'
              : 'Captura ideas sin ordenarlas. Van a esperar aquí hasta que decidas cuál merece un siguiente paso.'}
            actionLabel={appLanguage === 'en' ? 'Plant a seed' : 'Plantar semilla'}
            onAction={onStartPlanting}
          />
        ) : inboxNotes.map((note) => {
          const hasUsefulDescription = note.content.trim().toLowerCase() !== note.title.trim().toLowerCase();
          const cardDescription = hasUsefulDescription
            ? note.content
            : t('readyToDecide');

          return (
            <GestureNoteSurface
              key={note.id}
              onPress={() => onSelectNote(note.id)}
              onSwipeRight={() => onCultivate(note.id)}
              onSwipeLeft={() => onSaveLater(note.id)}
              onLongPress={() => onShowActions(note.id)}
              rightLabel="Brote"
              rightIcon={Sprout}
              rightTone="bg-[var(--tone-sprout)] text-[var(--on-sage)]"
              leftLabel="Luego"
              leftIcon={Archive}
              leftTone="bg-[var(--tone-warning)] text-[var(--on-sage)]"
              wrapperClassName={IDEA_CARD_WRAPPER}
              className={`${IDEA_CARD_SURFACE} ${recentlyCreatedNoteId === note.id ? 'bg-[var(--sage)]/10' : ''}`}
            >
              <button onClick={(event) => { event.stopPropagation(); onSelectNote(note.id); }} className={IDEA_CARD_ROW}>
                <span className={`${IDEA_ICON_TILE} bg-[var(--tone-seed-bg)] text-[var(--tone-seed)] ring-[var(--tone-seed-border)]`}>
                  <Sprout size={15} />
                </span>
                  <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">{note.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-sm leading-relaxed text-[var(--text-muted)]">{cardDescription}</span>
                  <span className="mt-1 block text-[11px] font-medium text-[var(--text-muted)]">
                    {appLanguage === 'en' ? 'Created' : 'Creada'} {formatShortDate(note.createdAt)}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-[var(--text-muted)]" />
              </button>
              <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-4 pb-3 pl-[4rem]">
                <button onClick={(event) => { event.stopPropagation(); onComplete(note.id); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[var(--sage)] px-3 text-xs font-semibold text-[var(--on-sage)] active:translate-y-px soft-interaction">
                  <CheckCircle2 size={13} /> {t('done')}
                </button>
                <button onClick={(event) => { event.stopPropagation(); onCultivate(note.id); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[var(--bg-app)] px-3 text-xs font-semibold text-[var(--sage)] active:translate-y-px soft-interaction hover:bg-[var(--surface-hover)]">
                  <Sprout size={13} /> {t('project')}
                </button>
                <button onClick={(event) => { event.stopPropagation(); onShowActions(note.id); }} className="grid h-9 w-9 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--sage)]" aria-label="Más opciones">
                  <MoreHorizontal size={15} />
                </button>
              </div>
            </GestureNoteSurface>
          );
        })}
      </div>
    </motion.div>
  );
}

function ProjectsView({
  notes,
  onSelectNote,
  onFocusNote,
  onToggleTask,
  onOpenWatering,
  onTogglePause,
  onShowActions,
  onStartSprout,
  getProgress,
}: {
  notes: SeedNote[];
  onSelectNote: (id: string) => void;
  onFocusNote: (id: string) => void;
  onToggleTask: (noteId: string, taskId: string) => void;
  onOpenWatering: (id: string) => void;
  onTogglePause: (id: string) => void;
  onShowActions: (id: string) => void;
  onStartSprout: () => void;
  getProgress: (note: SeedNote) => number;
}) {
  const sortedProjects = useMemo(() => {
    return notes
      .filter(note => !note.inbox && note.isGrowth && note.growthStage !== 'bloom')
      .sort((a, b) => {
        const aScore = (wateringDue(a) ? 10 : 0) + daysSince(a.lastWateredAt || a.createdAt);
        const bScore = (wateringDue(b) ? 10 : 0) + daysSince(b.lastWateredAt || b.createdAt);
        return bScore - aScore;
      });
  }, [notes]);
  const recommended = sortedProjects.find(note => note.tasks.some(task => !task.completed)) || sortedProjects[0];
  const recommendedTask = recommended?.tasks.find(task => !task.completed);

  return (
    <motion.div
      key="projects-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="space-y-5 pb-2 md:pb-8"
    >
      <section>
        <h3 className="text-3xl font-semibold tracking-tight text-[var(--earth)]">{t('sprouts')}</h3>
        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
          {appLanguage === 'en'
            ? `${sortedProjects.length} active project${sortedProjects.length === 1 ? '' : 's'}`
            : `${sortedProjects.length} proyecto${sortedProjects.length === 1 ? '' : 's'} activo${sortedProjects.length === 1 ? '' : 's'}`}
        </p>
      </section>

      {recommended && (
        <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Siguiente</p>
              <h4 className="mt-1 truncate text-xl font-semibold tracking-tight text-[var(--earth)]">{recommended.title}</h4>
              <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                {recommendedTask?.text || 'Agrega el siguiente paso para poder enfocarte.'}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-app)]">
                <motion.div className="h-full bg-[var(--sage)]" animate={{ width: `${getProgress(recommended)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:w-56">
              <button
                onClick={() => onFocusNote(recommended.id)}
                className="rounded-full bg-[var(--sage)] px-4 py-3 text-sm font-semibold text-[var(--on-sage)] shadow-sm active:translate-y-px soft-interaction"
              >
                Enfocar
              </button>
              <button
                onClick={() => recommendedTask ? onToggleTask(recommended.id, recommendedTask.id) : onSelectNote(recommended.id)}
                className="rounded-full bg-[var(--bg-app)] px-4 py-3 text-sm font-semibold text-[var(--sage)] active:translate-y-px soft-interaction"
              >
                {recommendedTask ? 'Hecho' : 'Editar'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {sortedProjects.length === 0 ? (
          <EmptyStatePanel
            icon={Sprout}
            eyebrow={appLanguage === 'en' ? 'No active sprouts' : 'Sin brotes activos'}
            title={appLanguage === 'en' ? 'Nothing needs steps yet' : 'Nada necesita pasos todavía'}
            detail={appLanguage === 'en'
              ? 'When an idea is worth moving, turn it into a sprout with one five-minute next step.'
              : 'Cuando una idea valga la pena, conviértela en brote con un solo siguiente paso de 5 minutos.'}
            actionLabel={appLanguage === 'en' ? 'Create sprout' : 'Crear brote'}
            onAction={onStartSprout}
          />
        ) : sortedProjects.map(note => {
          const nextTask = note.tasks.find(task => !task.completed);
          const progress = getProgress(note);
          const needsWater = wateringDue(note) && !note.paused;

          return (
            <GestureNoteSurface
              key={note.id}
              onPress={() => onSelectNote(note.id)}
              onSwipeRight={() => onOpenWatering(note.id)}
              onSwipeLeft={() => onTogglePause(note.id)}
              onLongPress={() => onShowActions(note.id)}
              rightLabel="Regar"
              leftLabel={note.paused ? 'Reanudar' : 'Pausar'}
              leftIcon={Pause}
              wrapperClassName={IDEA_CARD_WRAPPER}
              className={IDEA_CARD_SURFACE}
            >
              <button onClick={(event) => { event.stopPropagation(); onSelectNote(note.id); }} className={IDEA_CARD_ROW}>
                <span className={`${IDEA_ICON_TILE} ${needsWater ? 'bg-[var(--tone-water-bg)] text-[var(--tone-water)] ring-[var(--tone-water-border)]' : 'bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)] ring-[var(--tone-sprout-border)]'}`}>
                  {needsWater ? <Droplets size={17} /> : <Sprout size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">{note.title}</span>
                  <span className="mt-0.5 block line-clamp-1 text-sm font-medium text-[var(--text-muted)]">{nextTask?.text || 'Sin pasos pendientes'}</span>
                  <span className="mt-1 block text-[11px] font-medium text-[var(--text-muted)]">
                    {appLanguage === 'en' ? 'Created' : 'Creada'} {formatShortDate(note.createdAt)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-xs font-semibold text-[var(--sage)]">{progress}%</span>
              </button>
              <div className="mx-4 h-1 overflow-hidden rounded-full bg-[var(--bg-app)]">
                <motion.div className="h-full bg-[var(--sage)]" animate={{ width: `${progress}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3">
                <button onClick={(event) => { event.stopPropagation(); onFocusNote(note.id); }} className="h-9 rounded-full bg-[var(--sage)] px-3 text-xs font-semibold text-[var(--on-sage)] soft-interaction">
                  Foco
                </button>
                <button onClick={(event) => { event.stopPropagation(); nextTask ? onToggleTask(note.id, nextTask.id) : onSelectNote(note.id); }} className="h-9 rounded-full bg-[var(--bg-app)] px-3 text-xs font-semibold text-[var(--sage)] soft-interaction">
                  {nextTask ? 'Hecho' : 'Editar'}
                </button>
                <button onClick={(event) => { event.stopPropagation(); needsWater ? onOpenWatering(note.id) : onSelectNote(note.id); }} className={`h-9 rounded-full px-3 text-xs font-semibold soft-interaction ${needsWater ? 'bg-[var(--tone-water-bg)] text-[var(--tone-water)] ring-1 ring-[var(--tone-water-border)]' : 'bg-[var(--bg-app)] text-[var(--text-muted)]'}`}>
                  {needsWater ? 'Regar' : 'Ver'}
                </button>
              </div>
            </GestureNoteSurface>
          );
        })}
      </section>
    </motion.div>
  );
}

function HarvestView({ notes, onSelectNote, onStartPlanting }: { notes: SeedNote[]; onSelectNote: (id: string) => void; onStartPlanting: () => void }) {
  const harvestData = useMemo(() => {
    const harvests = notes
      .filter(note => note.growthStage === 'bloom')
      .sort((a, b) => (b.harvestedAt || b.createdAt) - (a.harvestedAt || a.createdAt));
    const totalMinutes = harvests.reduce((sum, note) => sum + (note.focusedMinutes || 0), 0);
    const learningCount = harvests.filter(note => note.reflection?.trim() || note.takeaway?.trim()).length;
    const featuredLearning = harvests.find(note => note.reflection?.trim() || note.takeaway?.trim()) || harvests[0];
    const remainingHarvests = featuredLearning ? harvests.filter(note => note.id !== featuredLearning.id) : harvests;
    return { featuredLearning, harvests, learningCount, remainingHarvests, totalMinutes };
  }, [notes]);
  const { featuredLearning, harvests, learningCount, remainingHarvests, totalMinutes } = harvestData;

  return (
    <motion.div key="harvest-view" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="space-y-5 pb-2 md:pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-strong),var(--surface-soft))] p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Archivo vivo</p>
            <h3 className="mt-1 text-3xl font-serif font-black text-[var(--earth)]">Lo aprendido</h3>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[var(--text-muted)]">
              Cierres breves de ideas terminadas. No es diario: es memoria útil de lo que ya te dejó avanzar.
            </p>
          </div>
          <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] shadow-sm sm:grid">
            <Archive size={20} />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Ideas', value: harvests.length },
            { label: 'Aprendizajes', value: learningCount },
            { label: 'Min', value: totalMinutes },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] px-3 py-3 text-center">
              <p className="text-2xl font-serif font-black text-[var(--earth)]">{item.value}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {harvests.length === 0 ? (
        <EmptyStatePanel
          icon={Archive}
          eyebrow={appLanguage === 'en' ? 'Living archive' : 'Archivo vivo'}
          title={appLanguage === 'en' ? 'No harvests yet' : 'Todavía no hay cosechas'}
          detail={appLanguage === 'en'
            ? 'Complete a small step cycle and Seeds will save what changed, what you learned and what can grow next.'
            : 'Completa un ciclo pequeño y Seeds guardará qué cambió, qué aprendiste y qué podría crecer después.'}
          actionLabel={appLanguage === 'en' ? 'Plant first idea' : 'Plantar primera idea'}
          onAction={onStartPlanting}
        />
      ) : (
        <>
          {featuredLearning && (
            <button
              type="button"
              onClick={() => onSelectNote(featuredLearning.id)}
              className="w-full overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] text-left shadow-sm soft-interaction hover:shadow-md"
            >
              <div className="grid gap-0 lg:grid-cols-[1fr_14rem]">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--tone-harvest)]">
                      {featuredLearning.reflection?.trim() || featuredLearning.takeaway?.trim() ? 'Último aprendizaje' : 'Cosecha reciente'}
                    </p>
                    <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      {formatShortDate(featuredLearning.harvestedAt || featuredLearning.createdAt)}
                    </span>
                  </div>
                  <h4 className="mt-3 font-serif text-3xl font-black leading-tight text-[var(--earth)]">{featuredLearning.title}</h4>
                  {featuredLearning.reflection?.trim() ? (
                    <p className="mt-4 text-xl font-semibold leading-snug text-[var(--earth)]">
                      “{featuredLearning.reflection}”
                    </p>
                  ) : (
                    <div className="mt-4 rounded-[1.35rem] border border-dashed border-[var(--border)] bg-[var(--bg-app)]/55 px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--earth)]">Sin cierre todavía</p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">Puedes añadir lo aprendido cuando esta idea vuelva a importarte.</p>
                    </div>
                  )}
                  {featuredLearning.takeaway?.trim() && (
                    <p className="mt-3 rounded-[1.35rem] bg-[var(--bg-app)] px-4 py-3 text-sm font-semibold leading-relaxed text-[var(--sage)]">
                      Me dejó: {featuredLearning.takeaway}
                    </p>
                  )}
                </div>
                <div className="flex border-t border-[var(--border)] bg-[var(--bg-app)]/60 p-4 lg:border-l lg:border-t-0">
                  <div className="grid w-full grid-cols-3 gap-2 text-center lg:grid-cols-1">
                    <span className="rounded-2xl bg-[var(--surface-strong)] px-2 py-3 text-[10px] font-black text-[var(--sage)]">{featuredLearning.tasks.length} pasos</span>
                    <span className="rounded-2xl bg-[var(--surface-strong)] px-2 py-3 text-[10px] font-black text-[var(--sage)]">{featuredLearning.focusedMinutes || 0} min</span>
                    <span className="rounded-2xl bg-[var(--surface-strong)] px-2 py-3 text-[10px] font-black text-[var(--sage)]">{STAGE_META[featuredLearning.growthStage].shortLabel}</span>
                  </div>
                </div>
              </div>
            </button>
          )}

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {remainingHarvests.map(note => {
              const hasLearning = Boolean(note.reflection?.trim() || note.takeaway?.trim());

              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelectNote(note.id)}
                  className="rounded-[1.65rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-left shadow-sm soft-interaction hover:bg-[var(--surface-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                        {hasLearning ? 'Aprendizaje' : 'Sin cierre'}
                      </p>
                      <h4 className="mt-1 truncate text-xl font-serif font-black text-[var(--earth)]">{note.title}</h4>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      {formatShortDate(note.harvestedAt || note.createdAt)}
                    </span>
                  </div>
                  {note.reflection?.trim() ? (
                    <p className="mt-3 line-clamp-3 text-sm font-semibold leading-relaxed text-[var(--earth)]">“{note.reflection}”</p>
                  ) : (
                    <p className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-app)]/55 px-3 py-2 text-sm font-semibold text-[var(--text-muted)]">
                      Sin cierre todavía
                    </p>
                  )}
                  {note.takeaway?.trim() && (
                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-[var(--sage)]">Me dejó: {note.takeaway}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-black text-[var(--sage)]">{note.tasks.length} pasos</span>
                    <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-black text-[var(--sage)]">{note.focusedMinutes || 0} min</span>
                    <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-black text-[var(--text-muted)]">{note.seedType || 'idea'}</span>
                  </div>
                </button>
              );
            })}
          </section>
        </>
      )}
    </motion.div>
  );
}

function FocusView({
  notes,
  theme,
  focusNoteId,
  onAddTinyStep,
  onOpenWatering,
  onSelectNote,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onLogFocus,
  onPickFocus,
  onExit,
}: {
  notes: SeedNote[];
  theme: Theme;
  focusNoteId: string | null;
  onAddTinyStep: (id: string, text?: string) => void;
  onOpenWatering: (id: string) => void;
  onSelectNote: (id: string) => void;
  onToggleTask: (noteId: string, taskId: string) => void;
  onUpdateTask: (noteId: string, taskId: string, text: string) => void;
  onDeleteTask: (noteId: string, taskId: string) => void;
  onLogFocus: (id: string, minutes: number) => void;
  onPickFocus: (id: string) => void;
  onExit: () => void;
}) {
  const focusCandidates = useMemo(() => notes
    .filter(note => !note.inbox && !note.paused && note.growthStage !== 'bloom')
    .sort((a, b) => {
      const aScore = (wateringDue(a) ? 10 : 0) + daysSince(a.lastWateredAt || a.createdAt);
      const bScore = (wateringDue(b) ? 10 : 0) + daysSince(b.lastWateredAt || b.createdAt);
      return bScore - aScore;
    }), [notes]);
  const focusNote = focusCandidates.find(note => note.id === focusNoteId) || focusCandidates[0];
  const [step, setStep] = useState('');
  const [duration, setDuration] = useState(10);
  const [remaining, setRemaining] = useState(10 * 60);
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sessionStartCompleted, setSessionStartCompleted] = useState(0);
  const [sessionSummary, setSessionSummary] = useState<{ minutes: number; steps: number; growth: number } | null>(null);
  const [liveActivityEndTimestamp, setLiveActivityEndTimestamp] = useState<number | null>(null);
  const [confirmExit, setConfirmExit] = useState<'exit' | 'edit' | null>(null);
  const nextTask = focusNote?.tasks.find(task => !task.completed);
  const completedSteps = focusNote?.tasks.filter(task => task.completed).length || 0;
  const progress = focusNote?.tasks.length ? Math.round((completedSteps / focusNote.tasks.length) * 100) : 0;
  const isDay = new Date().getHours() >= 6 && new Date().getHours() < 19;
  const visibleTasks = focusNote?.tasks.slice(0, 5) || [];
  const hiddenTaskCount = Math.max(0, (focusNote?.tasks.length || 0) - visibleTasks.length);
  const sessionCompletedSteps = Math.max(0, completedSteps - sessionStartCompleted);
  const focusGrowthProgress = Math.min(100, Math.max(progress, progress + sessionCompletedSteps * 6));
  const focusOptions = useMemo(() => focusCandidates.map(note => ({
    value: note.id,
    label: note.title,
    description: note.tasks.find(task => !task.completed)?.text || 'Lista para enfocar',
  })), [focusCandidates]);

  useEffect(() => {
    if (!active || !focusNote) return;

    const timer = window.setInterval(() => {
      setRemaining(value => {
        if (value <= 1) {
          window.clearInterval(timer);
          setActive(false);
          setFinished(true);
          void stopFocusLiveActivity();
          setLiveActivityEndTimestamp(null);
          onLogFocus(focusNote.id, duration);
          setSessionSummary({
            minutes: duration,
            steps: Math.max(0, completedSteps - sessionStartCompleted),
            growth: progress,
          });
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active, completedSteps, duration, focusNote?.id, progress, sessionStartCompleted]);

  useEffect(() => {
    setActive(false);
    setFinished(false);
    setSessionSummary(null);
    setRemaining(duration * 60);
    void stopFocusLiveActivity();
    setLiveActivityEndTimestamp(null);
  }, [focusNote?.id, duration]);

  useEffect(() => {
    if (!active || !focusNote || liveActivityEndTimestamp == null) return;
    void updateFocusLiveActivity({
      noteId: focusNote.id,
      title: focusNote.title,
      subtitle: nextTask?.text || 'Mantén una sola acción.',
      endTimestamp: liveActivityEndTimestamp,
      progress,
    });
  }, [active, focusNote, liveActivityEndTimestamp, nextTask?.text, progress]);

  const startFocus = (minutes: number) => {
    setDuration(minutes);
    setRemaining(minutes * 60);
    setFinished(false);
    setSessionSummary(null);
    setSessionStartCompleted(completedSteps);
    setActive(true);
    const endTimestamp = Date.now() + minutes * 60 * 1000;
    setLiveActivityEndTimestamp(endTimestamp);
    void startFocusLiveActivity({
      noteId: focusNote.id,
      title: focusNote.title,
      subtitle: nextTask?.text || 'Mantén una sola acción.',
      endTimestamp,
      progress,
    });
  };

  const stopFocus = () => {
    const elapsed = Math.max(1, Math.ceil((duration * 60 - remaining) / 60));
    if (active && focusNote) {
      onLogFocus(focusNote.id, elapsed);
      setSessionSummary({
        minutes: elapsed,
        steps: Math.max(0, completedSteps - sessionStartCompleted),
        growth: progress,
      });
      setFinished(true);
    }
    setActive(false);
    void stopFocusLiveActivity();
    setLiveActivityEndTimestamp(null);
  };

  const requestExit = (intent: 'exit' | 'edit') => {
    if (active) {
      setConfirmExit(intent);
      return;
    }

    if (intent === 'edit') {
      onSelectNote(focusNote.id);
    }
    onExit();
  };

  const confirmFocusExit = () => {
    const intent = confirmExit || 'exit';
    setConfirmExit(null);
    stopFocus();
    if (intent === 'edit') {
      onSelectNote(focusNote.id);
    }
    onExit();
  };

  const completeCurrentTask = () => {
    if (!focusNote || !nextTask) return;
    onToggleTask(focusNote.id, nextTask.id);
  };

  const addFocusStep = () => {
    if (!focusNote || !step.trim()) return;
    onAddTinyStep(focusNote.id, step);
    setStep('');
  };

  const formattedTime = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
  const setFocusDuration = (minutes: number) => {
    setDuration(minutes);
    setRemaining(minutes * 60);
  };

  if (!focusNote) {
    return (
      <motion.div key="focus-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-2 md:pb-8">
        <div className="rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] p-8 text-center">
          <Target className="mx-auto text-[var(--sage)] opacity-40 mb-4" size={44} />
          <p className="font-serif text-3xl text-[var(--earth)]">Nada urgente ahora</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">Tu jardín no tiene ideas activas pendientes.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="focus-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-40 overflow-y-auto app-scrollbar ${isDay ? 'bg-[#f4f7f2]' : 'bg-[#07110d]'} text-[var(--text-main)]`}
    >
      <div className="relative min-h-screen overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.85rem)] sm:px-6">
        <div className={`absolute inset-0 ${isDay ? 'bg-[linear-gradient(180deg,#f7faf5_0%,#edf4ed_100%)]' : 'bg-[linear-gradient(180deg,#07110d_0%,#122019_100%)]'}`} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(126,158,116,0.18),transparent_62%)]" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2.35rem)] w-full max-w-[72rem] flex-col">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => requestExit('exit')}
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-strong)]/80 text-[var(--sage)] shadow-sm ring-1 ring-black/5 backdrop-blur-xl soft-interaction"
              aria-label="Salir de enfoque"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-semibold text-[var(--earth)]">{active ? 'Enfoque activo' : 'Enfoque'}</p>
              <p className="text-xs font-medium text-[var(--text-muted)]">{completedSteps}/{focusNote.tasks.length} pasos</p>
            </div>
            <button
              onClick={() => requestExit('edit')}
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-strong)]/80 text-[var(--text-muted)] shadow-sm ring-1 ring-black/5 backdrop-blur-xl soft-interaction"
              aria-label="Editar idea"
            >
              <Settings size={17} />
            </button>
          </div>

          <main className="flex flex-1 flex-col justify-center py-5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] md:items-center md:gap-5 md:py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
            <section className="order-1 overflow-hidden rounded-[2rem] border border-white/55 bg-[var(--surface-strong)]/82 shadow-[0_28px_90px_rgba(39,53,43,0.16)] ring-1 ring-black/[0.03] backdrop-blur-2xl md:rounded-[2.4rem]">
              <div className="px-5 pb-5 pt-6 text-center md:px-7 md:pb-7 md:pt-8">
                <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-[var(--bg-app)]/82 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                  <Target size={13} className="text-[var(--sage)]" />
                  <span>{active ? 'Respira y sigue' : `Bloque de ${duration} min`}</span>
                </div>
                <p className="mt-5 font-mono text-[4.4rem] font-semibold leading-none tracking-tight text-[var(--earth)] tabular-nums sm:text-7xl md:text-[5.4rem]">{formattedTime}</p>
                <h2 className="mx-auto mt-5 max-w-sm text-balance text-2xl font-semibold leading-tight tracking-tight text-[var(--earth)] md:text-[1.75rem]">
                  {nextTask?.text || 'Elige un primer paso pequeño'}
                </h2>
                <p className="mx-auto mt-2 max-w-sm line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                  {focusNote.title}
                </p>

                <div className={`relative mx-auto mt-5 flex h-40 max-w-xs items-end justify-center overflow-hidden rounded-[1.75rem] md:mt-7 md:h-[23rem] md:max-w-none md:rounded-[2rem] ${isDay ? 'bg-gradient-to-b from-[#edf8ef] via-[#f7fbf4] to-white' : 'bg-gradient-to-b from-[#122018] via-[#183021] to-[#edf7ea]'}`}>
                  <div className="absolute bottom-8 h-5 w-40 rounded-full bg-green-900/10 blur-md" />
                  <div className="pointer-events-none absolute inset-x-10 top-8 hidden h-28 rounded-full bg-white/35 blur-3xl md:block" />
                  <motion.div
                    key={`${focusNote.id}-${completedSteps}`}
                    initial={{ scale: 0.9, y: 6, opacity: 0.85 }}
                    animate={{
                      scale: active ? [1, 1.04, 1] : 1,
                      y: active ? [0, -3, 0] : 0,
                      opacity: 1,
                    }}
                    transition={{ duration: 2.8, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
                    className="relative z-10 origin-bottom md:scale-[1.18]"
                  >
                    <PlantIllustration
                      stage={focusNote.growthStage}
                      progress={focusGrowthProgress}
                      isGrowth={focusNote.isGrowth || active}
                      theme={theme}
                    />
                  </motion.div>
                  <AnimatePresence>
                    {active && sessionCompletedSteps > 0 && (
                      <motion.div
                        key={sessionCompletedSteps}
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.94 }}
                        className="absolute right-4 top-4 rounded-full bg-white/82 px-3 py-1.5 text-xs font-semibold text-[var(--sage)] shadow-sm backdrop-blur-xl"
                      >
                        +{sessionCompletedSteps} cultivo
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-[var(--bg-app)] md:max-w-md">
                  <motion.div className="h-full bg-[var(--sage)]" animate={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="border-y border-[var(--border)]/80 px-5 py-3">
                <div className="grid grid-cols-3 gap-2 rounded-full bg-[var(--bg-app)] p-1">
                  {[5, 10, 25].map(minutes => (
                    <button
                      key={minutes}
                      type="button"
                      disabled={active}
                      onClick={() => setFocusDuration(minutes)}
                      className={`h-9 rounded-full text-sm font-semibold transition-all disabled:opacity-50 ${
                        duration === minutes ? 'bg-[var(--surface-strong)] text-[var(--earth)] shadow-sm' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {minutes}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 py-5">
                <button
                  onClick={active ? stopFocus : () => startFocus(duration)}
                  className="h-14 w-full rounded-full bg-[var(--sage)] text-base font-semibold text-[var(--on-sage)] shadow-sm active:translate-y-px soft-interaction"
                >
                  {active ? 'Guardar sesión' : 'Empezar'}
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={completeCurrentTask}
                    disabled={!nextTask}
                    className="h-11 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)] disabled:opacity-40 soft-interaction"
                  >
                    Hecho
                  </button>
                  <button
                    onClick={() => onOpenWatering(focusNote.id)}
                    disabled={active}
                    className="h-11 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--text-muted)] disabled:opacity-45 soft-interaction"
                  >
                    Regar
                  </button>
                </div>
              </div>
            </section>

            <section className="order-2 mt-4 overflow-hidden rounded-[1.65rem] border border-[var(--border)] bg-[var(--surface-strong)]/78 shadow-sm backdrop-blur-xl md:mt-0 md:rounded-[2.2rem] md:bg-[var(--surface-strong)]/84 md:shadow-[0_24px_80px_rgba(22,31,25,0.10)]">
              <div className="border-b border-[var(--border)] px-4 py-4 md:px-6 md:py-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Pasos de enfoque</p>
                <h3 className="mt-1 line-clamp-2 text-2xl font-semibold tracking-tight text-[var(--earth)] md:text-3xl">{focusNote.title}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                  {nextTask ? 'Trabaja una acción a la vez. Marca lo que avance y deja lo demás fuera.' : 'Agrega un primer paso pequeño para darle dirección a esta sesión.'}
                </p>
              </div>
              <div className="px-4 py-3 md:px-5 md:py-4">
                {focusNote.tasks.length === 0 ? (
                  <p className="py-2 text-sm font-medium text-[var(--text-muted)]">Agrega un paso para que enfoque tenga dirección.</p>
                ) : visibleTasks.map(task => (
                  <div key={task.id} className={`flex items-center gap-3 border-b border-[var(--border)] py-2.5 last:border-b-0 md:py-3.5 ${task.completed ? 'opacity-50' : ''}`}>
                    <button
                      onClick={() => onToggleTask(focusNote.id, task.id)}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-transform active:scale-90 ${task.completed ? 'border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)]' : 'border-[var(--border)] text-transparent'}`}
                      aria-label={task.completed ? 'Marcar paso pendiente' : 'Completar paso'}
                    >
                      <CheckCircle2 size={15} />
                    </button>
                    <input
                      value={task.text}
                      onChange={(event) => onUpdateTask(focusNote.id, task.id, event.target.value)}
                      readOnly={active}
                      className={`min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[var(--earth)] outline-none read-only:cursor-default md:text-base ${task.completed ? 'line-through' : ''}`}
                      placeholder="Describe este paso"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteTask(focusNote.id, task.id)}
                      disabled={active}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tone-danger-bg)] hover:text-[var(--tone-danger)] disabled:pointer-events-none disabled:opacity-0"
                      aria-label="Eliminar paso"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {hiddenTaskCount > 0 && (
                  <p className="pt-2 text-center text-xs font-semibold text-[var(--text-muted)]">+{hiddenTaskCount} pasos más</p>
                )}
                <div className="mt-3 flex gap-2 md:mt-4">
                  <input
                    value={step}
                    onChange={(event) => setStep(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addFocusStep();
                      }
                    }}
                    placeholder="Nuevo paso"
                    className="h-11 min-w-0 flex-1 rounded-full bg-[var(--bg-app)] px-4 text-sm font-medium text-[var(--earth)] outline-none"
                  />
                  <button
                    onClick={addFocusStep}
                    disabled={!step.trim()}
                    className="h-11 rounded-full bg-[var(--earth)] px-4 text-sm font-semibold text-white disabled:opacity-45"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </section>

            {!active && (
              <details className="mt-3 overflow-hidden rounded-[1.45rem] border border-[var(--border)] bg-[var(--surface-strong)]/60 backdrop-blur-xl md:col-start-2">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--text-muted)]">
                  Cambiar idea
                  <ChevronDown size={16} />
                </summary>
                <div className="border-t border-[var(--border)] px-4 py-3">
                  <AppSelect
                    value={focusNote.id}
                    onChange={onPickFocus}
                    ariaLabel="Elegir idea para enfoque"
                    options={focusOptions}
                  />
                </div>
              </details>
            )}

            <AnimatePresence>
              {finished && sessionSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mt-3 rounded-[1.45rem] border border-[var(--border)] bg-[var(--surface-strong)]/78 p-4 shadow-sm backdrop-blur-xl md:col-start-2"
                >
                  <p className="text-sm font-semibold text-[var(--earth)]">Sesión guardada</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{sessionSummary.minutes} min · {sessionSummary.steps} pasos · {sessionSummary.growth}% de avance</p>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {confirmExit && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/18 px-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Cerrar enfoque"
              className="w-full max-w-[21rem] rounded-[1.75rem] border border-white/60 bg-[var(--surface-strong)] p-5 text-center shadow-[0_24px_80px_rgba(20,30,24,0.24)]"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            >
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)]">
                <Target size={20} />
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-[var(--earth)]">Cerrar enfoque</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                Seeds guardará los minutos trabajados. Puedes seguir con el mismo paso si todavía no quieres salir.
              </p>
              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmExit(null)}
                  className="h-12 rounded-full bg-[var(--sage)] text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                >
                  Seguir enfocando
                </button>
                <button
                  type="button"
                  onClick={confirmFocusExit}
                  className="h-12 rounded-full bg-[var(--bg-app)] text-sm font-semibold text-[var(--text-muted)] soft-interaction"
                >
                  Salir y guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const TREE_PALETTES: Record<Theme, {
  trunk: string;
  branch: string;
  leaf1: string;
  leaf2: string;
  leaf3: string;
  leaf4: string;
  fruit: string;
}> = {
  earth: {
    trunk: 'from-[#6b4428] via-[#8b5a32] to-[#a96b3b]',
    branch: 'bg-[#8b5a32]',
    leaf1: 'bg-gradient-to-br from-green-300 to-emerald-700',
    leaf2: 'bg-gradient-to-bl from-lime-300 to-green-700',
    leaf3: 'bg-gradient-to-br from-lime-200 via-green-400 to-emerald-700',
    leaf4: 'bg-gradient-to-br from-green-300 to-emerald-800',
    fruit: 'bg-gradient-to-br from-amber-200 to-orange-500',
  },
  forest: {
    trunk: 'from-[#3f2a1d] via-[#5a3b25] to-[#775132]',
    branch: 'bg-[#5a3b25]',
    leaf1: 'bg-gradient-to-br from-emerald-600 to-green-950',
    leaf2: 'bg-gradient-to-bl from-lime-500 to-emerald-900',
    leaf3: 'bg-gradient-to-br from-green-400 via-emerald-700 to-green-950',
    leaf4: 'bg-gradient-to-br from-emerald-500 to-green-950',
    fruit: 'bg-gradient-to-br from-yellow-200 to-lime-500',
  },
  bloom: {
    trunk: 'from-[#7b4a37] via-[#a26255] to-[#c78a7a]',
    branch: 'bg-[#a26255]',
    leaf1: 'bg-gradient-to-br from-pink-200 to-rose-500',
    leaf2: 'bg-gradient-to-bl from-fuchsia-200 to-pink-500',
    leaf3: 'bg-gradient-to-br from-white via-pink-200 to-rose-500',
    leaf4: 'bg-gradient-to-br from-rose-200 to-pink-600',
    fruit: 'bg-gradient-to-br from-yellow-100 to-rose-400',
  },
  night: {
    trunk: 'from-[#26324b] via-[#3d4d70] to-[#6478a6]',
    branch: 'bg-[#3d4d70]',
    leaf1: 'bg-gradient-to-br from-sky-300 to-blue-800',
    leaf2: 'bg-gradient-to-bl from-cyan-200 to-indigo-700',
    leaf3: 'bg-gradient-to-br from-white via-sky-300 to-indigo-700',
    leaf4: 'bg-gradient-to-br from-blue-300 to-indigo-900',
    fruit: 'bg-gradient-to-br from-violet-200 to-fuchsia-500',
  },
  jungle: {
    trunk: 'from-[#5b341f] via-[#875027] to-[#b87935]',
    branch: 'bg-[#875027]',
    leaf1: 'bg-gradient-to-br from-lime-300 to-green-800',
    leaf2: 'bg-gradient-to-bl from-yellow-300 to-emerald-700',
    leaf3: 'bg-gradient-to-br from-lime-200 via-green-500 to-teal-800',
    leaf4: 'bg-gradient-to-br from-green-400 to-teal-900',
    fruit: 'bg-gradient-to-br from-orange-200 to-red-500',
  },
  alien: {
    trunk: 'from-[#43206f] via-[#6532a8] to-[#9b5cff]',
    branch: 'bg-[#6532a8]',
    leaf1: 'bg-gradient-to-br from-emerald-200 to-teal-600',
    leaf2: 'bg-gradient-to-bl from-cyan-200 to-fuchsia-600',
    leaf3: 'bg-gradient-to-br from-lime-200 via-teal-300 to-purple-700',
    leaf4: 'bg-gradient-to-br from-fuchsia-300 to-violet-800',
    fruit: 'bg-gradient-to-br from-lime-200 to-fuchsia-500',
  },
  desert: {
    trunk: 'from-[#7c4b29] via-[#a86734] to-[#d49455]',
    branch: 'bg-[#a86734]',
    leaf1: 'bg-gradient-to-br from-lime-200 to-lime-700',
    leaf2: 'bg-gradient-to-bl from-yellow-200 to-green-700',
    leaf3: 'bg-gradient-to-br from-amber-100 via-lime-300 to-green-700',
    leaf4: 'bg-gradient-to-br from-lime-200 to-green-800',
    fruit: 'bg-gradient-to-br from-yellow-200 to-orange-600',
  },
  arctic: {
    trunk: 'from-[#6f8793] via-[#8daab8] to-[#d1edf7]',
    branch: 'bg-[#8daab8]',
    leaf1: 'bg-gradient-to-br from-cyan-100 to-sky-500',
    leaf2: 'bg-gradient-to-bl from-white to-blue-400',
    leaf3: 'bg-gradient-to-br from-white via-cyan-100 to-sky-500',
    leaf4: 'bg-gradient-to-br from-cyan-200 to-blue-600',
    fruit: 'bg-gradient-to-br from-white to-cyan-300',
  },
};

function PlantIllustration({ stage, progress, isGrowth, theme = 'earth' }: { stage: SeedNote['growthStage']; progress: number; isGrowth: boolean; theme?: Theme }) {
  const swayClass = stage !== 'withered' ? 'sway' : '';
  const stemTransition = { type: 'spring' as const, stiffness: 90, damping: 18 };
  const tree = TREE_PALETTES[theme] || TREE_PALETTES.earth;
  
  if (stage === 'seed' && !isGrowth) {
    return (
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div className="absolute bottom-3 w-14 h-2 rounded-full bg-[#3e2723]/15 blur-sm" />
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="absolute w-1.5 h-1.5 rounded-full bg-amber-200/70"
            style={{ left: `${22 + dot * 18}px`, top: `${18 + dot * 7}px` }}
            animate={{ y: [0, -5, 0], opacity: [0.25, 0.75, 0.25] }}
            transition={{ duration: 2.8 + dot * 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={stemTransition}
          className="relative w-8 h-10 bg-gradient-to-br from-[#a9784f] via-[#8b5e3c] to-[#5f3d29] rounded-[55%_45%_50%_50%] rotate-[-18deg] shadow-[inset_-8px_-8px_14px_rgba(0,0,0,0.16),0_14px_28px_rgba(95,61,41,0.18)]"
        >
          <div className="absolute left-2 top-2 h-5 w-1 rounded-full bg-white/25 rotate-12" />
        </motion.div>
        <motion.div 
          animate={{ scale: [1, 1.35, 1], opacity: [0.24, 0.04, 0.24] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-14 h-14 border border-white/40 rounded-full"
        />
      </div>
    );
  }

  if (stage === 'withered') {
    return (
      <div className="relative w-24 h-28 flex flex-col items-center justify-end">
        <div className="absolute bottom-1 w-20 h-3 rounded-full bg-stone-500/20 blur-sm" />
        <motion.div
          initial={{ rotate: 0, opacity: 0.2 }}
          animate={{ rotate: 10, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative w-3 h-20 bg-gradient-to-t from-stone-700 via-stone-500 to-stone-400 rounded-full origin-bottom shadow-sm"
        >
          <div className="absolute left-1/2 top-6 h-9 w-1.5 rounded-full bg-stone-500 origin-bottom rotate-[-45deg]" />
          <div className="absolute right-1/2 top-9 h-8 w-1.5 rounded-full bg-stone-500 origin-bottom rotate-[48deg]" />
        </motion.div>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.75 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="absolute top-4 left-8 h-10 w-12 rounded-full bg-gradient-to-br from-stone-300 to-stone-500 rotate-[-18deg]"
        />
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.55 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="absolute top-8 right-7 h-9 w-10 rounded-full bg-gradient-to-br from-stone-300 to-stone-500 rotate-[20deg]"
        />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ delay: 0.25 }} className="absolute bottom-6">
          <Skull size={15} className="text-[var(--text-muted)]" />
        </motion.div>
      </div>
    );
  }

  if (stage === 'bloom') {
    return (
      <div className={`relative w-28 h-32 flex flex-col items-center justify-end ${swayClass}`}>
        <div className="absolute bottom-1 w-24 h-4 rounded-full bg-green-950/10 blur-sm" />
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={stemTransition}
          className={`relative w-4 h-24 bg-gradient-to-t ${tree.trunk} rounded-full origin-bottom shadow-[inset_-5px_0_8px_rgba(0,0,0,0.14)]`}
        >
          <div className={`absolute left-1/2 top-8 h-12 w-2 rounded-full ${tree.branch} origin-bottom rotate-[-48deg]`} />
          <div className={`absolute right-1/2 top-11 h-11 w-2 rounded-full ${tree.branch} origin-bottom rotate-[48deg]`} />
          <div className={`absolute left-1/2 top-4 h-10 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[-25deg]`} />
          <div className={`absolute right-1/2 top-5 h-10 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[25deg]`} />
        </motion.div>
        {[
          `left-2 top-1 h-16 w-18 ${tree.leaf1}`,
          `right-2 top-2 h-16 w-18 ${tree.leaf2}`,
          `left-1/2 top-[-10px] h-20 w-20 -translate-x-1/2 ${tree.leaf3}`,
          `left-7 top-9 h-14 w-16 ${tree.leaf4}`,
          `right-7 top-10 h-14 w-16 ${tree.leaf2}`,
        ].map((classes, index) => (
          <motion.div
            key={classes}
            initial={{ scale: 0.35, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08 + index * 0.04, ...stemTransition }}
            className={`absolute rounded-full shadow-lg ${classes}`}
          />
        ))}
        {[18, 42, 66].map((left, index) => (
          <motion.span
            key={left}
            className={`absolute h-2.5 w-2.5 rounded-full ${tree.fruit} shadow-sm`}
            style={{ left, top: 34 + (index % 2) * 20 }}
            animate={{ y: [0, -2, 0], opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 2.4 + index * 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    );
  }

  const height = 34 + (progress * 0.48);
  const crownScale = 0.65 + (progress / 220);
  const crownY = 74 - height;
  const branchOneHeight = Math.max(12, Math.min(24, height * 0.5));
  const branchTwoHeight = Math.max(10, Math.min(22, height * 0.44));
  const branchOneTop = Math.max(8, height - branchOneHeight - 8);
  const branchTwoTop = Math.max(12, height - branchTwoHeight - 5);
  return (
    <div className={`relative w-28 h-32 flex flex-col items-center justify-end ${swayClass}`}>
      <div className="absolute bottom-1 w-22 h-4 rounded-full bg-green-950/10 blur-sm" />
      <motion.div
        animate={{ height }}
        transition={stemTransition}
        className={`relative w-3 bg-gradient-to-t ${tree.trunk} rounded-full origin-bottom shadow-[inset_-4px_0_6px_rgba(0,0,0,0.12)]`}
      >
        <motion.div
          className={`absolute left-1/2 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[-42deg]`}
          animate={{ top: branchOneTop, height: branchOneHeight, opacity: progress > 8 ? 1 : 0.45 }}
          transition={stemTransition}
        />
        <motion.div
          className={`absolute right-1/2 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[42deg]`}
          animate={{ top: branchTwoTop, height: branchTwoHeight, opacity: progress > 18 ? 1 : 0.35 }}
          transition={stemTransition}
        />
      </motion.div>
      <motion.div
        animate={{ y: crownY, scale: crownScale }}
        transition={stemTransition}
        className="absolute top-0 left-1/2 -translate-x-1/2 h-20 w-24"
      >
        <motion.div
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, ...stemTransition }}
          className={`absolute left-3 top-7 h-12 w-14 rounded-full ${tree.leaf1} shadow-md`}
        />
        <motion.div
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.14, ...stemTransition }}
          className={`absolute right-3 top-8 h-12 w-14 rounded-full ${tree.leaf2} shadow-md`}
        />
        <motion.div
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.18, ...stemTransition }}
          className={`absolute left-1/2 top-0 h-16 w-16 -translate-x-1/2 rounded-full ${tree.leaf3} shadow-lg`}
        />
        <motion.div
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: progress > 45 ? 1 : 0.65, opacity: progress > 45 ? 1 : 0.55 }}
          transition={{ delay: 0.22, ...stemTransition }}
          className={`absolute left-6 top-12 h-10 w-13 rounded-full ${tree.leaf4} shadow-md`}
        />
      </motion.div>
    </div>
  );
}

function ProductOrbitPreview() {
  const plants = [
    { left: '48%', top: '17%', delay: 0, tone: 'bg-[#b56b3f]' },
    { left: '70%', top: '37%', delay: 0.1, tone: 'bg-[#efd0d8]' },
    { left: '30%', top: '44%', delay: 0.2, tone: 'bg-[#5d4634]' },
    { left: '57%', top: '68%', delay: 0.3, tone: 'bg-[#7ab9d6]' },
    { left: '22%', top: '67%', delay: 0.4, tone: 'bg-[#6d4bb3]' },
  ];

  return (
    <div className="relative min-h-[34rem] overflow-hidden rounded-[2.5rem] border border-[#dfe8dd] bg-[#f9fbf8] shadow-[0_34px_120px_rgba(17,34,23,0.12)]">
      <div className="absolute inset-x-6 top-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#7a8f63]">Planeta Personal</p>
          <h3 className="mt-1 font-serif text-3xl font-black text-[#19251d]">12 ideas creciendo</h3>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#49623e] shadow-sm">3 por regar</span>
      </div>
      <div className="absolute left-1/2 top-[54%] h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#77a960] shadow-[inset_-28px_-32px_70px_rgba(25,47,30,0.24),0_34px_90px_rgba(75,105,63,0.28)]">
        <div className="absolute left-12 top-16 h-16 w-28 rounded-full bg-[#a2bd76] rotate-[-20deg]" />
        <div className="absolute bottom-14 right-12 h-20 w-32 rounded-full bg-[#4d8756] rotate-[18deg]" />
        <div className="absolute right-20 top-24 h-10 w-16 rounded-full bg-[#d7d8a9] rotate-[28deg]" />
        {plants.map((plant) => (
          <motion.div
            key={`${plant.left}-${plant.top}`}
            className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2"
            style={{ left: plant.left, top: plant.top }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: plant.delay }}
          >
            <div className={`absolute bottom-0 left-1/2 h-6 w-8 -translate-x-1/2 rounded-b-xl rounded-t-md ${plant.tone} border border-black/10`} />
            <div className="absolute bottom-5 left-1/2 h-8 w-2 -translate-x-1/2 rounded-full bg-[#355b34]" />
            <div className="absolute bottom-9 left-2 h-5 w-7 rounded-full bg-[#7fb66b]" />
            <div className="absolute bottom-10 right-1 h-5 w-7 rounded-full bg-[#9acb72]" />
          </motion.div>
        ))}
      </div>
      <div className="absolute bottom-6 left-6 right-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Regar', value: '3' },
          { label: 'Enfoque', value: '42m' },
          { label: 'Cosechas', value: '8' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#7b8278]">{item.label}</p>
            <p className="mt-1 font-serif text-2xl font-black text-[#19251d]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniProductStrip() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="rounded-[2rem] border border-[#e3e8df] bg-white p-5 shadow-sm">
        <div className="flex min-h-[18rem] flex-col rounded-[1.5rem] bg-[#f7faf5] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7a8f63]">Hoy</p>
            <Droplets size={20} className="text-[#536f45]" />
          </div>
          <h3 className="mt-3 font-serif text-3xl font-black text-[#1b271f]">Riego diario</h3>
          <p className="mt-2 text-sm font-semibold text-[#667466]">Un pequeño recordatorio para que tus buenas ideas no se queden olvidadas.</p>
          <div className="mt-auto space-y-2 pt-5">
            {['Volver a mirarla', 'Elegir un paso fácil', 'Dejarla más clara'].map((item, index) => (
              <div key={item} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-sm">
                <span className="min-w-0 text-sm font-black leading-snug text-[#253229]">{item}</span>
                <span className="h-2.5 shrink-0 rounded-full bg-[#7a8f63]/25" style={{ width: 36 + index * 14 }} />
              </div>
            ))}
          </div>
        </div>
        <h4 className="mt-5 font-serif text-2xl font-black text-[#1b271f]">Siempre sabes qué hacer</h4>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667466]">Abres Seeds y encuentras una acción simple: plantar algo nuevo, cuidar una idea o avanzar un paso.</p>
      </div>

      <div className="rounded-[2rem] border border-[#e3e8df] bg-white p-5 shadow-sm">
        <div className="flex min-h-[18rem] flex-col rounded-[1.5rem] bg-[#101812] p-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b8d69c]">Concentración</p>
          <div className="mt-8 text-center">
            <p className="font-mono text-6xl font-black">24:18</p>
            <p className="mt-2 text-xs font-black uppercase tracking-widest text-white/55">Una idea, cero ruido</p>
          </div>
          <div className="mt-auto rounded-2xl bg-white/10 p-3">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 rounded-full bg-[#b8d69c]" />
            </div>
            <p className="mt-3 text-sm font-semibold text-white/70">Terminar el primer borrador</p>
          </div>
        </div>
        <h4 className="mt-5 font-serif text-2xl font-black text-[#1b271f]">Entra en modo jardín</h4>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667466]">La app se calma contigo: ves solo una idea, su siguiente paso y cómo crece mientras avanzas.</p>
      </div>

      <div className="rounded-[2rem] border border-[#e3e8df] bg-white p-5 shadow-sm">
        <div className="flex min-h-[18rem] flex-col rounded-[1.5rem] bg-[#eef6ee] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7a8f63]">Cosecha</p>
          <h3 className="mt-3 font-serif text-3xl font-black leading-tight text-[#1b271f]">Idea cosechada</h3>
          <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
            <Archive size={22} className="text-[#536f45]" />
            <p className="mt-4 text-sm font-bold leading-relaxed text-[#536159]">Qué lograste, qué aprendiste y qué podría crecer después.</p>
          </div>
          <button className="mt-auto w-full rounded-2xl bg-[#19251d] py-3 text-sm font-black text-white">Cerrar ciclo</button>
        </div>
        <h4 className="mt-5 font-serif text-2xl font-black text-[#1b271f]">Terminar también se siente bien</h4>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667466]">Cada proyecto cerrado deja una pequeña cosecha: progreso, claridad y ganas para lo siguiente.</p>
      </div>
    </div>
  );
}

function HeroGardenScene() {
  const plants = [
    { left: '30%', top: '33%', delay: 0, pot: '#b46a44', leaves: '#83b86b' },
    { left: '49%', top: '18%', delay: 0.15, pot: '#efbfd1', leaves: '#7fb76d' },
    { left: '66%', top: '42%', delay: 0.3, pot: '#6d4bb3', leaves: '#98c86f' },
    { left: '43%', top: '68%', delay: 0.45, pot: '#7ab9d6', leaves: '#6fae62' },
    { left: '76%', top: '69%', delay: 0.6, pot: '#5d4634', leaves: '#9cc975' },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[#f7faf6]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#eaf6ff_0%,#eef8fb_28%,#f6faf5_56%,#f8faf7_100%)]" />
      <div className="absolute inset-y-0 left-0 w-[72%] bg-[linear-gradient(90deg,rgba(248,250,247,0.94)_0%,rgba(248,250,247,0.76)_48%,rgba(248,250,247,0)_100%)]" />
      <div className="absolute inset-x-0 top-[30%] h-[24rem] bg-[linear-gradient(180deg,rgba(234,246,255,0)_0%,rgba(248,250,247,0.82)_55%,rgba(248,250,247,0)_100%)]" />
      <div className="absolute right-[9%] top-20 h-24 w-24 rounded-full bg-[#ffd56b] shadow-[0_0_90px_rgba(255,213,107,0.42)]" />
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[-15rem] right-[-13rem] h-[38rem] w-[38rem] rounded-full bg-[#78a85f] opacity-50 shadow-[inset_-42px_-48px_90px_rgba(31,50,30,0.26),0_44px_120px_rgba(65,93,55,0.24)] sm:opacity-70 lg:bottom-[-16rem] lg:right-[-7rem] lg:h-[46rem] lg:w-[46rem] lg:opacity-100"
      >
        <div className="absolute left-20 top-28 h-20 w-36 rotate-[-22deg] rounded-full bg-[#a6c879]" />
        <div className="absolute bottom-36 right-28 h-24 w-44 rotate-[17deg] rounded-full bg-[#4d8756]" />
        <div className="absolute right-36 top-36 h-12 w-24 rotate-[26deg] rounded-full bg-[#d7d8a9]" />
        <div className="absolute left-40 bottom-44 h-14 w-28 rotate-[-8deg] rounded-full bg-[#6f9855]" />
        {plants.map((plant) => (
          <motion.div
            key={`${plant.left}-${plant.top}`}
            className="absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2"
            style={{ left: plant.left, top: plant.top }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: plant.delay }}
          >
            <div className="absolute bottom-0 left-1/2 h-7 w-10 -translate-x-1/2 rounded-b-2xl rounded-t-lg border border-black/10" style={{ backgroundColor: plant.pot }} />
            <div className="absolute bottom-6 left-1/2 h-9 w-2 -translate-x-1/2 rounded-full bg-[#355b34]" />
            <div className="absolute bottom-11 left-2 h-6 w-9 rounded-full" style={{ backgroundColor: plant.leaves }} />
            <div className="absolute bottom-12 right-1 h-6 w-9 rounded-full bg-[#a9d17d]" />
          </motion.div>
        ))}
      </motion.div>
      <div className="absolute bottom-16 left-6 hidden rounded-2xl border border-white/70 bg-white/80 px-5 py-4 shadow-[0_18px_60px_rgba(31,45,35,0.14)] backdrop-blur md:block lg:left-[48%]">
        <p className="text-xs font-black text-[#7a8f63]">Riego diario</p>
        <p className="mt-1 text-sm font-bold text-[#1f2d23]">3 ideas listas para revisar</p>
      </div>
      <div className="absolute right-8 top-[42%] hidden rounded-2xl border border-white/70 bg-white/80 px-5 py-4 shadow-[0_18px_60px_rgba(31,45,35,0.14)] backdrop-blur md:block">
        <p className="text-xs font-black text-[#7a8f63]">Enfoque activo</p>
        <p className="mt-1 font-mono text-2xl font-black text-[#1f2d23]">25:00</p>
      </div>
    </div>
  );
}

function LandingPage({
  onEnter,
  onShowLogin,
  onShowRegister,
}: {
  onEnter: () => void;
  onShowLogin: () => void;
  onShowRegister: () => void;
}) {
  const features = [
    { icon: Leaf, title: 'Guarda ideas sin pensarlo tanto', text: 'Escribe eso que se te ocurrió y déjalo crecer poco a poco, sin tener que organizarlo todo desde el primer día.' },
    { icon: Droplets, title: 'Vuelve a lo que vale la pena', text: 'Seeds te recuerda ideas que podrían seguir vivas, para revisarlas en segundos y decidir si quieres darles cariño.' },
    { icon: Target, title: 'Menos distracción, más avance', text: 'Cuando quieras trabajar, eliges una idea y la app te deja con lo justo: foco, pasos y una sensación clara de progreso.' },
    { icon: Box, title: 'Un jardín para cada parte de ti', text: 'Trabajo, estudio, vida personal o proyectos creativos pueden vivir separados, cada uno con su propio planeta visual.' },
  ];
  const ecosystems = [
    { name: 'Pradera', theme: 'earth' as Theme, mood: 'Claro, fresco y tranquilo', sky: '#dff2ff', planet: '#93bd6b', accent: '#f5d36c', plant: 'Pasto suave' },
    { name: 'Bosque', theme: 'forest' as Theme, mood: 'Profundo, calmado y enfocado', sky: '#dce9ef', planet: '#5f7f55', accent: '#b8d69c', plant: 'Pinos pequeños' },
    { name: 'Floración', theme: 'bloom' as Theme, mood: 'Creativo, amable y luminoso', sky: '#ffeaf1', planet: '#f0b6c8', accent: '#fff0a8', plant: 'Cerezos rosados' },
    { name: 'Nocturno', theme: 'night' as Theme, mood: 'Silencioso, íntimo y mental', sky: '#172338', planet: '#526a84', accent: '#f7e9a0', plant: 'Brotes lunares' },
    { name: 'Jungla', theme: 'jungle' as Theme, mood: 'Vivo, intenso y explorador', sky: '#d8f5e2', planet: '#2e8a57', accent: '#ffd166', plant: 'Hojas tropicales' },
    { name: 'Alien', theme: 'alien' as Theme, mood: 'Extraño, divertido y experimental', sky: '#e9ddff', planet: '#7251a7', accent: '#f3ff6b', plant: 'Setas brillantes' },
    { name: 'Desierto', theme: 'desert' as Theme, mood: 'Minimal, cálido y despejado', sky: '#fff0d9', planet: '#d8a35f', accent: '#7cb7d8', plant: 'Cactus ideas' },
    { name: 'Ártico', theme: 'arctic' as Theme, mood: 'Limpio, sereno y sin ruido', sky: '#e5f7fb', planet: '#a9d7e4', accent: '#8aa7d8', plant: 'Cristales verdes' },
  ];
  const [activeEcosystem, setActiveEcosystem] = useState(ecosystems[0]);
  const ecosystemPreviewNotes = useMemo<SeedNote[]>(() => {
    const now = Date.now();
    const makePreviewNote = (
      id: string,
      title: string,
      growthStage: SeedNote['growthStage'],
      ageDays: number,
      seedType: SeedNote['seedType'],
      taskCount = 3,
      completedCount = growthStage === 'bloom' ? taskCount : 1,
    ): SeedNote => ({
      id,
      title,
      content: growthStage === 'bloom'
        ? 'Una idea que ya creció con el tiempo.'
        : 'Una idea tomando forma dentro de tu jardín.',
      createdAt: now - DAY_MS * ageDays,
      updatedAt: now - DAY_MS * Math.max(1, Math.floor(ageDays / 3)),
      tags: [],
      isGrowth: growthStage !== 'seed',
      tasks: Array.from({ length: taskCount }, (_, index) => ({
        id: `${id}-task-${index}`,
        text: index === 0 ? 'Elegir el siguiente paso' : `Avance ${index + 1}`,
        completed: index < completedCount,
      })),
      growthStage,
      lastWateredAt: now - DAY_MS,
      wateringIntervalDays: 7,
      seedType,
      harvestedAt: growthStage === 'bloom' ? now - DAY_MS * Math.max(1, Math.floor(ageDays / 5)) : undefined,
    });

    return [
      makePreviewNote('preview-canopy-1', 'Curso terminado', 'bloom', 48, 'learning', 4, 4),
      makePreviewNote('preview-canopy-2', 'Proyecto lanzado', 'bloom', 42, 'project', 5, 5),
      makePreviewNote('preview-canopy-3', 'Rutina creada', 'bloom', 36, 'goal', 3, 3),
      makePreviewNote('preview-canopy-4', 'Idea convertida en plan', 'bloom', 31, 'idea', 4, 4),
      makePreviewNote('preview-canopy-5', 'Propuesta enviada', 'bloom', 27, 'project', 3, 3),
      makePreviewNote('preview-canopy-6', 'Aprendizaje aplicado', 'bloom', 22, 'learning', 3, 3),
      makePreviewNote('preview-canopy-7', 'Sistema ordenado', 'bloom', 19, 'goal', 4, 4),
      makePreviewNote('preview-canopy-8', 'Idea publicada', 'bloom', 17, 'project', 3, 3),
      makePreviewNote('preview-sprout-1', 'Proyecto en marcha', 'sprout', 14, 'project', 4, 2),
      makePreviewNote('preview-sprout-2', 'Nueva habilidad', 'sprout', 11, 'learning', 3, 1),
      makePreviewNote('preview-sprout-3', 'Meta personal', 'sprout', 9, 'goal', 3, 2),
      makePreviewNote('preview-sprout-4', 'Experimento creativo', 'sprout', 7, 'idea', 2, 1),
      makePreviewNote('preview-sprout-5', 'Plan de lectura', 'sprout', 6, 'learning', 3, 1),
      makePreviewNote('preview-sprout-6', 'Mejora pendiente', 'sprout', 5, 'project', 2, 1),
      makePreviewNote('preview-seed-1', 'Idea nueva', 'seed', 2, 'idea', 0, 0),
      makePreviewNote('preview-seed-2', 'Algo por explorar', 'seed', 1, 'learning', 0, 0),
      makePreviewNote('preview-seed-3', 'Pregunta interesante', 'seed', 1, 'idea', 0, 0),
      makePreviewNote('preview-seed-4', 'Posible proyecto', 'seed', 1, 'project', 0, 0),
    ];
  }, []);

  const welcomeHighlights = [
    { label: 'Planta', value: 'Ideas' },
    { label: 'Cuida', value: 'Proyectos' },
    { label: 'Vuelve', value: 'Foco' },
  ];

  return (
    <main className="min-h-screen overflow-y-auto bg-[#f5f6f2] text-[#111813]">
      <section className="relative min-h-screen overflow-hidden px-5 py-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-8 lg:px-12">
        <HeroGardenScene />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(245,246,242,0.46),rgba(245,246,242,0.94)_62%,#f5f6f2)]" />

        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="Seeds" className="h-12 w-12 rounded-[1.15rem] shadow-sm" />
            <div>
              <p className="text-xl font-semibold leading-none tracking-tight text-[#111813]">Seeds</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#71836b]">Grow What Matters</p>
            </div>
          </div>
          <button onClick={onShowLogin} className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-semibold text-[#1c241f] shadow-sm backdrop-blur-xl transition-colors hover:bg-white">
            Iniciar sesión
          </button>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl grid-cols-1 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-center">
          <section className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6e835d]">
              Bienvenido a Seeds
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mt-5 text-5xl font-semibold leading-[0.96] tracking-tight text-[#101612] sm:text-7xl lg:text-8xl">
              Haz crecer lo que importa.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-[#536159] sm:text-xl lg:mx-0">
              Guarda ideas, conviértelas en pasos pequeños y vuelve a ellas con calma. Un jardín privado para proyectos, hábitos y pensamientos que no quieres perder.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-9 flex flex-col gap-3 sm:mx-auto sm:max-w-md lg:mx-0">
              <button onClick={onShowRegister} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#111813] px-6 text-base font-semibold text-white shadow-[0_18px_50px_rgba(17,24,19,0.22)] transition-transform active:scale-[0.99]">
                Crear cuenta
                <ArrowRight size={18} />
              </button>
              <button onClick={onShowLogin} className="flex h-14 items-center justify-center rounded-2xl border border-white/80 bg-white/78 px-6 text-base font-semibold text-[#111813] shadow-sm backdrop-blur-xl transition-colors hover:bg-white">
                Ya tengo cuenta
              </button>
              <button onClick={onEnter} className="h-12 text-sm font-semibold text-[#647160] transition-colors hover:text-[#111813]">
                Explorar sin cuenta
              </button>
            </motion.div>

            <div className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-2 lg:mx-0">
              {welcomeHighlights.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/70 bg-white/58 px-3 py-3 text-center shadow-sm backdrop-blur-xl">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#7c8876]">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-[#172019]">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="mx-auto w-full max-w-[25rem] rounded-[2.2rem] border border-white/70 bg-white/72 p-4 shadow-[0_30px_90px_rgba(31,45,35,0.16)] backdrop-blur-2xl">
            <div className="rounded-[1.7rem] bg-[#f7faf4] p-4 shadow-inner shadow-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#75856f]">Hoy</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#111813]">Tu jardín</h2>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#6f7d4f] shadow-sm">
                  <Leaf size={22} />
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.45rem] bg-[#dfead8] p-5">
                <div className="relative mx-auto h-48 w-48 rounded-full bg-[#88af68] shadow-[inset_-22px_-28px_48px_rgba(33,61,38,0.22),0_24px_60px_rgba(75,112,70,0.22)]">
                  <div className="absolute left-8 top-9 h-9 w-16 rotate-[-18deg] rounded-full bg-[#b8d69c]" />
                  <div className="absolute bottom-10 right-8 h-12 w-20 rotate-[18deg] rounded-full bg-[#5f935f]" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute bottom-0 left-1/2 h-7 w-8 -translate-x-1/2 rounded-b-2xl rounded-t-lg bg-[#b8794d]" />
                    <div className="absolute bottom-6 left-1/2 h-10 w-1.5 -translate-x-1/2 rounded-full bg-[#315735]" />
                    <div className="absolute bottom-12 left-1 h-6 w-10 rounded-full bg-[#83b86b]" />
                    <div className="absolute bottom-12 right-1 h-6 w-10 rounded-full bg-[#c0df92]" />
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  { title: 'Idea lista para cuidar', detail: 'Elegir el primer paso' },
                  { title: 'Riego pendiente', detail: 'Revisar en 20 segundos' },
                  { title: 'Foco sugerido', detail: '25 minutos sin ruido' },
                ].map((item) => (
                  <div key={item.title} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#edf4e8] text-[#6e835d]">
                      <CheckCircle2 size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#172019]">{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-[#73806f]">{item.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8faf7] text-[#162019]">
      <section className="relative min-h-[88vh] overflow-hidden border-b border-[#e4ebe1] px-5 sm:px-8 lg:px-12">
        <HeroGardenScene />
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between py-6">
          <div className="flex items-center gap-3.5">
            <img src="/icon-192.png" alt="Seeds" className="h-14 w-14 rounded-[1.35rem] shadow-sm" />
            <div>
              <p className="font-serif text-3xl font-black leading-none text-[#1f2d23]">Seeds</p>
              <p className="text-[10px] font-black uppercase text-[#7a8f63]">Grow What Matters</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onShowLogin} className="rounded-full border border-[#dfe8dd] bg-white px-4 py-2 text-sm font-black text-[#1f2d23] shadow-sm transition-colors hover:bg-[#f1f6ef]">
              Iniciar sesión
            </button>
            <button onClick={onShowRegister} className="rounded-full bg-[#1f2d23] px-4 py-2 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#324434]">
              Crear cuenta
            </button>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[68vh] max-w-7xl items-center py-10 sm:py-14">
          <div className="max-w-4xl pb-8">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] font-black uppercase text-[#7a8f63]">
              Un jardín para tus ideas, planes y proyectos
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-6 max-w-4xl font-serif text-5xl font-black leading-[0.95] text-[#162019] sm:text-7xl lg:text-8xl">
              Haz crecer tus ideas.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-7 max-w-2xl text-lg font-semibold leading-relaxed text-[#536159] sm:text-xl">
              Seeds convierte esas ideas que normalmente se pierden en algo que puedes cuidar. Planta lo que se te ocurre, vuelve cuando haga falta y mira cómo toma forma sin sentir que tienes otra app complicada que aprender.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button onClick={onShowRegister} className="rounded-2xl bg-[#1f2d23] px-6 py-4 font-black text-white shadow-[0_18px_50px_rgba(31,45,35,0.22)] transition-colors hover:bg-[#324434]">
                Crear mi jardín
              </button>
              <button onClick={onShowLogin} className="rounded-2xl border border-[#dfe8dd] bg-white px-6 py-4 font-black text-[#1f2d23] shadow-sm transition-colors hover:bg-[#f1f6ef]">
                Ya tengo cuenta
              </button>
              <a href="#producto" className="rounded-2xl px-6 py-4 text-center font-black text-[#536159] transition-colors hover:text-[#1f2d23]">
                Ver producto
              </a>
            </motion.div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {[
                { label: 'Revisar', value: '20s' },
                { label: 'Enfocar', value: '1 idea' },
                { label: 'Guardar', value: 'Siempre' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#dfe8dd] bg-white px-4 py-3 shadow-sm">
                  <p className="text-[9px] font-black uppercase text-[#7b8278]">{item.label}</p>
                  <p className="mt-1 font-serif text-2xl font-black text-[#1b271f]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="producto" className="border-y border-[#e4ebe1] bg-white px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-[10px] font-black uppercase text-[#7a8f63]">Por qué se siente diferente</p>
              <h2 className="mt-4 max-w-3xl font-serif text-5xl font-black leading-[0.98] text-[#162019] sm:text-6xl">No guardes ideas para olvidarlas. Dales un lugar donde crecer.</h2>
            </div>
            <p className="text-lg font-semibold leading-relaxed text-[#536159]">
              Muchas apps terminan siendo cajones llenos de notas. Seeds se siente más como cuidar un jardín: vuelves con curiosidad, eliges algo pequeño y lo haces avanzar.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-[2rem] border border-[#e3e8df] bg-[#f8faf7] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#536f45] shadow-sm">
                  <feature.icon size={22} />
                </div>
                <h3 className="mt-6 font-serif text-2xl font-black text-[#162019]">{feature.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-[#667466]">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8faf7] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <ProductOrbitPreview />
          <div>
            <p className="text-[10px] font-black uppercase text-[#7a8f63]">Mundo 3D</p>
            <h2 className="mt-4 max-w-3xl font-serif text-5xl font-black leading-[0.98] text-[#162019] sm:text-6xl">Tu progreso se vuelve algo que puedes ver.</h2>
            <p className="mt-5 text-lg font-semibold leading-relaxed text-[#536159]">
              En vez de mirar una lista fría, ves un pequeño mundo lleno de ideas. Algunas apenas nacen, otras necesitan atención y otras ya están listas para florecer.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { title: 'Encuentra tu idea rápido', text: 'Tocas una planta y el mundo se acerca a ella, para que no tengas que buscar entre listas interminables.' },
                { title: 'El jardín también respira', text: 'La luz, el movimiento y los ecosistemas hacen que volver a tus ideas se sienta menos como una tarea y más como un ritual.' },
                { title: 'Cada jardín tiene personalidad', text: 'Puedes tener un espacio para trabajo, otro para estudio y otro para tus proyectos personales.' },
                { title: 'Ves cómo va creciendo', text: 'Una idea empieza como semilla, se vuelve brote y puede terminar como árbol cuando la haces avanzar.' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-[#e3e8df] bg-white p-5 shadow-sm">
                  <h3 className="font-serif text-xl font-black text-[#162019]">{item.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667466]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f8faf7] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-black uppercase text-[#7a8f63]">Interfaz</p>
            <h2 className="mt-4 font-serif text-5xl font-black leading-[0.98] text-[#162019] sm:text-6xl">Una app que te invita a volver.</h2>
            <p className="mt-5 text-lg font-semibold leading-relaxed text-[#536159]">
              Seeds no quiere llenarte de botones. Quiere ayudarte a recordar qué importa, elegir un paso pequeño y sentir que tus ideas siguen vivas.
            </p>
          </div>
          <div className="mt-12">
            <MiniProductStrip />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <p className="text-[10px] font-black uppercase text-[#7a8f63]">Ecosistemas</p>
            <h2 className="mt-4 font-serif text-5xl font-black leading-[0.98] text-[#162019] sm:text-6xl">Separa tu vida sin complicarla.</h2>
            <p className="mt-5 text-lg font-semibold leading-relaxed text-[#536159]">
              Tu trabajo, tus estudios, tus planes personales y tus ideas raras no tienen por qué mezclarse. Cada mundo puede tener su propia energía, color y ritmo.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-xl">
              {ecosystems.map((item) => {
                const isActive = activeEcosystem.name === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onMouseEnter={() => setActiveEcosystem(item)}
                    onFocus={() => setActiveEcosystem(item)}
                    onClick={() => setActiveEcosystem(item)}
                    className={`group rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(31,45,35,0.12)] ${isActive ? 'border-[#6e9b58] bg-[#f4faf1] shadow-sm' : 'border-[#e3e8df] bg-[#f8faf7]'}`}
                  >
                    <div className="h-12 rounded-2xl transition-transform duration-200 group-hover:scale-[1.03]" style={{ background: `linear-gradient(135deg, ${item.sky}, ${item.planet} 58%, ${item.accent})` }} />
                    <p className="mt-3 text-sm font-black text-[#1b271f]">{item.name}</p>
                    <p className="mt-1 text-[11px] font-bold leading-snug text-[#667466]">{item.plant}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <Suspense fallback={
              <div className="grid h-[31rem] place-items-center rounded-[2.5rem] border border-[#dfe8dd] bg-[#f8faf7] text-center shadow-[0_34px_120px_rgba(17,34,23,0.12)]">
                <div>
                  <Box className="mx-auto text-[#6e9b58]" size={36} />
                  <p className="mt-4 font-serif text-3xl font-black text-[#162019]">Cargando mundo 3D</p>
                  <p className="mt-2 text-sm font-semibold text-[#667466]">El mismo planeta que verás dentro de Seeds.</p>
                </div>
              </div>
            }>
              <Garden3D
                key={`${activeEcosystem.theme}-preview`}
                notes={ecosystemPreviewNotes}
                theme={activeEcosystem.theme}
                planetName={activeEcosystem.name}
                onSelectNote={() => undefined}
                variant="preview"
              />
            </Suspense>
            <div className="pointer-events-none absolute bottom-6 left-6 right-6 rounded-2xl border border-white/20 bg-black/25 px-5 py-4 text-white shadow-2xl backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Así se ve en la app</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-white/78">{activeEcosystem.mood}. {activeEcosystem.plant} para tus ideas.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl rounded-[2.5rem] bg-[#162019] px-6 py-14 text-center text-white sm:px-12">
          <Sparkles className="mx-auto text-[#b8d69c]" size={28} />
          <h2 className="mx-auto mt-5 max-w-3xl font-serif text-5xl font-black leading-[0.98] sm:text-6xl">Empieza con una idea pequeña. Deja que crezca contigo.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-white/70">
            No necesitas tener todo claro. Solo planta una idea, vuelve cuando puedas y deja que Seeds te ayude a convertirla en algo real.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={onShowRegister} className="rounded-2xl bg-white px-6 py-4 font-black text-[#162019]">
              Crear cuenta
            </button>
            <button onClick={onEnter} className="rounded-2xl border border-white/20 px-6 py-4 font-black text-white">
              Explorar sin cuenta
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthEntryPage({
  mode,
  onBack,
  onSwitchMode,
  onEnter,
  accountName,
  setAccountName,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authConfirmPassword,
  setAuthConfirmPassword,
  authDisabledReason,
  authStatus,
  onSignIn,
  onSignUp,
}: {
  mode: 'login' | 'register';
  onBack: () => void;
  onSwitchMode: () => void;
  onEnter: () => void;
  accountName: string;
  setAccountName: (value: string) => void;
  authEmail: string;
  setAuthEmail: (value: string) => void;
  authPassword: string;
  setAuthPassword: (value: string) => void;
  authConfirmPassword: string;
  setAuthConfirmPassword: (value: string) => void;
  authDisabledReason: string;
  authStatus: string;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  const isRegister = mode === 'register';
  const nameMissing = isRegister && !accountName.trim();
  const registerPasswordIssue = isRegister ? passwordPolicyError(authPassword) : '';
  const confirmPasswordMissing = isRegister && !authConfirmPassword ? 'Confirma tu contraseña para crear tu jardín.' : '';
  const confirmPasswordIssue = isRegister && authConfirmPassword && authPassword !== authConfirmPassword ? 'Las contraseñas no coinciden.' : '';
  const disabledReason =
    nameMissing ? 'Escribe tu nombre para crear tu jardín.' :
    authDisabledReason || registerPasswordIssue || confirmPasswordMissing || confirmPasswordIssue;
  const submit = () => {
    if (disabledReason) return;
    if (isRegister) onSignUp();
    else onSignIn();
  };
  const benefits = isRegister
    ? [
        { title: 'Tus ideas contigo', text: 'Empieza en un dispositivo y vuelve desde otro sin perder lo que estabas cuidando.' },
        { title: 'Sin configurar mil cosas', text: 'Planta una idea ahora. Ya habrá tiempo para darle forma cuando vuelva a llamar tu atención.' },
        { title: 'Recordatorios amables', text: 'El riego te ayuda a volver a ideas buenas sin culpa, presión ni listas eternas.' },
        { title: 'Un paso a la vez', text: 'Cuando quieras avanzar, Seeds te ayuda a mirar una sola idea y hacer algo pequeño.' },
      ]
    : [
        { title: 'Vuelve sin perderte', text: 'Encuentra tus jardines, tus ideas y el siguiente paso que dejaste pendiente.' },
        { title: 'Ideas que piden atención', text: 'Seeds te muestra lo que vale la pena volver a mirar antes de que se enfríe.' },
        { title: 'Foco más fácil', text: 'Retoma una idea, pon un tiempo y avanza sin rodearte de distracciones.' },
        { title: 'Tu progreso guardado', text: 'Cada idea terminada deja claridad para la próxima vez que quieras crear algo.' },
      ];

  return (
    <main className="min-h-dvh overflow-y-auto bg-[#f8faf7] text-[#162019]">
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <button onClick={onBack} className="inline-flex items-center gap-3 rounded-full border border-[#dfe8dd] bg-white px-4 py-2 text-sm font-black text-[#1f2d23] shadow-sm transition-colors hover:bg-[#f1f6ef]">
            <ChevronLeft size={17} />
            <span>Volver</span>
          </button>
          <button onClick={onSwitchMode} className="rounded-full border border-[#dfe8dd] bg-white px-4 py-2 text-sm font-black text-[#536159] shadow-sm transition-colors hover:bg-[#f1f6ef]">
            {isRegister ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-center lg:gap-12">
          <section className="hidden lg:block">
            <div className="flex items-center gap-3.5">
              <img src="/icon-192.png" alt="Seeds" className="h-14 w-14 rounded-[1.35rem] shadow-sm" />
              <div>
                <p className="font-serif text-4xl font-black leading-none text-[#1f2d23]">Seeds</p>
                <p className="text-[10px] font-black uppercase text-[#7a8f63]">Grow What Matters</p>
              </div>
            </div>

            <p className="mt-14 text-[11px] font-black uppercase text-[#7a8f63]">
              {isRegister ? 'Tu jardín empieza aquí' : 'Vuelve a tu jardín'}
            </p>
            <h1 className="mt-5 max-w-3xl font-serif text-6xl font-black leading-[0.94] text-[#162019]">
              {isRegister ? 'Un lugar bonito para no perder tus mejores ideas.' : 'Tus ideas siguen creciendo donde las dejaste.'}
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-relaxed text-[#536159]">
              Seeds te ayuda a guardar lo que se te ocurre, volver con ganas y avanzar poco a poco. Sin tableros infinitos. Sin sentir que tienes que organizar tu vida entera.
            </p>

            <div className="mt-9 grid max-w-2xl grid-cols-2 gap-4">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-2xl border border-[#e3e8df] bg-white p-5 shadow-sm">
                  <CheckCircle2 size={20} className="text-[#6e9b58]" />
                  <h3 className="mt-4 font-serif text-xl font-black text-[#162019]">{benefit.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667466]">{benefit.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 max-w-2xl overflow-hidden rounded-[2rem] border border-[#dfe8dd] bg-[#eef7ed] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-[#7a8f63]">Vista previa</p>
                  <h3 className="mt-1 font-serif text-3xl font-black text-[#162019]">Tu primer jardín</h3>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#49623e] shadow-sm">Guardado</span>
              </div>
              <div className="mt-5 grid grid-cols-[140px_minmax(0,1fr)] gap-5">
                <div className="relative h-36 rounded-full bg-[#78a85f] shadow-[inset_-18px_-24px_44px_rgba(31,50,30,0.24)]">
                  <div className="absolute left-8 top-8 h-8 w-14 rotate-[-18deg] rounded-full bg-[#a6c879]" />
                  <div className="absolute bottom-8 right-6 h-10 w-16 rotate-[16deg] rounded-full bg-[#4d8756]" />
                  <div className="absolute left-14 top-14 h-8 w-8">
                    <div className="absolute bottom-0 left-1/2 h-4 w-6 -translate-x-1/2 rounded-b-xl rounded-t-md bg-[#b46a44]" />
                    <div className="absolute bottom-4 left-1/2 h-5 w-1 -translate-x-1/2 rounded-full bg-[#355b34]" />
                    <div className="absolute bottom-8 left-0 h-4 w-6 rounded-full bg-[#83b86b]" />
                    <div className="absolute bottom-8 right-0 h-4 w-6 rounded-full bg-[#a9d17d]" />
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Ideas por cuidar', value: '3' },
                    { label: 'Buen momento para', value: '25 min' },
                    { label: 'Siguiente paso', value: 'Escribir el primer borrador' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-[#7b8278]">{item.label}</p>
                      <p className="mt-1 text-sm font-black text-[#1f2d23]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[29rem] rounded-[2rem] border border-[#dfe8dd] bg-white p-5 shadow-[0_30px_100px_rgba(31,45,35,0.14)] sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/icon-192.png" alt="Seeds" className="h-11 w-11 rounded-2xl shadow-sm lg:hidden" />
                <div>
                  <p className="text-[11px] font-black uppercase text-[#7a8f63]">{isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</p>
                  <h2 className="mt-1 font-serif text-4xl font-black leading-none text-[#162019]">{isRegister ? 'Crea tu jardín' : 'Entra a tu jardín'}</h2>
                </div>
              </div>
              <Leaf size={24} className="hidden text-[#6e9b58] sm:block" />
            </div>

            <p className="mt-4 text-sm font-semibold leading-relaxed text-[#536159]">
              {isRegister ? 'Crea un jardín privado para esas ideas que quieres recordar, cuidar y convertir en algo real.' : 'Entra a tu jardín y retoma las ideas que estaban esperando un poco de atención.'}
            </p>

            <div className="mt-7 space-y-4">
              {isRegister && (
                <label className="block">
                  <span className="text-xs font-black uppercase text-[#536f45]">Nombre</span>
	                  <input
	                    value={accountName}
	                    onChange={(event) => setAccountName(event.target.value)}
	                    placeholder="Tu nombre"
	                    autoComplete="name"
	                    enterKeyHint="next"
	                    className="mt-2 w-full rounded-2xl border border-[#dfe8dd] bg-[#f8faf7] px-4 py-3 text-sm font-bold text-[#162019] outline-none transition focus:border-[#6e9b58] focus:bg-white focus:ring-2 focus:ring-[#6e9b58]/20"
	                  />
                </label>
              )}
              <label className="block">
                <span className="text-xs font-black uppercase text-[#536f45]">Correo</span>
                <input
	                  type="email"
	                  value={authEmail}
	                  onChange={(event) => setAuthEmail(event.target.value)}
	                  placeholder="tu@email.com"
	                  autoComplete="email"
	                  inputMode="email"
	                  enterKeyHint="next"
	                  className="mt-2 w-full rounded-2xl border border-[#dfe8dd] bg-[#f8faf7] px-4 py-3 text-sm font-bold text-[#162019] outline-none transition focus:border-[#6e9b58] focus:bg-white focus:ring-2 focus:ring-[#6e9b58]/20"
	                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-[#536f45]">Contraseña</span>
                <input
	                  type="password"
	                  value={authPassword}
	                  onChange={(event) => setAuthPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submit();
	                  }}
	                  placeholder="Mayúscula, número y mínimo 6 caracteres"
	                  autoComplete={isRegister ? 'new-password' : 'current-password'}
	                  enterKeyHint={isRegister ? 'next' : 'done'}
	                  className="mt-2 w-full rounded-2xl border border-[#dfe8dd] bg-[#f8faf7] px-4 py-3 text-sm font-bold text-[#162019] outline-none transition focus:border-[#6e9b58] focus:bg-white focus:ring-2 focus:ring-[#6e9b58]/20"
	                />
              </label>
              {isRegister && (
                <>
                  <label className="block">
                    <span className="text-xs font-black uppercase text-[#536f45]">Confirmar contraseña</span>
                    <input
                      type="password"
	                      value={authConfirmPassword}
	                      onChange={(event) => setAuthConfirmPassword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submit();
	                      }}
	                      placeholder="Repite tu contraseña"
	                      autoComplete="new-password"
	                      enterKeyHint="done"
	                      className="mt-2 w-full rounded-2xl border border-[#dfe8dd] bg-[#f8faf7] px-4 py-3 text-sm font-bold text-[#162019] outline-none transition focus:border-[#6e9b58] focus:bg-white focus:ring-2 focus:ring-[#6e9b58]/20"
	                    />
                  </label>
                  <div className="rounded-2xl bg-[#f8faf7] px-4 py-3">
                    <p className="text-[10px] font-black uppercase text-[#7a8f63]">Contraseña segura</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-[#667466]">
                      Usa mínimo 6 caracteres, una mayúscula y un número.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button onClick={submit} disabled={Boolean(disabledReason)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f2d23] px-5 py-4 font-black text-white shadow-[0_18px_50px_rgba(31,45,35,0.22)] transition-colors hover:bg-[#324434] disabled:cursor-not-allowed disabled:opacity-45">
              <span>{isRegister ? 'Crear mi jardín' : 'Entrar a mi jardín'}</span>
              <ArrowRight size={18} />
            </button>
            {(disabledReason || authStatus) && (
              <p className="mt-3 text-xs font-semibold leading-relaxed text-[#667466]">{authStatus || disabledReason}</p>
            )}

            <div className="mt-6 hidden rounded-2xl bg-[#f8faf7] p-4 sm:block">
              <p className="text-xs font-black uppercase text-[#7a8f63]">{isRegister ? 'Qué obtienes' : 'Al entrar'}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#536159]">
                {isRegister ? 'Un lugar simple para ideas de trabajo, estudio o vida personal, con jardines separados y recordatorios amables.' : 'Tus jardines, ideas pendientes y próximos pasos listos para seguir avanzando sin empezar de cero.'}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 text-sm font-bold text-[#667466] sm:flex-row sm:items-center sm:justify-between">
              <button onClick={onSwitchMode} className="text-left text-[#536f45] transition-colors hover:text-[#1f2d23]">
                {isRegister ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
              </button>
              <button onClick={onEnter} className="text-left text-[#536159] transition-colors hover:text-[#1f2d23]">
                Explorar sin cuenta
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const [notes, setNotes] = useState<SeedNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [dailyIntention, setDailyIntention] = useState(() => getStoredItem(`seed-daily-intention-${todayKey}`) || '');
  const [showLanding, setShowLanding] = useState(() => getStoredItem('seed-welcome-v2-seen') !== 'true');
  const [landingRoute, setLandingRoute] = useState<'landing' | 'login' | 'register'>('landing');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [planets, setPlanets] = useState<Planet[]>(() => {
    try {
      const parsed = JSON.parse(getStoredItem('seed-planets') || '[]');
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PLANETS;
    } catch {
      return DEFAULT_PLANETS;
    }
  });
  const [activePlanetId, setActivePlanetId] = useState(() => getStoredItem('seed-active-planet') || DEFAULT_PLANET_ID);
  const [isAddingPlanet, setIsAddingPlanet] = useState(false);
  const [newPlanetName, setNewPlanetName] = useState('');
  const [showPlanetSettings, setShowPlanetSettings] = useState(false);
  const [editingPlanetName, setEditingPlanetName] = useState('');
  const [onboardingStep, setOnboardingStep] = useState(0);
  
  const [theme, setTheme] = useState<Theme>(() => {
    return (getStoredItem('seed-theme') as Theme) || 'earth';
  });

  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<SeedNote['growthStage'] | 'all'>('all');
  const [view, setView] = useState<AppView>('today');
  const [showGardenFullscreen, setShowGardenFullscreen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('seed');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [quickActionsNoteId, setQuickActionsNoteId] = useState<string | null>(null);
  const [recentlyCreatedNoteId, setRecentlyCreatedNoteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState<{
    title: string;
    content: string;
    dueDate: string;
    seedType: NonNullable<SeedNote['seedType']>;
    priority: NonNullable<SeedNote['priority']>;
    planetId: string;
  }>({ title: '', content: '', dueDate: '', seedType: 'idea', priority: 'normal', planetId: DEFAULT_PLANET_ID });
  const [quickEntryPicker, setQuickEntryPicker] = useState<QuickEntryPicker>(null);
  const [showQuickEntryDetails, setShowQuickEntryDetails] = useState(false);
  const [showProjectTodos, setShowProjectTodos] = useState(false);
  const [projectTodos, setProjectTodos] = useState<DraftTodo[]>([]);
  const projectTodoSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );
  const [quickNote, setQuickNote] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [wateringNoteId, setWateringNoteId] = useState<string | null>(null);
  const [wateringNote, setWateringNote] = useState('');
  const [sproutPromptNoteId, setSproutPromptNoteId] = useState<string | null>(null);
  const [sproutFirstStep, setSproutFirstStep] = useState('');
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [flowerReward, setFlowerReward] = useState<{ id: string; title: string } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => getStoredItem('seed-onboarded') !== 'true');
  const [hapticsEnabled, setHapticsEnabled] = useState(() => getStoredBoolean('seed-haptics', true));
  const [soundsEnabled, setSoundsEnabled] = useState(() => getStoredBoolean('seed-sounds', false));
	  const [showSettings, setShowSettings] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('root');
	  const [showMobileMenu, setShowMobileMenu] = useState(false);
	  const [showGardenSwitcher, setShowGardenSwitcher] = useState(false);
	  const [quickEntryViewport, setQuickEntryViewport] = useState<{ height: number | null; offsetTop: number; keyboardOpen: boolean }>({
	    height: null,
	    offsetTop: 0,
	    keyboardOpen: false
	  });
	  const [quickEntryKeyboardReady, setQuickEntryKeyboardReady] = useState(false);
	  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authStatus, setAuthStatus] = useState('');
	  const [syncStatus, setSyncStatus] = useState('');
	  const [isSyncing, setIsSyncing] = useState(false);
	  const applyingRemoteSyncRef = useRef(false);
	  const remoteSyncReadyRef = useRef(false);
	  const autoSyncTimerRef = useRef<number | null>(null);
	  const mobileGardenFullscreenOpenedRef = useRef(false);
	  const mobileMenuRef = useRef<HTMLElement | null>(null);
	  const quickEntryOverlayRef = useRef<HTMLDivElement | null>(null);
	  const mobileMenuGestureRef = useRef({ tracking: false, startX: 0, startY: 0, opened: false });
	  const createMenuTimerRef = useRef<number | null>(null);
	  const createMenuLongPressRef = useRef(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => getStoredItem('seed-notifications') === 'true');
  const [defaultWateringInterval, setDefaultWateringInterval] = useState(() => getStoredNumber('seed-default-watering', 1, 1, 30));
  const [reminderHour, setReminderHour] = useState(() => getStoredNumber('seed-reminder-hour', 9, 0, 23));
  const [todayWidgets, setTodayWidgets] = useState<TodayWidgetId[]>(() => {
    try {
      const parsed = JSON.parse(getStoredItem('seed-today-widgets') || '[]');
      const valid = Array.isArray(parsed)
        ? parsed.filter((id): id is TodayWidgetId => typeof id === 'string' && TODAY_WIDGET_IDS.has(id as TodayWidgetId))
        : [];
      return valid.length > 0 ? valid : DEFAULT_TODAY_WIDGETS;
    } catch {
      return DEFAULT_TODAY_WIDGETS;
    }
  });
  const [account, setAccount] = useState<AccountProfile>(() => {
    try {
      return JSON.parse(getStoredItem('seed-account') || '{"name":"Jardinero Digital","email":"jose@garden.com","role":"Cuidador de ideas"}');
    } catch {
      return { name: 'Jardinero Digital', email: 'jose@garden.com', role: 'Cuidador de ideas' };
    }
  });
  const [harvestNoteId, setHarvestNoteId] = useState<string | null>(null);
  const [recentlyWateredId, setRecentlyWateredId] = useState<string | null>(null);
  const [wateringRitual, setWateringRitual] = useState<{ lastDate: string; streak: number }>(() => {
    try {
      return JSON.parse(getStoredItem('seed-watering-ritual') || '{"lastDate":"","streak":0}');
    } catch {
      return { lastDate: '', streak: 0 };
    }
  });
  const wateredToday = wateringRitual.lastDate === todayKey;
  const accountInitials = getAccountInitials(account.name, account.email);
  const profileStats = useMemo(() => {
    const stats = notes.reduce((total, note) => {
      total.totalFocus += note.focusedMinutes || 0;
      if (note.inbox) total.seeds += 1;
      if (!note.inbox && note.growthStage === 'bloom') total.harvests += 1;
      if (!note.inbox && note.isGrowth && note.growthStage !== 'bloom' && !note.paused) total.active += 1;
      if (!note.inbox && !note.paused && note.growthStage !== 'bloom' && wateringDue(note)) total.needsWater += 1;
      return total;
    }, { totalFocus: 0, seeds: 0, harvests: 0, active: 0, needsWater: 0 });
    const { totalFocus, seeds, harvests, active, needsWater } = stats;
    const season = harvests >= 5
      ? 'Temporada de cosecha'
      : active >= 4
        ? 'Temporada de crecimiento'
        : needsWater > 0
          ? 'Temporada de riego'
          : 'Temporada de siembra';
    return { totalFocus, seeds, harvests, active, needsWater, season };
  }, [notes]);
  const profileAchievements = useMemo(() => [
    { label: 'Primera semilla', active: notes.length > 0 },
    { label: 'Primera cosecha', active: profileStats.harvests > 0 },
    { label: 'Racha de 3 días', active: wateringRitual.streak >= 3 },
    { label: '60 min de enfoque', active: profileStats.totalFocus >= 60 },
  ], [notes.length, profileStats.harvests, profileStats.totalFocus, wateringRitual.streak]);
  useEffect(() => {
    if (!notesLoaded) return;
    const activeNotes = notes.filter(note => note.growthStage !== 'bloom' && note.growthStage !== 'withered' && !note.paused);
    const thirstyNotes = activeNotes
      .filter(note => wateringDue(note))
      .sort((a, b) => {
        const aAge = daysSince(a.lastWateredAt || a.createdAt);
        const bAge = daysSince(b.lastWateredAt || b.createdAt);
        return (priorityWeight(b) + bAge + (b.inbox ? 2 : 0)) - (priorityWeight(a) + aAge + (a.inbox ? 2 : 0));
      });
    const nextStepNote = notes
      .filter(note => !note.inbox && note.isGrowth && !note.paused && note.growthStage !== 'bloom' && !wateringDue(note))
      .map(note => ({ note, task: note.tasks.find(task => !task.completed) }))
      .filter((item): item is { note: SeedNote; task: NonNullable<typeof item.task> } => Boolean(item.task))
      .sort((a, b) => priorityWeight(b.note) - priorityWeight(a.note))[0];
    const firstSeed = notes
      .filter(note => note.inbox)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const widgetTitle = thirstyNotes[0]?.title || nextStepNote?.note.title || firstSeed?.title || 'Planta una semilla';
    const widgetSubtitle = thirstyNotes[0]
      ? (thirstyNotes[0].inbox ? 'Decide si sigue viva' : formatReviewAge(thirstyNotes[0]))
      : nextStepNote
        ? nextStepNote.task.text
        : firstSeed
          ? 'Una idea espera decisión'
          : dailyIntention.trim() || 'Una cosa clara para hoy';
    const widgetAction = thirstyNotes[0]
      ? 'Regar'
      : nextStepNote
        ? 'Enfocar'
        : firstSeed
          ? 'Decidir'
          : 'Plantar';
    void updateSeedWidget({
      title: widgetTitle,
      subtitle: widgetSubtitle,
      action: widgetAction,
      metric: thirstyNotes.length > 0 ? String(thirstyNotes.length) : profileStats.active > 0 ? String(profileStats.active) : String(profileStats.seeds),
      seeds: profileStats.seeds,
      sprouts: profileStats.active,
      harvests: profileStats.harvests,
      watering: thirstyNotes.length,
      streak: wateringRitual.streak,
      updatedAt: Date.now(),
    });
  }, [dailyIntention, notes, notesLoaded, profileStats.active, profileStats.harvests, profileStats.seeds, wateringRitual.streak]);
  const authDisabledReason = !isSupabaseConfigured
    ? 'Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en este despliegue.'
    : !authEmail.trim()
      ? 'Escribe tu correo para continuar.'
      : authPassword.length < 6
        ? 'La contraseña debe tener al menos 6 caracteres.'
        : '';

  // Persistence
  useEffect(() => {
    let cancelled = false;
    migrateLocalNotesToDb()
      .then(loadNotesFromDb)
      .then(loadedNotes => {
        if (!cancelled) setNotes(loadedNotes);
      })
      .finally(() => {
        if (!cancelled) setNotesLoaded(true);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notesLoaded) return;
    let cancelled = false;
    let flushed = false;
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const persist = () => {
      if (cancelled || flushed) return;
      flushed = true;
      void saveNotesToDb(notes);
    };
    const idleId = browserWindow.requestIdleCallback
      ? browserWindow.requestIdleCallback(persist, { timeout: 900 })
      : window.setTimeout(persist, 240);
    const flushIfHidden = () => {
      if (document.visibilityState === 'hidden') persist();
    };

    document.addEventListener('visibilitychange', flushIfHidden);
    window.addEventListener('pagehide', persist);

    return () => {
      cancelled = true;
      if (browserWindow.cancelIdleCallback && browserWindow.requestIdleCallback) {
        browserWindow.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      document.removeEventListener('visibilitychange', flushIfHidden);
      window.removeEventListener('pagehide', persist);
    };
  }, [notes, notesLoaded]);

  const blurQuickEntryFocus = () => {
    if (typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && quickEntryOverlayRef.current?.contains(activeElement)) {
      activeElement.blur();
    }
  };

	  useEffect(() => {
	    if (!isAdding || typeof window === 'undefined') {
	      setQuickEntryViewport({ height: null, offsetTop: 0, keyboardOpen: false });
	      setQuickEntryKeyboardReady(false);
	      return;
	    }

	    setQuickEntryViewport({ height: null, offsetTop: 0, keyboardOpen: false });
	    setQuickEntryKeyboardReady(false);
	    const visualViewport = window.visualViewport;
	    if (!visualViewport) {
	      const readyTimer = window.setTimeout(() => setQuickEntryKeyboardReady(true), 320);
	      return () => window.clearTimeout(readyTimer);
	    }

	    const updateQuickEntryViewport = () => {
	      const keyboardHeight = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
	      const activeElement = document.activeElement;
	      const quickEntryHasFocus = !!activeElement && quickEntryOverlayRef.current?.contains(activeElement);
	      setQuickEntryViewport({
	        height: visualViewport.height,
	        offsetTop: visualViewport.offsetTop,
	        keyboardOpen: keyboardHeight > 120 && !!quickEntryHasFocus
	      });
	    };

	    const firstFrame = window.requestAnimationFrame(() => {
	      updateQuickEntryViewport();
	    });
	    const readyTimer = window.setTimeout(() => {
	      setQuickEntryKeyboardReady(true);
	      updateQuickEntryViewport();
	    }, 320);
	    visualViewport.addEventListener('resize', updateQuickEntryViewport);
	    visualViewport.addEventListener('scroll', updateQuickEntryViewport);

	    return () => {
	      window.cancelAnimationFrame(firstFrame);
	      window.clearTimeout(readyTimer);
	      visualViewport.removeEventListener('resize', updateQuickEntryViewport);
	      visualViewport.removeEventListener('scroll', updateQuickEntryViewport);
	    };
	  }, [isAdding]);

	  useEffect(() => {
	    if (!isAdding || typeof window === 'undefined') return;

	    const focusTimer = window.setTimeout(() => {
	      const activeElement = document.activeElement;
	      if (activeElement && quickEntryOverlayRef.current?.contains(activeElement)) return;
	      const target = quickEntryOverlayRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-quick-entry-autofocus="true"]');
	      target?.focus({ preventScroll: true });
	    }, 420);

	    return () => window.clearTimeout(focusTimer);
	  }, [createMode, isAdding]);

	  useEffect(() => {
	    if (!import.meta.env.DEV || !notesLoaded) return;

    const demoNote: SeedNote = {
      id: 'demo-watering-note',
      planetId: activePlanetId,
      title: 'Idea de prueba por regar',
      content: 'Esta semilla esta atrasada a proposito para probar como se ve el filtro Por regar.',
      createdAt: Date.now() - 5 * DAY_MS,
      tags: [],
      isGrowth: true,
      tasks: [{ id: 'demo-watering-task', text: 'Revisar si esta idea sigue viva', completed: false }],
      growthStage: 'sprout',
      lastWateredAt: Date.now() - 4 * DAY_MS,
      wateringIntervalDays: 1,
      inbox: false,
      seedType: 'idea',
    };

    setNotes(current => {
      const existing = current.find(note => note.id === demoNote.id);
      if (!existing) return [demoNote, ...current];
      if ((existing.planetId || DEFAULT_PLANET_ID) === activePlanetId && wateringDue(existing)) return current;
      return current.map(note => note.id === demoNote.id ? demoNote : note);
    });
  }, [activePlanetId, notesLoaded]);

  useEffect(() => {
    if (!showMobileMenu) return;

    const frame = window.requestAnimationFrame(() => {
      mobileMenuRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showMobileMenu]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const edgeWidth = 26;
    const openDistance = 58;
    const gesturesDisabled =
      showMobileMenu ||
      isAdding ||
      showSettings ||
      showOnboarding ||
      showGardenFullscreen ||
      view === 'focus' ||
      view === 'calendar';

    const resetGesture = () => {
      mobileMenuGestureRef.current = { tracking: false, startX: 0, startY: 0, opened: false };
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (gesturesDisabled || window.innerWidth >= 768) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      if (!touch || touch.clientX > edgeWidth) {
        resetGesture();
        return;
      }

      mobileMenuGestureRef.current = {
        tracking: true,
        startX: touch.clientX,
        startY: touch.clientY,
        opened: false,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const gesture = mobileMenuGestureRef.current;
      if (!gesture.tracking || gesture.opened) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - gesture.startX;
      const deltaY = Math.abs(touch.clientY - gesture.startY);
      const mostlyHorizontal = deltaY < Math.max(34, deltaX * 0.55);

      if (deltaX >= openDistance && mostlyHorizontal) {
        gesture.opened = true;
        gesture.tracking = false;
        setShowMobileMenu(true);
      }

      if (deltaX < -8 || deltaY > 80) {
        resetGesture();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', resetGesture, { passive: true });
    window.addEventListener('touchcancel', resetGesture, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', resetGesture);
      window.removeEventListener('touchcancel', resetGesture);
    };
  }, [isAdding, showGardenFullscreen, showMobileMenu, showOnboarding, showSettings, view]);

  useEffect(() => {
    if (!showMobileMenu || typeof window === 'undefined') return;

    let tracking = false;
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      tracking = true;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = Math.abs(touch.clientY - startY);
      const mostlyHorizontal = Math.abs(deltaX) > deltaY * 1.25;

      if (deltaX <= -58 && mostlyHorizontal) {
        tracking = false;
        setShowMobileMenu(false);
      }
    };

    const reset = () => {
      tracking = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', reset, { passive: true });
    window.addEventListener('touchcancel', reset, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', reset);
      window.removeEventListener('touchcancel', reset);
    };
  }, [showMobileMenu]);

  useEffect(() => {
    if (showCreateMenu && (isAdding || showMobileMenu || showSettings || showGardenFullscreen || view === 'focus' || view === 'calendar')) {
      setShowCreateMenu(false);
    }
  }, [isAdding, showCreateMenu, showGardenFullscreen, showMobileMenu, showSettings, view]);

  useEffect(() => {
    setStoredItem('seed-planets', JSON.stringify(planets));
  }, [planets]);

  useEffect(() => {
    if (!notesLoaded) return;
    const usedPlanetIds = new Set(notes.map(note => note.planetId || DEFAULT_PLANET_ID));
    setPlanets(current => {
      const cleaned = current.filter(planet => {
        const isLegacyDefault = LEGACY_DEFAULT_PLANET_IDS.has(planet.id) && planet.createdAt === 0;
        return !isLegacyDefault || usedPlanetIds.has(planet.id);
      });
      if (cleaned.length === current.length) return current;
      return cleaned.length > 0 ? cleaned : DEFAULT_PLANETS;
    });
  }, [notes, notesLoaded]);

  useEffect(() => {
    if (!planets.some(planet => planet.id === activePlanetId)) {
      setActivePlanetId(planets[0]?.id || DEFAULT_PLANET_ID);
    }
  }, [activePlanetId, planets]);

	  useEffect(() => {
	    setStoredItem('seed-active-planet', activePlanetId);
	  }, [activePlanetId]);

	  useEffect(() => {
	    if (view !== '3D') {
	      mobileGardenFullscreenOpenedRef.current = false;
	      setShowGardenFullscreen(false);
	      return;
	    }

	    if (mobileGardenFullscreenOpenedRef.current || typeof window === 'undefined') return;
	    const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
	    if (!isMobileViewport) return;

	    mobileGardenFullscreenOpenedRef.current = true;
	    const timer = window.setTimeout(() => setShowGardenFullscreen(true), 180);
	    return () => window.clearTimeout(timer);
	  }, [view]);
	
	  useEffect(() => {
	    setStoredItem('seed-theme', theme);
	    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    setStoredItem('seed-default-watering', String(defaultWateringInterval));
  }, [defaultWateringInterval]);

  useEffect(() => {
    setStoredItem('seed-notifications', notificationsEnabled ? 'true' : 'false');
  }, [notificationsEnabled]);

  useEffect(() => {
    setStoredItem('seed-reminder-hour', String(reminderHour));
  }, [reminderHour]);

  useEffect(() => {
    setStoredItem('seed-today-widgets', JSON.stringify(todayWidgets));
  }, [todayWidgets]);

  useEffect(() => {
    setStoredItem('seed-account', JSON.stringify(account));
  }, [account]);

  useEffect(() => {
    setStoredItem(`seed-daily-intention-${todayKey}`, dailyIntention);
  }, [dailyIntention, todayKey]);

  useEffect(() => {
    setStoredItem('seed-watering-ritual', JSON.stringify(wateringRitual));
  }, [wateringRitual]);

  useEffect(() => {
    setStoredItem('seed-haptics', hapticsEnabled ? 'true' : 'false');
  }, [hapticsEnabled]);

  useEffect(() => {
    setStoredItem('seed-sounds', soundsEnabled ? 'true' : 'false');
  }, [soundsEnabled]);

  useEffect(() => {
    preloadSeedSounds();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthEmail(data.session?.user.email || '');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthEmail(nextSession?.user.email || authEmail);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const playMicroSound = (kind: SeedSoundKind, force = false) => {
    playSeedSound(kind, soundsEnabled, force);
  };

  const feel = (kind: 'open' | SeedSoundKind, force = false) => {
    if ((force || hapticsEnabled) && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const pattern =
        kind === 'harvest' ? [10, 28, 14, 36, 18] :
        kind === 'sprout' ? [10, 18, 12] :
        kind === 'plant' ? [8, 20, 10] :
        kind === 'water' ? [6, 14, 6] :
        kind === 'step' ? 8 :
        6;
      navigator.vibrate(pattern);
    }
    if (kind !== 'open') playMicroSound(kind, force);
  };

  useEffect(() => {
    if (!session?.user || !notesLoaded) {
      remoteSyncReadyRef.current = false;
      return;
    }

    let cancelled = false;
    setIsSyncing(true);
    setSyncStatus('Preparando sync entre dispositivos...');

    syncGardenWithSupabase({ planets, notes }, session.user)
      .then(synced => {
        if (cancelled) return;
        applyingRemoteSyncRef.current = true;
        if (synced.planets.length > 0) setPlanets(synced.planets);
        setNotes(synced.notes);
        window.setTimeout(() => {
          applyingRemoteSyncRef.current = false;
          remoteSyncReadyRef.current = true;
        }, 0);
        setSyncStatus(`Sync activo: ${synced.notes.length} ideas en la nube.`);
      })
      .catch(error => {
        if (!cancelled) setSyncStatus(error instanceof Error ? error.message : 'No se pudo preparar el sync.');
      })
      .finally(() => {
        if (!cancelled) setIsSyncing(false);
      });

    return () => { cancelled = true; };
  }, [session?.user?.id, notesLoaded]);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    const userId = session.user.id;
    const markRemoteApplyDone = () => window.setTimeout(() => { applyingRemoteSyncRef.current = false; }, 0);

    const handleNotePayload = (payload: any) => {
      applyingRemoteSyncRef.current = true;
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) setNotes(current => current.filter(note => note.id !== deletedId));
        markRemoteApplyDone();
        return;
      }

      const row = payload.new;
      if (!row?.data?.id) {
        markRemoteApplyDone();
        return;
      }

      const incoming = normalizeNote({
        ...row.data,
        id: row.data?.id || row.id,
        planetId: row.data?.planetId || row.planet_id || DEFAULT_PLANET_ID,
      });

      if (!incoming) {
        markRemoteApplyDone();
        return;
      }

      setNotes(current => {
        const existing = current.find(note => note.id === incoming.id);
        if (existing && noteUpdatedAt(existing) > noteUpdatedAt(incoming)) return current;
        if (existing) return current.map(note => note.id === incoming.id ? incoming : note);
        return [incoming, ...current];
      });
      markRemoteApplyDone();
    };

    const handlePlanetPayload = (payload: any) => {
      applyingRemoteSyncRef.current = true;
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) setPlanets(current => current.filter(planet => planet.id !== deletedId));
        markRemoteApplyDone();
        return;
      }

      const row = payload.new;
      if (!row?.id) {
        markRemoteApplyDone();
        return;
      }

      const incoming: Planet = {
        id: row.id,
        name: row.name,
        description: row.description || '',
        theme: row.theme,
        createdAt: row.created_at_ms || Date.now(),
      };

      setPlanets(current => {
        const existing = current.find(planet => planet.id === incoming.id);
        if (existing) return current.map(planet => planet.id === incoming.id ? { ...planet, ...incoming } : planet);
        return [...current, incoming];
      });
      markRemoteApplyDone();
    };

    const notesChannel = supabase
      .channel(`seed-notes-${userId}`)
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'seed_notes', filter: `user_id=eq.${userId}` } as never,
        handleNotePayload,
      )
      .subscribe();

    const planetsChannel = supabase
      .channel(`seed-planets-${userId}`)
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'seed_planets', filter: `user_id=eq.${userId}` } as never,
        handlePlanetPayload,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notesChannel);
      supabase.removeChannel(planetsChannel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user || !notesLoaded || !remoteSyncReadyRef.current || applyingRemoteSyncRef.current) return;
    if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current);

    autoSyncTimerRef.current = window.setTimeout(() => {
      pushGardenToSupabase({ planets, notes }, session.user)
        .then(() => setSyncStatus('Cambios guardados en la nube.'))
        .catch(error => setSyncStatus(error instanceof Error ? error.message : 'No se pudieron guardar los cambios en la nube.'));
    }, 900);

    return () => {
      if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current);
    };
  }, [planets, notes, notesLoaded, session?.user?.id]);

  useEffect(() => {
    if (!notesLoaded || !notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const dueNotes = notes.filter(note => !note.inbox && !note.paused && note.growthStage !== 'bloom' && wateringDue(note));
    if (dueNotes.length === 0) return;

    const todayKey = format(Date.now(), 'yyyy-MM-dd');
    if (getStoredItem('seed-last-notification-day') === todayKey) return;

    const delay = Math.max(5000, new Date().getHours() >= reminderHour ? 5000 : (reminderHour - new Date().getHours()) * 60 * 60 * 1000);
    const timeout = window.setTimeout(() => {
      setStoredItem('seed-last-notification-day', todayKey);
      showSeedNotification(
        dueNotes.length === 1
          ? `"${dueNotes[0].title}" vale un riego rápido.`
          : `${dueNotes.length} ideas valen un riego rápido. Hoy basta con una.`,
      );
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [notes, notesLoaded, notificationsEnabled, reminderHour]);

  // Check for withered seeds periodically
  useEffect(() => {
    const checkWithered = () => {
      const now = Date.now();
      let changed = false;
      const updatedNotes = notes.map(note => {
        if (!note.paused && note.dueDate && note.dueDate < now && note.growthStage !== 'bloom' && note.growthStage !== 'withered') {
          changed = true;
          return touchNote({ ...note, growthStage: 'withered' as const });
        }
        return note;
      });
      if (changed) setNotes(updatedNotes);
    };

    const interval = setInterval(checkWithered, 60000); // Check every minute
    checkWithered(); // Initial check
    return () => clearInterval(interval);
  }, [notes]);

	  const addNote = () => {
	    const isSprout = createMode === 'sprout';
	    const isJournal = createMode === 'journal';
	    const title = newNote.title.trim();
	    const activeProjectTodos = isSprout && showProjectTodos
	      ? projectTodos
	          .map(todo => ({ ...todo, text: todo.text.trim() }))
	          .filter(todo => todo.text)
	      : [];
	    const content = activeProjectTodos.length > 0
	      ? activeProjectTodos.map(todo => todo.text).join('\n')
	      : newNote.content.trim();
	    if (!title && !content) return;
	    const fallbackContent = content || title;
	    const contentLines = fallbackContent
	      .split('\n')
	      .map(line => line.trim())
	      .filter(Boolean);
	    const inferredTitle = contentLines[0] || fallbackContent;
	    const firstStep = title || content || (appLanguage === 'en' ? 'Take the first five-minute step' : 'Dar el primer paso de 5 minutos');
	    const parsedTasks = contentLines
	      .map(line => line
	        .replace(/^[-*•]\s+/, '')
	        .replace(/^\d+[.)]\s+/, '')
	        .replace(/^\[[ xX]\]\s+/, '')
	        .trim())
	      .filter(Boolean);
	    const sproutTasks = parsedTasks.length > 0
	      ? activeProjectTodos.length > 0
	        ? activeProjectTodos.map(todo => ({ id: crypto.randomUUID(), text: todo.text, completed: todo.completed }))
	        : parsedTasks.map(text => ({ id: crypto.randomUUID(), text, completed: false }))
	      : [{ id: crypto.randomUUID(), text: firstStep, completed: false }];
	    const now = Date.now();
	    const targetPlanetId = planets.some(planet => planet.id === newNote.planetId) ? newNote.planetId : activePlanetId;
	    const noteTitle = title || (inferredTitle.length > 42 ? `${inferredTitle.slice(0, 42)}...` : inferredTitle) || (isSprout ? 'Nuevo brote' : isJournal ? 'Nueva reflexión' : 'Nueva Semilla');
	    const noteContent = !title && contentLines.length > 1
	      ? contentLines.slice(1).join('\n')
	      : fallbackContent;
	    
	    const note: SeedNote = {
	      id: crypto.randomUUID(),
	      title: noteTitle,
	      content: noteContent,
	      createdAt: now,
	      tags: [],
	      isGrowth: isSprout,
      tasks: isSprout ? sproutTasks : [],
      growthStage: isJournal ? 'bloom' : isSprout ? 'sprout' : 'seed',
	      dueDate: newNote.dueDate ? dateInputToEndOfDay(newNote.dueDate) : undefined,
	      lastWateredAt: now,
	      wateringIntervalDays: defaultWateringInterval,
	      inbox: !isSprout && !isJournal,
	      seedType: isJournal ? 'learning' : isSprout ? 'project' : newNote.seedType,
	      priority: newNote.priority,
	      reflection: isJournal ? fallbackContent : undefined,
	      harvestedAt: isJournal ? now : undefined,
	      planetId: targetPlanetId,
	    };
    
	    const isFirstUserSeed = notes.length === 0 && !isSprout && !isJournal;
	    setNotes([touchNote(note), ...notes]);
	    setActivePlanetId(targetPlanetId);
	    setNewNote({ title: '', content: '', dueDate: '', seedType: 'idea', priority: 'normal', planetId: targetPlanetId });
	    setCreateMode('seed');
	    setQuickEntryPicker(null);
	    setShowQuickEntryDetails(false);
	    setShowProjectTodos(false);
	    setProjectTodos([]);
	    blurQuickEntryFocus();
	    setQuickEntryViewport({ height: null, offsetTop: 0, keyboardOpen: false });
	    setQuickEntryKeyboardReady(false);
	    setIsAdding(false);
	    setSelectedNoteId(null);
	    setRecentlyCreatedNoteId(note.id);
	    feel(isJournal ? 'harvest' : 'plant');
	    setCelebration(isJournal ? 'Reflexión guardada' : isSprout ? 'Brote creado' : isFirstUserSeed ? 'Tu primera semilla apareció en el jardín' : 'Semilla plantada');
	    window.setTimeout(() => setRecentlyCreatedNoteId(current => current === note.id ? null : current), 1800);
	    window.setTimeout(() => setCelebration(null), 1500);
	    setView(isJournal ? 'harvest' : isSprout ? 'projects' : isFirstUserSeed ? '3D' : 'inbox');
	  };

  const addQuickNote = () => {
    const content = quickNote.trim();
    if (!content) return;

    const note: SeedNote = {
      id: crypto.randomUUID(),
      title: content.length > 42 ? `${content.slice(0, 42)}...` : content,
      content,
      createdAt: Date.now(),
      tags: [],
      isGrowth: false,
      tasks: [],
      growthStage: 'seed',
      lastWateredAt: Date.now(),
      wateringIntervalDays: defaultWateringInterval,
      inbox: true,
      seedType: 'idea',
      priority: 'normal',
      planetId: activePlanetId,
    };

    const isFirstUserSeed = notes.length === 0;
    setNotes([touchNote(note), ...notes]);
    setQuickNote('');
    feel('plant');
    setCelebration(isFirstUserSeed ? 'Tu primera semilla apareció en el jardín' : 'Semilla plantada');
    window.setTimeout(() => setCelebration(null), 1500);
    setView(isFirstUserSeed ? '3D' : 'inbox');
  };

  const deleteNote = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!window.confirm(`Eliminar "${note?.title || 'esta semilla'}"? Esta acción no se puede deshacer.`)) return;
    setNotes(current => current.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
    if (session?.user) {
      deleteNoteFromSupabase(id, session.user).catch(error => {
        setSyncStatus(error instanceof Error ? error.message : 'No se pudo borrar la idea en la nube.');
      });
    }
  };

  const updateNote = (id: string, updates: Partial<SeedNote>) => {
    setNotes(current => current.map(n => n.id === id ? touchNote({ ...n, ...updates }) : n));
  };

  const recordWateringRitual = () => {
    const currentDay = format(Date.now(), 'yyyy-MM-dd');
    const yesterday = format(Date.now() - DAY_MS, 'yyyy-MM-dd');
    setWateringRitual(current => {
      if (current.lastDate === currentDay) return current;
      return {
        lastDate: currentDay,
        streak: current.lastDate === yesterday ? current.streak + 1 : 1,
      };
    });
  };

  const markRecentlyWatered = (id: string) => {
    setRecentlyWateredId(id);
    window.setTimeout(() => setRecentlyWateredId(current => current === id ? null : current), 5000);
  };

  const growNote = (id: string, firstStep?: string) => {
    setNotes(current => current.map(n => {
      if (n.id === id && !n.isGrowth) {
        const seedType = SEED_TYPES.find(type => type.id === (n.seedType || 'idea')) || SEED_TYPES[0];
        const taskText = firstStep?.trim() || seedType.task;
        return touchNote({ 
          ...n, 
          isGrowth: true, 
          growthStage: 'sprout',
          paused: false,
          inbox: false,
          lastWateredAt: Date.now(),
          tasks: [{ id: crypto.randomUUID(), text: taskText, completed: false }]
        });
      }
      return n;
    }));
  };

  const openSproutPrompt = (id: string) => {
    setSproutPromptNoteId(id);
    setSproutFirstStep('');
  };

  const confirmSproutPrompt = () => {
    if (!sproutPromptNoteId) return;
    const note = notes.find(n => n.id === sproutPromptNoteId);
    const firstStep = sproutFirstStep || 'Dar el primer paso de 5 minutos';
    if (note?.isGrowth) {
      addTinyStep(sproutPromptNoteId, firstStep);
    } else {
      growNote(sproutPromptNoteId, firstStep);
      feel('sprout');
      setCelebration('Semilla convertida en brote');
      window.setTimeout(() => setCelebration(null), 1500);
      setSelectedNoteId(null);
      setFilterStage('all');
      setSearch('');
      setView('projects');
    }
    setSproutPromptNoteId(null);
    setSproutFirstStep('');
  };

  const waterNote = (id: string, note = 'Riego rápido: sigue viva') => {
    setNotes(current => current.map(n => n.id === id ? touchNote(waterSeedNote(n, note)) : n));
    recordWateringRitual();
    markRecentlyWatered(id);
    feel('water');
    setCelebration('Idea regada');
    window.setTimeout(() => setCelebration(null), 1500);
    setWateringNoteId(null);
    setWateringNote('');
  };

  const skipWateringToday = (id: string) => {
    setNotes(current => current.map(n => n.id === id ? touchNote({
      ...n,
      lastWateredAt: Date.now(),
      lastWateringNote: appLanguage === 'en' ? 'Later today: still worth keeping.' : 'Más tarde: sigue valiendo la pena.',
    }) : n));
    setCelebration(appLanguage === 'en' ? 'Saved for later' : 'La dejamos para después');
    window.setTimeout(() => setCelebration(null), 1500);
  };

  const closeDayWithReflection = (reflection: string, intention: string, intentionOutcome: 'yes' | 'some' | 'no' | '' = '') => {
    if (notes.some(note => isDailyClosureForDate(note))) {
      setCelebration(appLanguage === 'en' ? 'Day already closed' : 'El día ya está cerrado');
      window.setTimeout(() => setCelebration(null), 1500);
      setView('harvest');
      return;
    }

    const cleanedReflection = reflection.trim();
    const cleanedIntention = intention.trim();
    const outcomeText = intentionOutcome === 'yes'
      ? appLanguage === 'en' ? 'Intention moved: yes' : 'Intención lograda: sí'
      : intentionOutcome === 'some'
        ? appLanguage === 'en' ? 'Intention moved: a little' : 'Intención lograda: un poco'
        : intentionOutcome === 'no'
          ? appLanguage === 'en' ? 'Intention moved: not today' : 'Intención lograda: no hoy'
          : '';
    const todayNotes = notes.filter(note => isToday(note.createdAt));
    const todayWatered = notes.filter(note => note.lastWateredAt && isToday(note.lastWateredAt));
    const todayHarvests = notes.filter(note => note.harvestedAt && isToday(note.harvestedAt));
    const todaySteps = notes.filter(note =>
      note.updatedAt &&
      isToday(note.updatedAt) &&
      note.tasks.some(task => task.completed)
    );
    const summary = appLanguage === 'en'
      ? `${todayNotes.length} planted · ${todayWatered.length} watered · ${todaySteps.length} moved · ${todayHarvests.length} harvested`
      : `${todayNotes.length} plantadas · ${todayWatered.length} riegos · ${todaySteps.length} avances · ${todayHarvests.length} cosechas`;
    const content = [
      cleanedIntention
        ? appLanguage === 'en'
          ? `Intention: ${cleanedIntention}`
          : `Intención: ${cleanedIntention}`
        : null,
      outcomeText || null,
      summary,
      cleanedReflection,
    ].filter(Boolean).join('\n\n');

    const note: SeedNote = {
      id: crypto.randomUUID(),
      title: appLanguage === 'en' ? 'Today closure' : 'Cierre del día',
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [DAILY_CLOSURE_TAG],
      isGrowth: false,
      tasks: [],
      growthStage: 'bloom',
      lastWateredAt: Date.now(),
      wateringIntervalDays: defaultWateringInterval,
      inbox: false,
      seedType: 'learning',
      priority: 'normal',
      reflection: cleanedReflection || content,
      takeaway: outcomeText || cleanedIntention || summary,
      harvestedAt: Date.now(),
      planetId: activePlanetId,
    };

    setNotes(current => {
      if (current.some(existing => isDailyClosureForDate(existing))) return current;
      return [touchNote(note), ...current];
    });
    setCelebration(appLanguage === 'en' ? 'Day closed' : 'Día cerrado');
    window.setTimeout(() => setCelebration(null), 1500);
    setView('harvest');
  };

  const harvestFromWatering = (id: string) => {
    const completedNote = notes.find(n => n.id === id);
    setNotes(current => current.map(n => n.id === id ? touchNote({
      ...n,
      inbox: false,
      paused: false,
      growthStage: 'bloom',
      harvestedAt: n.harvestedAt || Date.now(),
      lastWateredAt: Date.now(),
    }) : n));
    recordWateringRitual();
    markRecentlyWatered(id);
    setWateringNoteId(null);
    setWateringNote('');
    feel('harvest');
    if (completedNote) setFlowerReward({ id, title: completedNote.title });
  };

  const openWatering = (id: string) => {
    setWateringNoteId(id);
    setWateringNote('');
  };

  const cultivateInboxNote = (id: string) => {
    openSproutPrompt(id);
  };

  const completeQuickSeed = (id: string) => {
    const completedNote = notes.find(n => n.id === id);
    setNotes(current => current.map(n => n.id === id ? touchNote({
      ...n,
      inbox: false,
      paused: false,
      isGrowth: false,
      growthStage: 'bloom',
      harvestedAt: n.harvestedAt || Date.now(),
      lastWateredAt: Date.now(),
    }) : n));
    setSelectedNoteId(null);
    if (completedNote) {
      feel('harvest');
      setFlowerReward({ id, title: completedNote.title });
    }
  };

  const saveInboxForLater = (id: string) => {
    setNotes(current => current.map(n => n.id === id ? touchNote({ ...n, inbox: false, paused: true, lastWateredAt: Date.now() }) : n));
  };

  const addTinyStep = (id: string, text?: string) => {
    const taskText = (text || wateringNote).trim() || 'Dedicar 2 minutos a destrabar esta idea';
    const previousNote = notes.find(note => note.id === id);
    setNotes(current => current.map(n => {
      if (n.id !== id) return n;
      return touchNote({
        ...n,
        isGrowth: true,
        growthStage: n.growthStage === 'seed' ? 'sprout' : n.growthStage,
        paused: false,
        inbox: false,
        lastWateredAt: Date.now(),
        lastWateringNote: `Próximo micro-paso: ${taskText}`,
        tasks: [...n.tasks, { id: crypto.randomUUID(), text: taskText, completed: false }],
      });
    }));
    recordWateringRitual();
    markRecentlyWatered(id);
    feel(previousNote?.growthStage === 'seed' || !previousNote?.isGrowth ? 'sprout' : 'step');
    setCelebration('Brote con siguiente paso');
    window.setTimeout(() => setCelebration(null), 1500);
    openFocusMode(id);
    setWateringNoteId(null);
    setWateringNote('');
  };

  const togglePauseNote = (id: string) => {
    setNotes(current => current.map(n => n.id === id ? touchNote({ ...n, paused: !n.paused }) : n));
  };

  const logFocusMinutes = (id: string, minutes: number) => {
    setNotes(current => current.map(n => n.id === id ? touchNote(addFocusMinutes(n, minutes)) : n));
  };

  const showSeedNotification = async (body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Seeds', {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'seed-daily-review',
      });
      return;
    }
    new Notification('Seeds', { body, icon: '/icon-192.png', tag: 'seed-daily-review' });
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    const enabled = permission === 'granted';
    setNotificationsEnabled(enabled);
    if (enabled) {
      await showSeedNotification('Listo. Te avisaré cuando alguna idea valga un riego rápido.');
    }
  };

  const addTask = (noteId: string) => {
    setNotes(current => current.map(n => {
      if (n.id === noteId) {
        return touchNote({ 
          ...n, 
          tasks: [...n.tasks, { id: crypto.randomUUID(), text: '', completed: false }] 
        });
      }
      return n;
    }));
  };

  const updateTask = (noteId: string, taskId: string, text: string) => {
    setNotes(current => current.map(n => {
      if (n.id === noteId) {
        return touchNote({
          ...n,
          tasks: n.tasks.map(t => t.id === taskId ? { ...t, text } : t)
        });
      }
      return n;
    }));
  };

  const deleteTask = (noteId: string, taskId: string) => {
    setNotes(current => current.map(n => {
      if (n.id !== noteId) return n;

      const tasks = n.tasks.filter(task => task.id !== taskId);
      const hasOpenTasks = tasks.some(task => !task.completed);
      const shouldReopenHarvest = n.growthStage === 'bloom' && hasOpenTasks;
      const growthStage = shouldReopenHarvest
        ? 'sprout'
        : n.growthStage === 'bloom' || n.growthStage === 'withered'
          ? n.growthStage
          : n.isGrowth
            ? 'sprout'
            : 'seed';

      return touchNote({
        ...n,
        tasks,
        growthStage,
        harvestedAt: growthStage === 'bloom' ? n.harvestedAt : undefined,
      });
    }));
  };

  const toggleTask = (noteId: string, taskId: string) => {
    const noteBeforeToggle = notes.find(note => note.id === noteId);
    const taskBeforeToggle = noteBeforeToggle?.tasks.find(task => task.id === taskId);
    const toggledPreview = noteBeforeToggle ? toggleTaskForNote(noteBeforeToggle, taskId) : null;
    const completedStep = Boolean(taskBeforeToggle && !taskBeforeToggle.completed);
    const harvestedNoteId = noteBeforeToggle?.growthStage !== 'bloom' && toggledPreview?.growthStage === 'bloom'
      ? toggledPreview.id
      : null;
    setNotes(current => current.map(n => {
      if (n.id === noteId) {
        return touchNote(toggleTaskForNote(n, taskId));
      }
      return n;
    }));
    if (harvestedNoteId) {
      feel('harvest');
      window.setTimeout(() => setHarvestNoteId(harvestedNoteId), 500);
      return;
    }
    if (completedStep) {
      feel('step');
      setCelebration('Paso completado');
      window.setTimeout(() => setCelebration(null), 1500);
    }
  };

  const toggleConnection = (fromId: string, toId: string) => {
    setNotes(current => current.map(n => {
      if (n.id === fromId) {
        const connections = n.connections || [];
        const exists = connections.includes(toId);
        return touchNote({
          ...n,
          connections: exists ? connections.filter(id => id !== toId) : [...connections, toId]
        });
      }
      return n;
    }));
  };

  const activePlanet = useMemo(() => {
    return planets.find(planet => planet.id === activePlanetId) || planets[0] || DEFAULT_PLANETS[0];
  }, [activePlanetId, planets]);

  const planetNotes = useMemo(() => {
    return notes.filter(note => (note.planetId || DEFAULT_PLANET_ID) === activePlanet.id);
  }, [activePlanet.id, notes]);

  const filteredNotes = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    return planetNotes.filter(n => {
      if (n.inbox) return false;
      const matchesSpecialSearch =
        normalizedSearch === 'pausadas' ? Boolean(n.paused) :
        normalizedSearch === 'riego' ? !n.paused && n.growthStage !== 'bloom' && wateringDue(n) :
        normalizedSearch === 'activas' ? !n.paused && n.growthStage !== 'bloom' :
        false;
      const matchesSearch = !normalizedSearch ||
                            matchesSpecialSearch ||
                            n.title.toLowerCase().includes(normalizedSearch) ||
                            n.content.toLowerCase().includes(normalizedSearch) ||
                            (n.seedType || '').includes(normalizedSearch);
      const matchesStage = filterStage === 'all' || n.growthStage === filterStage;
      return matchesSearch && matchesStage;
    });
  }, [planetNotes, search, filterStage]);

  const projectNotes = useMemo(() => {
    return planetNotes
      .filter(note => !note.inbox && note.isGrowth && note.growthStage !== 'bloom')
      .sort((a, b) => noteUpdatedAt(b) - noteUpdatedAt(a));
  }, [planetNotes]);

  const visibleGardenNotes = view === 'projects' ? projectNotes : filteredNotes;

  const selectedNote = useMemo(() => 
    planetNotes.find(n => n.id === selectedNoteId), 
  [planetNotes, selectedNoteId]);
  const selectedIsDone = selectedNote?.growthStage === 'bloom';
  const selectedIsQuickSeed = Boolean(selectedNote && !selectedNote.isGrowth && !selectedIsDone);
  const selectedIsProject = Boolean(selectedNote?.isGrowth && !selectedIsDone);

  const growingNotes = useMemo(() => planetNotes.filter(n => n.isGrowth && !n.inbox && !n.paused && n.growthStage !== 'bloom'), [planetNotes]);

  const gardenStats = useMemo(() => {
    return planetNotes.reduce((stats, note) => {
      if (note.inbox) {
        stats.seeds += 1;
        return stats;
      }
      stats.total += 1;
      if (note.growthStage === 'bloom') {
        stats.completed += 1;
        if (note.isGrowth) stats.trees += 1;
        else stats.flowers += 1;
      }
      if (note.isGrowth && !note.paused && note.growthStage !== 'bloom') stats.active += 1;
      if (note.growthStage === 'seed') stats.plantedSeeds += 1;
      if (note.growthStage === 'sprout') stats.visualSprouts += 1;
      if (!note.paused && note.growthStage !== 'bloom' && wateringDue(note)) stats.watering += 1;
      return stats;
    }, { total: 0, completed: 0, active: 0, seeds: 0, plantedSeeds: 0, visualSprouts: 0, watering: 0, flowers: 0, trees: 0 });
  }, [planetNotes]);

  const planetNoteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      const id = note.planetId || DEFAULT_PLANET_ID;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }, [notes]);

  const getProgress = useCallback((note: SeedNote) => {
    if (!note.tasks.length) return 0;
    const completed = note.tasks.filter(t => t.completed).length;
    return Math.round((completed / note.tasks.length) * 100);
  }, []);
	  const selectedProgress = selectedNote ? getProgress(selectedNote) : 0;
	  const selectedCompletedSteps = selectedNote?.tasks.filter(task => task.completed).length || 0;
	  const selectedReviewDays = selectedNote ? daysSince(selectedNote.lastWateredAt || selectedNote.createdAt) : 0;
	  const selectedGuidance = selectedNote ? getIdeaGuidance(selectedNote) : null;
	  const selectedSeedType = selectedNote ? (SEED_TYPES.find(type => type.id === (selectedNote.seedType || 'idea')) || SEED_TYPES[0]) : SEED_TYPES[0];
	  const selectedPriority = selectedNote ? (PRIORITY_OPTIONS.find(option => option.id === (selectedNote.priority || 'normal')) || PRIORITY_OPTIONS[1]) : PRIORITY_OPTIONS[1];
	  const selectedNextTask = selectedNote?.tasks.find(task => !task.completed);

  const exportGarden = () => {
    const markdown = planetNotes.map(note => {
      const status = note.inbox ? 'Semillero' : note.paused ? 'Pausada' : STAGE_META[note.growthStage].label;
      const tasks = note.tasks.length ? `\n\n${note.tasks.map(task => `- [${task.completed ? 'x' : ' '}] ${task.text}`).join('\n')}` : '';
      const reflection = note.reflection ? `\n\nReflexión: ${note.reflection}` : '';
      const takeaway = note.takeaway ? `\n\nMe dejó: ${note.takeaway}` : '';
      return `# ${note.title}\n\nEstado: ${status}\nTipo: ${note.seedType || 'idea'}\n\n${note.content}${tasks}${reflection}${takeaway}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seed-${activePlanet.name.toLowerCase().replace(/\s+/g, '-')}-${format(Date.now(), 'yyyy-MM-dd')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: Date.now(), activePlanetId, planets, notes }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seed-backup-${format(Date.now(), 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      window.alert('No se pudo leer este backup. Revisa que sea un archivo JSON valido.');
      return;
    }
    const parsedRecord = parsed && typeof parsed === 'object' ? parsed as { notes?: unknown; planets?: unknown; activePlanetId?: unknown } : null;
    const rawNotes = Array.isArray(parsed) ? parsed : parsedRecord?.notes;
    if (!Array.isArray(rawNotes)) {
      window.alert('El archivo no parece ser un backup de Seeds.');
      return;
    }
    const importedNotes = normalizeNotes(rawNotes);
    if (rawNotes.length > 0 && importedNotes.length === 0) {
      window.alert('No se encontraron ideas validas en este backup.');
      return;
    }
    if (!window.confirm(`Importar ${importedNotes.length} ideas? Esto reemplazará tu jardín actual.`)) return;
    const importedPlanets = normalizePlanets(parsedRecord?.planets);
    const nextPlanets = importedPlanets.length > 0 ? importedPlanets : planets;
    const nextActivePlanetId = typeof parsedRecord?.activePlanetId === 'string' && nextPlanets.some(planet => planet.id === parsedRecord.activePlanetId)
      ? parsedRecord.activePlanetId
      : nextPlanets[0]?.id || activePlanetId;
    const importedPlanetIds = new Set(nextPlanets.map(planet => planet.id));

    setPlanets(nextPlanets);
    setActivePlanetId(nextActivePlanetId);
    setNotes(importedNotes.map(note => importedPlanetIds.has(note.planetId || DEFAULT_PLANET_ID) ? note : { ...note, planetId: nextActivePlanetId }));
    setSelectedNoteId(null);
    setShowSettings(false);
  };

  const clearGardenData = () => {
    if (!window.confirm('Borrar todo tu jardín? Esta acción no se puede deshacer.')) return;
    if (!window.confirm('Confirmación final: se eliminarán todas las ideas, cosechas y rachas locales.')) return;
    setNotes([]);
    setSelectedNoteId(null);
    setWateringRitual({ lastDate: '', streak: 0 });
    removeStoredItem('seed-last-notification-day');
    setShowSettings(false);
  };

  const finishOnboarding = () => {
    setStoredItem('seed-onboarded', 'true');
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

	  const startPlanting = () => {
	    setShowCreateMenu(false);
	    setCreateMode('seed');
	    setQuickEntryPicker(null);
	    setShowQuickEntryDetails(false);
	    unlockSeedAudio();
	    feel('open');
	    playMicroSound('pop', true);
	    setSelectedNoteId(null);
	    setFilterStage('all');
	    setSearch('');
	    setNewNote({ title: '', content: '', dueDate: '', seedType: 'idea', priority: 'normal', planetId: activePlanetId });
	    setQuickEntryViewport({ height: null, offsetTop: 0, keyboardOpen: false });
	    setQuickEntryKeyboardReady(false);
	    setIsAdding(true);
	  };

	  useEffect(() => {
	    const openSharedSeed = (sharedText = '') => {
	      removeStoredItem('seed-pending-action');
	      startPlanting();
	      if (sharedText.trim()) {
	        window.requestAnimationFrame(() => {
	          setNewNote(current => ({ ...current, content: sharedText.trim() }));
	        });
	      }
	    };
	    const openToday = () => {
	      removeStoredItem('seed-pending-action');
	      setSelectedNoteId(null);
	      setView('today');
	    };
	    const handleSeedUrl = (rawUrl = '') => {
	      const normalizedUrl = rawUrl.toLowerCase();
	      if (normalizedUrl.includes('today')) {
	        openToday();
	        return;
	      }
	      openSharedSeed();
	    };

	    const pendingAction = getStoredItem('seed-pending-action');
	    if (pendingAction === 'new-seed') {
	      window.requestAnimationFrame(() => openSharedSeed());
	    } else if (pendingAction === 'today') {
	      window.requestAnimationFrame(openToday);
	    }

	    const params = new URLSearchParams(window.location.search);
	    const sharedTitle = params.get('title') || '';
	    const sharedText = params.get('text') || '';
	    const sharedUrl = params.get('url') || '';
	    const sharedPayload = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join('\n');
	    if (sharedPayload.trim()) {
	      window.requestAnimationFrame(() => {
	        openSharedSeed(sharedPayload);
	        window.history.replaceState(null, '', window.location.pathname);
	      });
	    }

	    const handleNativeUrl = (event: Event) => {
	      const detail = (event as CustomEvent<{ url?: string }>).detail;
	      handleSeedUrl(detail?.url || '');
	    };

	    window.addEventListener('seed:native-url', handleNativeUrl);
	    return () => window.removeEventListener('seed:native-url', handleNativeUrl);
	  }, []);

	  const showWateringQueue = () => {
    setSelectedNoteId(null);
    setFilterStage('all');
    setSearch('riego');
    setView('garden');
  };

  const switchPlanet = (id: string) => {
    setActivePlanetId(id);
    setSelectedNoteId(null);
    setFocusNoteId(null);
    setSearch('');
    setFilterStage('all');
    setView('today');
    setShowGardenSwitcher(false);
  };

  const addPlanet = () => {
    const name = newPlanetName.trim();
    if (!name) return;
    const planet: Planet = touchPlanet({
      id: crypto.randomUUID(),
      name,
      description: 'Nuevo jardín para cultivar ideas.',
      theme,
      createdAt: Date.now(),
    });
    setPlanets([...planets, planet]);
    setNewPlanetName('');
    setIsAddingPlanet(false);
    switchPlanet(planet.id);
  };

  const openPlanetSettings = () => {
    setEditingPlanetName(activePlanet.name);
    setShowPlanetSettings(!showPlanetSettings);
    setIsAddingPlanet(false);
  };

  const renameActivePlanet = () => {
    const name = editingPlanetName.trim();
    if (!name) return;
    setPlanets(current => current.map(planet => planet.id === activePlanet.id ? touchPlanet({ ...planet, name }) : planet));
    setShowPlanetSettings(false);
  };

  const deleteActivePlanet = () => {
    if (planets.length <= 1) {
      window.alert('Necesitas al menos un jardín para guardar tus ideas.');
      return;
    }

    const ideasInPlanet = notes.filter(note => (note.planetId || DEFAULT_PLANET_ID) === activePlanet.id).length;
    if (!window.confirm(`Borrar el jardín "${activePlanet.name}"? Se eliminarán ${ideasInPlanet} ideas de este espacio. Esta acción no se puede deshacer.`)) return;
    if (!window.confirm('Confirmación final: borrar este jardín y sus ideas permanentemente?')) return;

    const nextPlanet = planets.find(planet => planet.id !== activePlanet.id) || DEFAULT_PLANETS[0];
    setNotes(current => current.filter(note => (note.planetId || DEFAULT_PLANET_ID) !== activePlanet.id));
    setPlanets(current => current.filter(planet => planet.id !== activePlanet.id));
    if (session?.user) {
      deletePlanetFromSupabase(activePlanet.id, session.user).catch(error => {
        setSyncStatus(error instanceof Error ? error.message : 'No se pudo borrar el jardín en la nube.');
      });
    }
    setShowPlanetSettings(false);
    switchPlanet(nextPlanet.id);
  };

  const signUpWithEmail = async () => {
    if (!supabase) {
      setAuthStatus('Supabase no está configurado.');
      return;
    }
    const passwordIssue = passwordPolicyError(authPassword);
    if (passwordIssue) {
      setAuthStatus(passwordIssue);
      return;
    }
    if (!authConfirmPassword) {
      setAuthStatus('Confirma tu contraseña para crear tu jardín.');
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthStatus('Las contraseñas no coinciden.');
      return;
    }

    setAuthStatus('Creando cuenta...');
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          name: account.name,
          role: account.role,
        },
      },
    });
    setAuthStatus(error
      ? formatAuthError(error.message)
      : data.session
        ? 'Cuenta creada. Tu sesión ya está activa.'
        : 'Cuenta creada. Te enviamos un correo para confirmar tu registro.');
  };

  const signInWithEmail = async () => {
    if (!supabase) {
      setAuthStatus('Supabase no está configurado.');
      return;
    }

    setAuthStatus('Iniciando sesión...');
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    if (error) {
      setAuthStatus(formatAuthError(error.message));
      return;
    }
    setAuthStatus('Sesión iniciada.');
    enterApp();
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setAuthPassword('');
    setAuthStatus('Sesión cerrada.');
  };

  const syncGarden = async () => {
    if (!session?.user) {
      setSyncStatus('Inicia sesión para sincronizar.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Sincronizando jardín...');
    try {
      const synced = await syncGardenWithSupabase({ planets, notes }, session.user);
      if (synced.planets.length > 0) setPlanets(synced.planets);
      setNotes(synced.notes);
      setSyncStatus(`Sincronizado: ${synced.planets.length} jardines y ${synced.notes.length} ideas.`);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'No se pudo sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const enterApp = () => {
    setStoredItem('seed-landing-seen', 'true');
    setStoredItem('seed-welcome-v2-seen', 'true');
    setShowLanding(false);
    setLandingRoute('landing');
  };

  const openFocusMode = (id: string) => {
    setSelectedNoteId(null);
    setShowGardenFullscreen(false);
    setFocusNoteId(id);
    setView('focus');
  };

	  const runCardAction = (note: SeedNote, action: ReturnType<typeof getIdeaGuidance>['kind']) => {
    if (action === 'grow') {
      growNote(note.id);
      return;
    }

    if (action === 'water') {
      openWatering(note.id);
      return;
    }

    if (action === 'focus') {
      openFocusMode(note.id);
      return;
    }

    if (action === 'pause') {
      togglePauseNote(note.id);
      return;
    }

	    setSelectedNoteId(note.id);
	  };

  const openCalendarToday = () => {
    setSelectedNoteId(null);
    setCurrentMonth(new Date());
    setView('calendar');
  };

  const navigateToView = (nextView: AppView) => {
    if (nextView === 'calendar') {
      openCalendarToday();
      return;
    }
    setView(nextView);
	  };

	  const quickEntryKeyboardMode = quickEntryKeyboardReady && quickEntryViewport.keyboardOpen;
	  const quickEntryViewportStyle = quickEntryKeyboardMode && quickEntryViewport.height
	    ? {
	        top: `${Math.round(quickEntryViewport.offsetTop)}px`,
	        bottom: 'auto',
	        height: `${Math.round(quickEntryViewport.height)}px`,
	      }
	    : undefined;
  const startCreateMenuPress = () => {
    if (showCreateMenu) return;
    unlockSeedAudio();
    createMenuLongPressRef.current = false;
    if (createMenuTimerRef.current) window.clearTimeout(createMenuTimerRef.current);
    createMenuTimerRef.current = window.setTimeout(() => {
      createMenuLongPressRef.current = true;
      playMicroSound('holdPop', true);
      setShowCreateMenu(true);
    }, 420);
  };
  const clearCreateMenuPress = () => {
    if (createMenuTimerRef.current) {
      window.clearTimeout(createMenuTimerRef.current);
      createMenuTimerRef.current = null;
    }
  };
  const createDraftTodo = (text = '', completed = false): DraftTodo => ({
    id: crypto.randomUUID(),
    text,
    completed,
  });
  const focusProjectTodoInput = (id: string) => {
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-project-todo-id="${id}"]`);
      const row = input?.closest<HTMLElement>('[data-project-todo-row]');
      const list = input?.closest<HTMLElement>('[data-project-todo-list]');
      input?.focus({ preventScroll: true });
      if (row && list) {
        const targetTop = row.offsetTop - list.clientHeight + row.offsetHeight + 12;
        list.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
    });
  };
  const setProjectTodosAndContent = (nextTodos: DraftTodo[]) => {
    setProjectTodos(nextTodos);
    setNewNote(current => ({
      ...current,
      content: nextTodos.map(todo => todo.text).join('\n'),
    }));
  };
  const buildProjectTodosFromContent = () => {
    const lines = newNote.content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines.map(line => createDraftTodo(line)) : [createDraftTodo()];
  };
  const updateProjectTodo = (id: string, text: string) => {
    setProjectTodosAndContent(projectTodos.map(todo => todo.id === id ? { ...todo, text } : todo));
  };
  const toggleProjectTodo = (id: string) => {
    setProjectTodos(projectTodos.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  };
  const addProjectTodoAfter = (id?: string) => {
    const nextTodo = createDraftTodo();
    if (!id) {
      setProjectTodosAndContent([...projectTodos, nextTodo]);
      focusProjectTodoInput(nextTodo.id);
      return;
    }
    const index = projectTodos.findIndex(todo => todo.id === id);
    const nextTodos = [...projectTodos];
    nextTodos.splice(index >= 0 ? index + 1 : nextTodos.length, 0, nextTodo);
    setProjectTodosAndContent(nextTodos);
    focusProjectTodoInput(nextTodo.id);
  };
  const removeProjectTodo = (id: string) => {
    const nextTodos = projectTodos.filter(todo => todo.id !== id);
    setProjectTodosAndContent(nextTodos.length > 0 ? nextTodos : [createDraftTodo()]);
  };
  const handleProjectTodoDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = projectTodos.findIndex(todo => todo.id === active.id);
    const newIndex = projectTodos.findIndex(todo => todo.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setProjectTodosAndContent(arrayMove(projectTodos, oldIndex, newIndex));
  };
  const openCreateOption = (option: 'seed' | 'sprout' | 'journal' | 'garden') => {
    setShowCreateMenu(false);
    if (option === 'garden') {
      setShowMobileMenu(true);
      setShowGardenSwitcher(true);
      setShowPlanetSettings(false);
      setIsAddingPlanet(true);
      return;
    }

    setSelectedNoteId(null);
    setFilterStage('all');
    setSearch('');
    setCreateMode(option);
    setQuickEntryPicker(null);
    setShowQuickEntryDetails(false);
    setShowProjectTodos(option === 'sprout');
    setProjectTodos(option === 'sprout' ? [createDraftTodo()] : []);
    setNewNote({
      title: '',
      content: '',
      dueDate: '',
      seedType: option === 'sprout' ? 'project' : option === 'journal' ? 'learning' : 'idea',
      priority: 'normal',
      planetId: activePlanetId,
    });
    setQuickEntryViewport({ height: null, offsetTop: 0, keyboardOpen: false });
    setQuickEntryKeyboardReady(false);
    setIsAdding(true);
  };
  const quickActionsNote = quickActionsNoteId ? notes.find(note => note.id === quickActionsNoteId) : null;
  const runQuickAction = (action: 'water' | 'sprout' | 'focus' | 'pause' | 'harvest' | 'delete' | 'later') => {
    if (!quickActionsNote) return;
    const noteId = quickActionsNote.id;
    setQuickActionsNoteId(null);

    if (action === 'water') {
      openWatering(noteId);
      return;
    }
    if (action === 'sprout') {
      openSproutPrompt(noteId);
      return;
    }
    if (action === 'focus') {
      openFocusMode(noteId);
      return;
    }
    if (action === 'pause') {
      togglePauseNote(noteId);
      return;
    }
    if (action === 'harvest') {
      completeQuickSeed(noteId);
      return;
    }
    if (action === 'later') {
      saveInboxForLater(noteId);
      return;
    }
    deleteNote(noteId);
  };

  const toggleTodayWidget = (widgetId: TodayWidgetId, enabled: boolean) => {
    setTodayWidgets(current => {
      if (enabled) {
        return current.includes(widgetId) ? current : [...current, widgetId];
      }
      return current.filter(id => id !== widgetId);
    });
  };

  const closeSettings = () => {
    setShowSettings(false);
    window.setTimeout(() => setSettingsPage('root'), 180);
  };

  const settingsTitles: Record<SettingsPage, string> = {
    root: t('settings'),
    profile: t('profile'),
    appearance: 'Apariencia',
    today: 'Hoy',
    watering: 'Riego',
    data: 'Cuenta y datos',
  };

  const settingsRows: Array<{
    page: Exclude<SettingsPage, 'root'>;
    icon: LucideIcon;
    title: string;
    detail: string;
    value?: string;
  }> = [
    {
      page: 'profile',
      icon: User,
      title: t('profile'),
      detail: account.name || 'Nombre, rol e intención',
      value: account.role || undefined,
    },
    {
      page: 'appearance',
      icon: Sparkles,
      title: 'Apariencia y sensación',
      detail: 'Tema, haptics y sonidos',
      value: THEMES.find(item => item.id === (activePlanet.theme || theme))?.label,
    },
    {
      page: 'today',
      icon: LayoutGrid,
      title: 'Hoy',
      detail: 'Módulos visibles en la pantalla principal',
      value: `${todayWidgets.length} activos`,
    },
    {
      page: 'watering',
      icon: Droplets,
      title: 'Riego y recordatorios',
      detail: `Cada ${defaultWateringInterval} días · ${String(reminderHour).padStart(2, '0')}:00`,
      value: notificationsEnabled ? 'Activo' : 'Suave',
    },
    {
      page: 'data',
      icon: Cloud,
      title: 'Cuenta y datos',
      detail: session?.user ? session.user.email || 'Cuenta conectada' : 'Sync, backups y datos locales',
      value: session?.user ? 'Sync' : 'Local',
    },
  ];

  const renderSettingsNavRow = (item: typeof settingsRows[number]) => (
    <button
      key={item.page}
      type="button"
      onClick={() => setSettingsPage(item.page)}
      className="flex min-h-[4.35rem] w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left transition-colors last:border-b-0 active:bg-[var(--surface-hover)] sm:hover:bg-[var(--surface-hover)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
        <item.icon size={17} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs font-medium text-[var(--text-muted)]">{item.detail}</span>
      </span>
      {item.value && <span className="max-w-[7rem] truncate text-xs font-semibold text-[var(--text-muted)]">{item.value}</span>}
      <ChevronRight size={17} className="shrink-0 text-[var(--text-muted)]/65" />
    </button>
  );

  const renderSettingsSection = (title: string, children: ReactNode) => (
    <section className="space-y-2">
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{title}</p>
      <div className="overflow-hidden rounded-[1.45rem] bg-[var(--surface-strong)] shadow-sm ring-1 ring-[var(--border)]">
        {children}
      </div>
    </section>
  );

  const quickEntryCopy = createMode === 'sprout'
    ? {
        title: appLanguage === 'en' ? 'New project' : 'Nuevo proyecto',
        subtitle: appLanguage === 'en' ? 'Name it. Add only the next steps.' : 'Nómbralo. Agrega solo los siguientes pasos.',
        placeholder: appLanguage === 'en' ? 'Add a first step...' : 'Agrega un primer paso...',
        action: appLanguage === 'en' ? 'Create' : 'Crear',
        compactLabel: appLanguage === 'en' ? 'Project · Checklist' : 'Proyecto · Checklist',
        details: appLanguage === 'en' ? 'Options' : 'Opciones',
        titlePlaceholder: appLanguage === 'en' ? 'Project name' : 'Nombre del proyecto',
      }
    : createMode === 'journal'
      ? {
          title: appLanguage === 'en' ? 'Reflection' : 'Reflexión',
          subtitle: appLanguage === 'en' ? 'Keep what you learned.' : 'Guarda lo que aprendiste.',
          placeholder: appLanguage === 'en' ? 'Write the thought you want to keep...' : 'Escribe la idea que quieres conservar...',
          action: appLanguage === 'en' ? 'Save' : 'Guardar',
          compactLabel: appLanguage === 'en' ? 'Reflection · Learning' : 'Reflexión · Aprendizaje',
          details: appLanguage === 'en' ? 'Options' : 'Opciones',
          titlePlaceholder: appLanguage === 'en' ? 'Reflection title' : 'Título de la reflexión',
        }
      : {
          title: appLanguage === 'en' ? 'New seed' : 'Nueva semilla',
          subtitle: appLanguage === 'en' ? 'Capture now. Decide later.' : 'Captura ahora. Decide después.',
          placeholder: appLanguage === 'en' ? 'Write the idea as it arrives...' : 'Escribe la idea tal como llega...',
          action: t('plant'),
          compactLabel: `${appLanguage === 'en' ? 'Seedbed' : 'Semillero'} · ${SEED_TYPES.find(type => type.id === newNote.seedType)?.label || 'Idea'}`,
          details: appLanguage === 'en' ? 'Options' : 'Opciones',
          titlePlaceholder: appLanguage === 'en' ? 'New seed' : 'Nueva semilla',
        };
  const quickEntryTypeLabel = SEED_TYPES.find(type => type.id === newNote.seedType)?.label || 'Idea';
  const quickEntryPriority = PRIORITY_OPTIONS.find(option => option.id === newNote.priority) || PRIORITY_OPTIONS[1];
  const quickEntryPlanet = planets.find(planet => planet.id === newNote.planetId) || activePlanet;
  const quickEntryToday = format(new Date(), 'yyyy-MM-dd');
  const closeQuickEntry = () => {
    blurQuickEntryFocus();
    setQuickEntryPicker(null);
    setShowQuickEntryDetails(false);
    setShowProjectTodos(false);
    setProjectTodos([]);
    setQuickEntryViewport({ height: null, offsetTop: 0, keyboardOpen: false });
    setQuickEntryKeyboardReady(false);
    setIsAdding(false);
  };

  if (showLanding) {
    if (landingRoute !== 'landing') {
      return (
        <AuthEntryPage
          mode={landingRoute}
          onBack={() => setLandingRoute('landing')}
          onSwitchMode={() => setLandingRoute(landingRoute === 'login' ? 'register' : 'login')}
          onEnter={enterApp}
          accountName={account.name}
          setAccountName={(name) => setAccount(current => ({ ...current, name }))}
          authEmail={authEmail}
          setAuthEmail={(email) => {
            setAuthEmail(email);
            setAccount(current => ({ ...current, email }));
          }}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authConfirmPassword={authConfirmPassword}
          setAuthConfirmPassword={setAuthConfirmPassword}
          authDisabledReason={authDisabledReason}
          authStatus={authStatus}
          onSignIn={signInWithEmail}
          onSignUp={signUpWithEmail}
        />
      );
    }

    return (
      <LandingPage
        onEnter={enterApp}
        onShowLogin={() => setLandingRoute('login')}
        onShowRegister={() => setLandingRoute('register')}
      />
    );
  }

  return (
    <div className="safe-app-shell flex h-screen flex-col overflow-hidden bg-transparent font-sans text-[var(--text-main)] md:flex-row">
      <div className={`fixed left-4 right-4 top-[var(--safe-top-control)] z-40 h-12 items-center justify-between rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-strong)]/88 px-2 shadow-xl shadow-black/10 backdrop-blur-2xl md:hidden ${view === 'focus' || showGardenFullscreen || isAdding ? 'hidden' : 'flex'}`}>
        <button
          type="button"
          onClick={() => setShowMobileMenu(true)}
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--sage)] transition-colors active:bg-[var(--bg-app)]"
          aria-label="Abrir menú"
        >
          <Menu size={19} />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedNoteId(null);
            setShowCreateMenu(false);
            setView('today');
          }}
          className="min-w-0 flex-1 px-2 text-center"
          aria-label="Ir a Hoy"
        >
          <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">{activePlanet.name}</span>
          <span className="block truncate text-[11px] font-medium text-[var(--text-muted)]">{planetNotes.length} ideas</span>
        </button>
	        <button
	          type="button"
	          onClick={() => setShowSettings(true)}
	          className="grid h-9 w-9 place-items-center rounded-full text-[var(--sage)] transition-colors active:bg-[var(--bg-app)]"
	          aria-label={t('settings')}
	        >
	          <Settings size={18} strokeWidth={2.3} />
	        </button>
      </div>
      <AnimatePresence>
        {showMobileMenu && (
          <motion.button
            type="button"
            aria-label="Cerrar menú"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMobileMenu(false)}
	            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-md md:hidden"
          />
        )}
      </AnimatePresence>
      {/* Sidebar Navigation */}
      <aside ref={mobileMenuRef} className={`fixed left-3 right-3 top-[calc(var(--safe-top-control)+3.25rem)] z-50 flex max-h-[calc(100vh-var(--safe-top-control)-env(safe-area-inset-bottom)-8.25rem)] shrink-0 origin-top flex-col overflow-y-auto rounded-[2rem] border border-white/60 bg-[var(--sidebar-bg)]/94 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-all duration-300 app-scrollbar md:static md:z-20 md:h-screen md:max-h-none md:w-72 md:max-w-none md:origin-center md:translate-y-0 md:scale-100 md:rounded-none md:border-r md:border-[var(--border)] md:bg-[var(--sidebar-bg)] md:p-6 md:opacity-100 md:shadow-none ${showMobileMenu ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-3 scale-[0.97] opacity-0 md:pointer-events-auto'}`}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)] md:hidden" />
        <motion.div 
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 group cursor-pointer"
        >
          <div className="relative">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-strong)] text-[var(--sage)] ring-1 ring-[var(--border)]">
              <Leaf size={22} />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--earth)] leading-none">Seeds</h1>
            <p className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">Ideas y proyectos</p>
          </div>
          <button
            type="button"
            onClick={() => setShowMobileMenu(false)}
            className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-strong)] text-[var(--text-muted)] md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </motion.div>

        <div className="mb-8 space-y-3">
          <p className="px-4 text-[10px] uppercase font-black tracking-[0.25em] text-[var(--seed-accent)] opacity-50">Jardines</p>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGardenSwitcher(value => !value)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-left shadow-sm soft-interaction hover:border-[var(--sage)]/25"
              aria-expanded={showGardenSwitcher}
              aria-label="Cambiar jardín"
            >
	              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1.2rem] bg-[var(--bg-app)] font-serif text-lg font-black text-[var(--sage)] ring-1 ring-[var(--border)]">
	                {activePlanet.name.slice(0, 1).toUpperCase()}
	              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold tracking-tight text-[var(--earth)]">{activePlanet.name}</span>
                <span className="mt-0.5 block text-[11px] font-medium text-[var(--text-muted)]">
                  {planetNoteCounts.get(activePlanet.id) || 0} ideas
                </span>
              </span>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)] transition-transform ${showGardenSwitcher ? 'rotate-180' : ''}`}>
                <ChevronDown size={17} />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {showGardenSwitcher && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-2 shadow-lg shadow-black/[0.06] backdrop-blur-xl"
                >
                  <div className="max-h-52 space-y-1 overflow-y-auto pr-1 app-scrollbar">
                    {planets.map((planet) => {
                      const count = planetNoteCounts.get(planet.id) || 0;
                      const isActive = activePlanet.id === planet.id;

                      return (
                        <button
                          key={planet.id}
                          onClick={() => {
                            switchPlanet(planet.id);
                            setShowMobileMenu(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                            isActive
                              ? 'bg-[var(--bg-app)] text-[var(--sage)]'
                              : 'text-[var(--earth)] hover:bg-[var(--surface-soft)]'
                          }`}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] font-serif text-sm font-black">
                            {planet.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black">{planet.name}</span>
                            <span className="block text-[10px] font-bold text-[var(--text-muted)]">{count} ideas</span>
                          </span>
                          {isActive && <CheckCircle2 size={16} />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingPlanet(value => !value);
                        setShowPlanetSettings(false);
                      }}
                      className={`flex h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left text-xs font-black transition-all ${
                        isAddingPlanet
                          ? 'bg-[var(--sage)] text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20'
                          : 'bg-[var(--sage)]/10 text-[var(--sage)] hover:bg-[var(--sage)]/15'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl ${isAddingPlanet ? 'bg-white/20' : 'bg-[var(--surface-strong)]'}`}>
                          <Plus size={15} />
                        </span>
                        <span>Crear jardín</span>
                      </span>
                      <ChevronRight size={15} className={isAddingPlanet ? 'rotate-90 transition-transform' : 'transition-transform'} />
                    </button>
                    <button
                      type="button"
                      onClick={openPlanetSettings}
                      className={`flex h-10 w-full items-center justify-between gap-3 rounded-2xl border px-3 text-left text-xs font-black transition-all ${
                        showPlanetSettings
                          ? 'border-[var(--sage)]/30 bg-[var(--surface-soft)] text-[var(--sage)] shadow-sm'
                          : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)] hover:text-[var(--sage)]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)]">
                          <Settings size={14} />
                        </span>
                        <span>Administrar jardín actual</span>
                      </span>
                      <ChevronRight size={14} className={showPlanetSettings ? 'rotate-90 transition-transform' : 'transition-transform'} />
                    </button>
                  </div>

                  {isAddingPlanet && (
                    <div className="mt-2 rounded-[1.35rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--bg-app),var(--surface-soft))] p-3 shadow-inner shadow-white/40">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[var(--surface-strong)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                          <Plus size={15} />
                        </span>
                        <div>
                          <p className="text-xs font-black text-[var(--earth)]">Nuevo jardín</p>
                          <p className="text-[10px] font-semibold text-[var(--text-muted)]">Crea un espacio para un tema.</p>
                        </div>
                      </div>
                      <label className="flex h-12 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 shadow-sm focus-within:border-[var(--border)]">
                        <Sprout size={15} className="shrink-0 text-[var(--sage)]" />
                        <input
                          value={newPlanetName}
                          onChange={(event) => setNewPlanetName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') addPlanet();
                            if (event.key === 'Escape') setIsAddingPlanet(false);
                          }}
                          placeholder="Ej. Trabajo, Universidad..."
                          className="garden-switcher-input h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]"
                        />
                      </label>
                      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                        <button
                          onClick={addPlanet}
                          disabled={!newPlanetName.trim()}
                          className="h-11 rounded-2xl bg-[var(--sage)] text-xs font-black text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/15 disabled:opacity-40"
                        >
                          Crear
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingPlanet(false)}
                          className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-muted)] transition-colors hover:text-[var(--earth)]"
                          aria-label="Cancelar crear jardín"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  )}

                  {showPlanetSettings && (
                    <div className="mt-2 rounded-[1.35rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--bg-app),var(--surface-soft))] p-3 shadow-inner shadow-white/40">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[var(--surface-strong)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                          <Settings size={15} />
                        </span>
                        <div>
                          <p className="text-xs font-black text-[var(--earth)]">Jardín actual</p>
                          <p className="text-[10px] font-semibold text-[var(--text-muted)]">Renombra o elimina este jardín.</p>
                        </div>
                      </div>
                      <label className="flex h-12 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 shadow-sm focus-within:border-[var(--border)]">
                        <Leaf size={15} className="shrink-0 text-[var(--sage)]" />
                        <input
                          value={editingPlanetName}
                          onChange={(event) => setEditingPlanetName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') renameActivePlanet();
                            if (event.key === 'Escape') setShowPlanetSettings(false);
                          }}
                          className="garden-switcher-input h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--earth)] outline-none"
                        />
                      </label>
                      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                        <button
                          onClick={renameActivePlanet}
                          disabled={!editingPlanetName.trim()}
                          className="h-11 rounded-2xl bg-[var(--sage)] text-xs font-black text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/15 disabled:opacity-40"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={deleteActivePlanet}
                          className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger)] transition-colors hover:opacity-85"
                          title="Borrar jardín"
                          aria-label="Borrar jardín activo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

	        <div className="mb-8 space-y-1.5 md:mb-12">
	          {[
	                    { id: 'today', label: t('today'), detail: 'Una decisión clara', icon: Droplets },
	                    { id: 'inbox', label: t('seeds'), detail: 'Ideas sin presión', icon: Sprout },
	                    { id: 'projects', label: t('sprouts'), detail: 'Siguiente paso', icon: Target },
	                    { id: 'garden', label: t('garden'), detail: 'Recompensa visual', icon: LayoutGrid },
	                    { id: '3D', label: t('planet'), detail: 'Mundo vivo', icon: Box },
	                    { id: 'calendar', label: t('path'), detail: 'Ritmo y memoria', icon: CalendarIcon },
	                    { id: 'profile', label: t('profile'), detail: 'Tu jardín', icon: User },
	          ].map((item) => (
	                <button
	                  key={item.id}
                  onClick={() => {
                    setSelectedNoteId(null);
                    if (item.id === 'projects') {
                      setSearch('');
                      setFilterStage('all');
                    }
                    navigateToView(item.id as AppView);
                    setShowMobileMenu(false);
                  }}
	                  className={`relative flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left soft-interaction group ${
	                    view === item.id
	                      ? 'bg-[var(--surface-strong)] text-[var(--sage)] shadow-sm ring-1 ring-[var(--border)]'
	                      : 'text-[var(--earth)] hover:bg-[var(--surface-soft)]'
	                  }`}
	                >
	                  {view === item.id && (
	                    <motion.div
	                      layoutId="active-pill"
	                      className="absolute left-1.5 h-6 w-1 rounded-full bg-[var(--sage)]"
	                    />
	                  )}
	                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${view === item.id ? 'bg-[var(--bg-app)] text-[var(--sage)]' : 'bg-transparent text-[var(--earth)]/65 group-hover:bg-[var(--surface-strong)] group-hover:text-[var(--sage)]'}`}>
	                    <item.icon size={17} />
	                  </span>
	                  <span className="min-w-0 flex-1">
	                    <span className="block text-sm font-semibold tracking-tight">{item.label}</span>
	                    <span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--text-muted)]">{item.detail}</span>
	                  </span>
	                </button>
	          ))}
	        </div>

        <div className="mt-auto space-y-6">
          <button
            type="button"
            onClick={() => {
              startPlanting();
              setShowMobileMenu(false);
            }}
	            className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--surface-strong)] px-3 text-sm font-semibold text-[var(--sage)] shadow-sm soft-interaction hover:bg-[var(--surface-hover)]"
	          >
	            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--sage)] text-[var(--on-sage)] shadow-sm">
	              <Plus size={16} strokeWidth={2.5} />
	            </span>
	            Plantar semilla
	          </button>
	          <div className="flex items-center gap-4 px-2 py-4 border-t border-[var(--border)]">
	            <div className="w-10 h-10 rounded-full bg-[var(--sage)] flex items-center justify-center text-[var(--on-sage)] font-serif font-bold italic ring-2 ring-[var(--surface-strong)]">
	              {accountInitials}
	            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-[var(--earth)] truncate">{account.name || 'Jardinero Digital'}</p>
              <p className="text-[10px] font-medium text-[var(--text-muted)] truncate">{account.email || 'Sin correo'}</p>
            </div>
            <button
              onClick={() => {
                setShowSettings(true);
                setShowMobileMenu(false);
              }}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--sage)] transition-colors"
              title="Ajustes"
              aria-label="Abrir ajustes"
            >
              <Settings size={18} />
            </button>
            <button onClick={exportGarden} className="p-2 text-[var(--text-muted)] hover:text-[var(--sage)] transition-colors" title="Exportar jardín">
              <Download size={18} />
            </button>
          </div>
        </div>
      </aside>


      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <section className={`flex-1 overflow-y-auto app-scrollbar bg-transparent transition-all duration-300 ${view === 'calendar' ? 'px-3 pb-3 pt-[var(--safe-top-space)] sm:px-5 sm:pb-5 md:p-6' : 'px-4 pb-[var(--safe-bottom-space)] pt-[var(--safe-top-space)] sm:px-6 md:p-10'} ${selectedNoteId ? 'md:mr-[400px]' : ''}`}>
          <div className={`${view === 'calendar' ? 'mx-auto max-w-[100rem]' : 'max-w-4xl mx-auto'}`}>
            <header className={`mb-6 flex-col md:mb-10 md:flex-row justify-between items-start gap-4 md:gap-6 ${view === 'today' ? 'hidden md:flex' : 'flex'}`}>
              <div className="w-full">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-semibold text-[var(--earth)] leading-none">{activePlanet.name}</h2>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-1.5 shadow-sm">
                        <TrendingUp size={14} className="text-[var(--sage)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)]">{planetNotes.length} ideas</span>
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs italic text-[var(--text-muted)]">{activePlanet.description || 'Cada nota es el comienzo de algo grande.'}</p>
                  </div>
                </motion.div>
                <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
                  {[
                    { id: 'inbox', label: t('seeds'), value: gardenStats.seeds, tone: 'bg-[var(--tone-seed-bg)] text-[var(--tone-seed)]' },
                    { id: 'projects', label: t('sprouts'), value: gardenStats.active, tone: 'bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)]' },
                    { id: 'harvest', label: appLanguage === 'en' ? 'Harvests' : 'Cosechas', value: gardenStats.completed, tone: 'bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)]' },
                  ].map((stat) => {
                    const isActiveStat = view === stat.id;
                    return (
                      <motion.button
                        key={stat.label}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          setFilterStage('all');
                          setSelectedNoteId(null);
                          navigateToView(isActiveStat ? 'today' : stat.id as AppView);
                        }}
                        className={`rounded-2xl border px-3 py-3 shadow-sm text-left soft-interaction sm:px-4 ${isActiveStat ? 'bg-[var(--surface-strong)] border-[var(--sage)] ring-1 ring-[var(--sage)]/30' : 'bg-[var(--surface-soft)] border-[var(--border)] hover:bg-[var(--surface-strong)]'}`}
                      >
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{stat.label}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xl font-serif font-black text-[var(--earth)] sm:text-2xl">{stat.value}</span>
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full sm:h-7 sm:w-7 ${stat.tone}`}>
                            <Circle size={10} fill="currentColor" />
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                {growingNotes.length > 7 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-2xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] px-4 py-3 flex items-start gap-3"
                  >
                    <Pause size={18} className="mt-0.5 shrink-0 text-[var(--tone-warning)]" />
                    <p className="text-sm text-[var(--tone-warning)]">
                      Tienes {growingNotes.length} brotes activos. Para avanzar mejor, pausa algunos o usa Enfoque.
                    </p>
                  </motion.div>
                )}
              </div>
              <div className="relative w-full md:w-64 md:mt-[6.45rem]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                <input
                  type="text"
                  placeholder="Buscar en el jardín..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] pl-10 pr-4 text-sm transition-all focus:bg-[var(--surface-strong)] focus:outline-none focus:ring-0 md:h-11 md:rounded-xl"
                />
              </div>
            </header>

            <AnimatePresence mode="popLayout" initial={false}>
              {view === 'today' ? (
                <TodayView
                  accountName={account.name}
                  notes={planetNotes}
                  quickNote={quickNote}
                  setQuickNote={setQuickNote}
                  onQuickCapture={addQuickNote}
                  onOpenWatering={openWatering}
                  onSkipWatering={skipWateringToday}
                  onSelectNote={setSelectedNoteId}
                  onToggleTask={toggleTask}
                  onFocusNote={openFocusMode}
                  onStartPlanting={startPlanting}
                  onCloseDay={closeDayWithReflection}
                  onNavigate={navigateToView}
                  onShowWateringQueue={showWateringQueue}
                  todayWidgets={todayWidgets}
                  wateredToday={wateredToday}
                  wateringStreak={wateringRitual.streak}
                  getProgress={getProgress}
                  dailyIntention={dailyIntention}
                  setDailyIntention={setDailyIntention}
                />
              ) : view === 'inbox' ? (
                <InboxView
                  notes={planetNotes}
                  quickNote={quickNote}
                  setQuickNote={setQuickNote}
                  onQuickCapture={addQuickNote}
                  onCultivate={cultivateInboxNote}
                  onComplete={completeQuickSeed}
	                  onSaveLater={saveInboxForLater}
	                  onDelete={deleteNote}
	                  onSelectNote={setSelectedNoteId}
	                  onShowActions={setQuickActionsNoteId}
	                  recentlyCreatedNoteId={recentlyCreatedNoteId}
	                  onStartPlanting={() => openCreateOption('seed')}
	                />
              ) : view === 'projects' ? (
                <ProjectsView
                  notes={planetNotes}
                  onSelectNote={setSelectedNoteId}
                  onFocusNote={openFocusMode}
                  onToggleTask={toggleTask}
                  onOpenWatering={openWatering}
                  onTogglePause={togglePauseNote}
                  onShowActions={setQuickActionsNoteId}
                  onStartSprout={() => openCreateOption('sprout')}
                  getProgress={getProgress}
                />
              ) : view === 'focus' ? (
                <FocusView
                  notes={planetNotes}
                  theme={activePlanet.theme || theme}
                  focusNoteId={focusNoteId}
                  onAddTinyStep={addTinyStep}
                  onOpenWatering={openWatering}
                  onSelectNote={setSelectedNoteId}
                  onToggleTask={toggleTask}
                  onUpdateTask={updateTask}
                  onDeleteTask={deleteTask}
                  onLogFocus={logFocusMinutes}
                  onPickFocus={setFocusNoteId}
                  onExit={() => setView('today')}
                />
              ) : view === 'profile' ? (
                <motion.div
                  key="profile-view"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="space-y-5 pb-2 md:pb-8"
                >
                  <section className="overflow-hidden rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm">
                    <div className="flex items-center gap-4 px-5 py-5">
	                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.35rem] bg-[var(--sage)] text-2xl font-semibold text-[var(--on-sage)]">
                        {accountInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-2xl font-semibold tracking-tight text-[var(--earth)]">{account.name || 'Jardinero Digital'}</h3>
                        <p className="mt-1 truncate text-sm font-medium text-[var(--text-muted)]">{account.purpose || 'Un jardín para ideas y proyectos'}</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-muted)]">{session?.user?.email || account.email || 'Modo local'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 border-t border-[var(--border)]">
                      {[
                        { label: t('seeds'), value: profileStats.seeds },
                        { label: t('sprouts'), value: profileStats.active },
                        { label: appLanguage === 'en' ? 'Harvests' : 'Cosechas', value: profileStats.harvests },
                        { label: 'Racha', value: wateringRitual.streak },
                      ].map(item => (
                        <div key={item.label} className="border-r border-[var(--border)] px-2 py-3 text-center last:border-r-0">
                          <p className="text-lg font-semibold text-[var(--earth)]">{item.value}</p>
                          <p className="mt-0.5 truncate text-[9px] font-medium text-[var(--text-muted)]">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm">
                    {[
                      { icon: Settings, title: t('settings'), detail: appLanguage === 'en' ? 'Account, theme, watering and reminders' : 'Cuenta, tema, riego y recordatorios', onClick: () => setShowSettings(true) },
                      { icon: CalendarIcon, title: t('path'), detail: appLanguage === 'en' ? 'Review activity by day' : 'Revisa actividad por día', onClick: openCalendarToday },
                      { icon: Box, title: t('planet'), detail: appLanguage === 'en' ? 'Open the 3D garden when you need it' : 'Abre el jardín 3D cuando lo necesites', onClick: () => setView('3D') },
                      { icon: Archive, title: 'Lo aprendido', detail: `${profileStats.harvests} cierre${profileStats.harvests === 1 ? '' : 's'} de idea${profileStats.harvests === 1 ? '' : 's'}`, onClick: () => setView('harvest') },
                    ].map((item, index) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={item.onClick}
                        className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] ${index > 0 ? 'border-t border-[var(--border)]' : ''}`}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--sage)]">
                          <item.icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">{item.title}</span>
                          <span className="mt-0.5 block truncate text-sm font-medium text-[var(--text-muted)]">{item.detail}</span>
                        </span>
                        <ChevronRight size={16} className="text-[var(--text-muted)]" />
                      </button>
                    ))}
                  </section>

                  <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{profileStats.season}</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--earth)]">
                      {account.mantra?.trim() || 'Estoy cultivando ideas que merecen volver a existir fuera de mi cabeza.'}
                    </p>
                  </section>
                </motion.div>
              ) : view === 'harvest' ? (
                <HarvestView notes={planetNotes} onSelectNote={setSelectedNoteId} onStartPlanting={() => openCreateOption('seed')} />
              ) : view === 'garden' ? (
                <motion.div
                  key={`${view}-view`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                >
                  <section className="mb-5 overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm">
                    <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-3xl font-semibold tracking-tight text-[var(--earth)]">{t('garden')}</h3>
                        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">{gardenStats.total} ideas plantadas en {activePlanet.name}</p>
                      </div>
                      <button
                        onClick={() => setView('3D')}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                      >
                        <Box size={15} /> {t('planet')}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 border-t border-[var(--border)]">
                      {[
                        { label: 'Flores', value: gardenStats.flowers },
                        { label: t('sprouts'), value: gardenStats.active },
                        { label: 'Árboles', value: gardenStats.trees },
                      ].map(item => (
                        <div key={item.label} className="border-r border-[var(--border)] px-3 py-3 text-center last:border-r-0">
                          <p className="text-xl font-semibold text-[var(--earth)]">{item.value}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="mb-5 flex gap-2 overflow-x-auto pb-2 app-scrollbar">
                    {[
                      { id: 'all', label: 'Todo el jardín', count: gardenStats.total },
                      { id: 'water', label: 'Por regar', count: gardenStats.watering },
                      { id: 'seed', label: appLanguage === 'en' ? 'Seed stage' : 'Etapa semilla', count: gardenStats.plantedSeeds },
                      { id: 'sprout', label: appLanguage === 'en' ? 'Sprout stage' : 'Etapa brote', count: gardenStats.visualSprouts },
                      { id: 'bloom', label: appLanguage === 'en' ? 'Harvests' : 'Cosechas', count: gardenStats.completed },
                    ].map(item => {
                      const isActive =
                        item.id === 'all' ? !search.trim() && filterStage === 'all' :
                        item.id === 'water' ? search.trim().toLowerCase() === 'riego' :
                        filterStage === item.id && search.trim().toLowerCase() !== 'riego';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedNoteId(null);
                            if (item.id === 'all') {
                              setSearch('');
                              setFilterStage('all');
                            } else if (item.id === 'water') {
                              setSearch('riego');
                              setFilterStage('all');
                            } else {
                              setSearch('');
                              setFilterStage(item.id as SeedNote['growthStage']);
                            }
                          }}
                          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition-colors ${
                            isActive
                              ? 'bg-[var(--sage)] text-[var(--on-sage)] border-[var(--sage)] shadow-lg shadow-[var(--sage)]/20'
                              : 'bg-[var(--surface-soft)] text-[var(--earth)] border-[var(--border)] hover:bg-[var(--surface-strong)]'
                          }`}
                        >
                          {item.label} <span className={isActive ? 'text-white/70' : 'text-[var(--text-muted)]'}>{item.count}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-28 space-y-3 md:mb-20">
                    {visibleGardenNotes.map((note) => {
                      const progress = getProgress(note);
	                      const stageMeta = STAGE_META[note.growthStage];
	                      const nextTask = note.tasks.find(task => !task.completed);
	                      const guidance = getIdeaGuidance(note);
	                      const StageIcon =
	                        note.growthStage === 'bloom' ? CheckCircle2 :
	                        note.growthStage === 'withered' ? Skull :
	                        note.growthStage === 'sprout' ? Sprout :
	                        Leaf;
	                      const stageTone =
	                        note.growthStage === 'bloom' ? 'bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)] ring-[var(--tone-harvest-border)]' :
	                        note.growthStage === 'withered' ? 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning)] ring-[var(--tone-warning-border)]' :
	                        note.growthStage === 'sprout' ? 'bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)] ring-[var(--tone-sprout-border)]' :
	                        'bg-[var(--tone-seed-bg)] text-[var(--tone-seed)] ring-[var(--tone-seed-border)]';

	                      return (
	                      <GestureNoteSurface
                        key={note.id}
                        onPress={() => setSelectedNoteId(note.id)}
                        onSwipeRight={() => openWatering(note.id)}
                        onSwipeLeft={() => togglePauseNote(note.id)}
                        onLongPress={() => setQuickActionsNoteId(note.id)}
                        rightLabel="Regar"
                        leftLabel={note.paused ? 'Reanudar' : 'Pausar'}
                        leftIcon={Pause}
                        wrapperClassName={IDEA_CARD_WRAPPER}
	                        className={`${IDEA_CARD_SURFACE} min-h-[5.25rem] cursor-pointer px-4 py-3 ${
	                          selectedNoteId === note.id 
	                            ? 'bg-[var(--bg-app)]' 
	                            : ''
	                        }`}
	                      >
	                        <div className="flex items-start gap-3">
	                          <div className={`${IDEA_ICON_TILE} ${stageTone}`}>
	                            <StageIcon size={18} strokeWidth={2.2} />
	                            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-current opacity-35" />
	                          </div>

	                          <div className="min-w-0 flex-1">
	                            <div className="flex min-w-0 items-center justify-between gap-2">
	                              <h3 className={`min-w-0 truncate text-[15px] font-semibold leading-tight transition-colors ${selectedNoteId === note.id ? 'text-[var(--sage)]' : note.growthStage === 'withered' ? 'text-[var(--text-muted)]' : 'text-[var(--earth)]'}`}>{note.title}</h3>
	                              <span className="shrink-0 text-[11px] font-semibold text-[var(--text-muted)]">
	                                {note.isGrowth ? `${progress}%` : stageMeta.shortLabel}
	                              </span>
	                            </div>
                            <p className="mt-1 line-clamp-1 text-sm leading-relaxed text-[var(--text-muted)]">
                              {nextTask?.text || note.content}
                            </p>

	                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[var(--text-muted)]">
	                              <span>{appLanguage === 'en' ? 'Created' : 'Creada'} {formatShortDate(note.createdAt)}</span>
	                              {note.tasks.length > 0 && <span>{note.tasks.length} pasos</span>}
	                              {(note.focusedMinutes || 0) > 0 && <span>{note.focusedMinutes || 0} min</span>}
                              {note.dueDate && (
                                <span className={note.growthStage === 'withered' ? 'text-[var(--tone-warning)]' : 'text-[var(--sage)]'}>
                                  {formatShortDate(note.dueDate)}
                                </span>
                              )}
                            </div>

                            {note.isGrowth && (
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-app)]">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                                  className={`h-full rounded-full ${note.growthStage === 'bloom' ? 'bg-[#7f9a83]' : 'bg-[var(--sage)]'}`}
                                />
                              </div>
                            )}
                          </div>

	                          <div className="flex shrink-0 items-center gap-1">
	                            <button 
	                              onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
	                              className="hidden h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] opacity-100 transition-colors hover:bg-[var(--tone-danger-bg)] hover:text-[var(--tone-danger)] sm:grid sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
	                              aria-label={`Eliminar ${note.title}`}
	                            >
	                              <Trash2 size={14} />
	                            </button>
	                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                runCardAction(note, guidance.kind);
                              }}
	                              className={`grid h-10 min-w-10 place-items-center rounded-full px-2 text-xs font-semibold shadow-sm soft-interaction active:translate-y-px ${guidance.actionTone}`}
                              title={guidance.title}
                              aria-label={guidance.action}
                            >
                              {guidance.kind === 'water' ? <Droplets size={14} /> :
                               guidance.kind === 'focus' ? <Target size={14} /> :
                               guidance.kind === 'grow' ? <Sprout size={14} /> :
                               guidance.kind === 'pause' ? <Pause size={14} /> :
                               <ArrowRight size={14} />}
                            </button>
                            <ChevronRight size={16} className="hidden text-[var(--text-muted)] sm:block" />
                          </div>
                        </div>
                      </GestureNoteSurface>
                      );
                    })}
                  </div>
                </motion.div>
              ) : view === 'calendar' ? (
                <CalendarView 
                  key="calendar-view"
                  currentMonth={currentMonth} 
                  setCurrentMonth={setCurrentMonth} 
                  notes={planetNotes} 
                  onSelectNote={setSelectedNoteId} 
                  onExit={() => setView('today')}
                />
              ) : (
                <motion.div
                  key="3d-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative"
                >
	                  <button
	                    type="button"
	                    onClick={() => setShowGardenFullscreen(true)}
	                    className="absolute right-4 top-[var(--safe-top-control)] z-20 grid h-10 w-10 place-items-center rounded-2xl border border-white/24 bg-white/[0.13] text-white shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-colors hover:bg-white/[0.18] sm:left-1/2 sm:right-auto sm:h-11 sm:w-11 sm:-translate-x-1/2"
	                    aria-label="Ver planeta en pantalla completa"
	                    title="Pantalla completa"
	                  >
                    <Maximize2 size={18} />
                  </button>
                  <Suspense fallback={
                    <div className="h-[75vh] rounded-[3rem] border border-[var(--border)] bg-[var(--surface-soft)] flex items-center justify-center text-center p-8">
                      <div>
                        <Box className="mx-auto text-[var(--sage)] mb-4 animate-pulse" size={44} />
                        <p className="font-serif text-3xl font-black text-[var(--earth)]">Cargando ecosistema</p>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">El 3D se carga solo cuando lo necesitas.</p>
                      </div>
                    </div>
                  }>
                    <Garden3D 
                      key={`${activePlanet.id}-${activePlanet.theme || theme}-garden`}
                      notes={filteredNotes} 
                      theme={activePlanet.theme || theme}
                      planetName={activePlanet.name}
                      dailyIntention={dailyIntention}
                      onSelectNote={setSelectedNoteId} 
                      onReviewNote={openWatering}
                      onFocusNote={openFocusMode}
                      recentlyWateredId={recentlyWateredId}
                    />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showGardenFullscreen && (
                <motion.div
                  key="garden-fullscreen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black"
                >
                  <button
                    type="button"
                    onClick={() => setShowGardenFullscreen(false)}
	                    className="absolute right-5 top-[var(--safe-top-control)] z-50 grid h-12 w-12 place-items-center rounded-2xl border border-white/24 bg-white/[0.13] text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-colors hover:bg-white/[0.18] sm:right-6 sm:top-32"
                    aria-label="Cerrar pantalla completa"
                    title="Cerrar"
                  >
                    <X size={20} />
                  </button>
                  <Suspense fallback={
                    <div className="grid h-screen place-items-center bg-[var(--earth)] text-center text-[var(--on-earth)]">
                      <div>
                        <Box className="mx-auto mb-4 animate-pulse text-white/70" size={44} />
                        <p className="font-serif text-3xl font-black">Cargando planeta</p>
                      </div>
                    </div>
                  }>
                    <Garden3D
                      key={`${activePlanet.id}-${activePlanet.theme || theme}-fullscreen`}
                      notes={filteredNotes}
                      theme={activePlanet.theme || theme}
                      planetName={activePlanet.name}
                      dailyIntention={dailyIntention}
                      fullscreen
                      onSelectNote={(id) => {
                        setSelectedNoteId(id);
                        setShowGardenFullscreen(false);
                      }}
                      onReviewNote={(id) => {
                        setShowGardenFullscreen(false);
                        openWatering(id);
                      }}
                      onFocusNote={openFocusMode}
                      recentlyWateredId={recentlyWateredId}
                    />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>

            {visibleGardenNotes.length === 0 && !isAdding && view === 'garden' && (
              <EmptyStatePanel
                icon={Leaf}
                eyebrow={search || filterStage !== 'all' ? 'Filtro sin resultados' : 'Jardín listo'}
                title={search || filterStage !== 'all' ? 'No hay ideas con este filtro' : 'Tu jardín todavía está esperando su primera semilla'}
                detail={search || filterStage !== 'all'
                  ? 'Prueba Todo el jardín o busca otra palabra para encontrar lo que ya plantaste.'
                  : 'Escribe una idea que no quieres perder. No tiene que estar perfecta para empezar a crecer.'}
                actionLabel={search || filterStage !== 'all' ? 'Ver todo' : 'Plantar semilla'}
                onAction={() => {
                  if (search || filterStage !== 'all') {
                    setSearch('');
                    setFilterStage('all');
                    return;
                  }
                  startPlanting();
                }}
                secondaryLabel={search || filterStage !== 'all' ? 'Plantar nueva' : undefined}
                onSecondary={search || filterStage !== 'all' ? startPlanting : undefined}
                variant={search || filterStage !== 'all' ? 'compact' : 'default'}
              />
            )}
          </div>
        </section>

	        {/* Selected Note Detail Panel */}
	        <AnimatePresence>
	          {selectedNoteId && selectedNote && selectedGuidance && (
	            <motion.aside 
	              initial={{ x: '100%' }}
	              animate={{ x: 0 }}
	              exit={{ x: '100%' }}
	              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
	              className="absolute bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--bg-app)] shadow-2xl md:z-30 md:w-[420px]"
	            >
	              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-strong)]/82 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.9rem)] backdrop-blur-2xl md:pt-4">
	                <div className="min-w-0">
	                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
	                    {selectedNote.inbox ? 'Semillero' : selectedNote.paused ? 'Pausada' : STAGE_META[selectedNote.growthStage].label}
	                  </p>
	                  <p className="mt-0.5 truncate text-sm font-semibold text-[var(--earth)]">{activePlanet.name}</p>
	                </div>
	                <button onClick={() => setSelectedNoteId(null)} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]">
	                  <X size={18} />
	                </button>
	              </div>
	
	              <div className="flex-1 overflow-y-auto app-scrollbar px-4 py-4 pb-44 md:pb-36">
	                <section className="overflow-hidden rounded-[1.75rem] bg-[var(--surface-strong)] shadow-sm ring-1 ring-[var(--border)]">
	                  <div className="relative p-5">
	                    <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,var(--surface-soft),transparent)]" />
	                    <div className="relative">
	                      <div className="mb-4 flex items-center justify-between gap-3">
	                        <div className="flex min-w-0 flex-wrap gap-2">
	                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${STAGE_META[selectedNote.growthStage].bg} ${STAGE_META[selectedNote.growthStage].color}`}>
	                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
	                            {selectedNote.paused ? 'Pausada' : STAGE_META[selectedNote.growthStage].shortLabel}
	                          </span>
	                        </div>
	                        <span className="shrink-0 rounded-full bg-[var(--bg-app)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
	                          {formatShortDate(selectedNote.createdAt)}
	                        </span>
	                      </div>
	
	                      <input
	                        type="text"
	                        value={selectedNote.title}
	                        onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
	                        className="seed-title-input w-full bg-transparent text-[2rem] font-semibold leading-tight tracking-tight text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/38"
	                        placeholder="Sin título"
	                      />
	
	                      <textarea
	                        value={selectedNote.content}
	                        onChange={(e) => updateNote(selectedNote.id, { content: e.target.value })}
	                        rows={3}
	                        className="mt-3 min-h-[5.5rem] w-full resize-none bg-transparent text-base font-medium leading-relaxed text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]/50"
	                        placeholder="Qué quieres recordar de esta idea?"
	                      />
	                    </div>
	                  </div>
	                </section>
	
	                <section className="mt-4 rounded-[1.5rem] bg-[var(--surface-strong)] p-4 shadow-sm ring-1 ring-[var(--border)]">
	                  <div className="flex items-start gap-3">
	                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--bg-app)] text-[var(--sage)]">
	                      {selectedGuidance.kind === 'water' ? <Droplets size={17} /> :
	                       selectedGuidance.kind === 'focus' ? <Target size={17} /> :
	                       selectedGuidance.kind === 'grow' ? <Sprout size={17} /> :
	                       <Sparkles size={17} />}
	                    </span>
	                    <div className="min-w-0 flex-1">
	                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Acción recomendada</p>
	                      <h4 className="mt-1 text-lg font-semibold tracking-tight text-[var(--earth)]">{selectedGuidance.title}</h4>
	                      <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">{selectedGuidance.detail}</p>
	                      <div className="mt-3 flex flex-wrap gap-2">
	                        <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
	                          {selectedNote.growthStage === 'bloom' ? 'Cosechada' : formatReviewAge(selectedNote)}
	                        </span>
	                        <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
	                          {selectedNote.isGrowth && selectedNote.tasks.length > 0 ? `${selectedCompletedSteps}/${selectedNote.tasks.length} pasos` : 'Sin pasos'}
	                        </span>
	                      </div>
	                    </div>
	                  </div>
	                  {!(selectedIsDone && selectedGuidance.kind === 'open') && (
	                    <button
	                      onClick={() => {
	                        if (selectedGuidance.kind === 'grow') openSproutPrompt(selectedNote.id);
	                        else if (selectedGuidance.kind === 'water') openWatering(selectedNote.id);
	                        else if (selectedGuidance.kind === 'focus') {
	                          openFocusMode(selectedNote.id);
	                        } else {
	                          addTask(selectedNote.id);
	                        }
	                      }}
	                      className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm soft-interaction ${selectedGuidance.actionTone}`}
	                    >
	                      {selectedGuidance.kind === 'water' ? <Droplets size={15} /> :
	                       selectedGuidance.kind === 'focus' ? <Target size={15} /> :
	                       selectedGuidance.kind === 'grow' ? <Sprout size={15} /> :
	                       <Plus size={15} />}
	                      {selectedGuidance.kind === 'open' ? 'Añadir paso' : selectedGuidance.action}
	                    </button>
	                  )}
	                </section>
	
	                {selectedNote.isGrowth ? (
	                  <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm">
	                    <div className="border-b border-[var(--border)] p-4">
	                      <div className="flex items-center justify-between">
	                        <div>
	                          <p className="text-sm font-semibold text-[var(--earth)]">Siguiente paso</p>
	                          <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
	                            {selectedNextTask ? selectedNextTask.text : selectedNote.growthStage === 'bloom' ? 'Cosecha completada' : 'Añade un paso pequeño'}
	                          </p>
	                        </div>
	                        <span className="rounded-full bg-[var(--bg-app)] px-3 py-1.5 text-xs font-semibold text-[var(--sage)]">{selectedProgress}%</span>
	                      </div>
	                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-app)]">
	                        <motion.div
	                          initial={{ width: 0 }}
	                          animate={{ width: `${selectedProgress}%` }}
	                          className="h-full rounded-full bg-[var(--sage)]"
	                        />
	                      </div>
	                    </div>
	                    <div className="p-2">
	                      <AnimatePresence>
	                        {selectedNote.tasks.map(task => (
	                          <motion.div
	                            key={task.id}
	                            initial={{ opacity: 0, y: 5 }}
	                            animate={{ opacity: 1, y: 0 }}
	                            className="flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-[var(--bg-app)]"
	                          >
	                            <button
	                              onClick={() => toggleTask(selectedNote.id, task.id)}
	                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all ${task.completed ? 'border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)]' : 'border-[var(--border)] text-transparent hover:border-[var(--sage)]'}`}
	                              aria-label={task.completed ? 'Marcar paso pendiente' : 'Completar paso'}
	                            >
	                              <CheckCircle2 size={15} />
	                            </button>
	                            <input
	                              type="text"
	                              value={task.text}
	                              onChange={(e) => updateTask(selectedNote.id, task.id, e.target.value)}
	                              className={`min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--earth)] outline-none transition-all placeholder:text-[var(--text-muted)]/55 ${task.completed ? 'line-through opacity-45' : ''}`}
	                              placeholder="Describe el paso..."
	                            />
	                            <button
	                              type="button"
	                              onClick={() => deleteTask(selectedNote.id, task.id)}
	                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tone-danger-bg)] hover:text-[var(--tone-danger)]"
	                              aria-label="Eliminar paso"
	                            >
	                              <Trash2 size={14} />
	                            </button>
	                          </motion.div>
	                        ))}
	                      </AnimatePresence>
	                      <button
	                        onClick={() => addTask(selectedNote.id)}
	                        className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bg-app)] text-sm font-semibold text-[var(--sage)] soft-interaction"
	                      >
	                        <Plus size={14} /> Añadir paso mínimo
	                      </button>
	                    </div>
	                  </section>
	                ) : selectedIsDone ? (
	                  <section className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-sm">
	                    <p className="text-sm font-semibold text-[var(--earth)]">Cierre guardado</p>
	                    <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
	                      Esta idea ya está cosechada. Si dejó algo importante, guárdalo en Lo aprendido.
	                    </p>
	                  </section>
	                ) : (
	                  <section className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-sm">
	                    <p className="text-sm font-semibold text-[var(--earth)]">Semilla sin presión</p>
	                    <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
	                      Decide después o conviértela en brote cuando exista un primer paso de 5 minutos.
	                    </p>
	                    <button
	                      onClick={() => openSproutPrompt(selectedNote.id)}
	                      className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction"
	                    >
	                      <Sprout size={15} /> Convertir en brote
	                    </button>
	                  </section>
	                )}

	                <details className="mt-4 overflow-hidden rounded-[1.5rem] bg-[var(--surface-strong)] shadow-sm ring-1 ring-[var(--border)] [&_summary::-webkit-details-marker]:hidden">
	                  <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--earth)]">
	                    Datos de actividad
	                    <ChevronRight size={16} className="text-[var(--text-muted)]" />
	                  </summary>
	                  <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] bg-[var(--bg-app)]/30 p-3 sm:grid-cols-4">
	                    {[
	                      { label: 'Creada', value: formatShortDate(selectedNote.createdAt) },
	                      { label: 'Riego', value: selectedNote.growthStage === 'bloom' ? 'Lista' : selectedReviewDays <= 0 ? 'Hoy' : `${selectedReviewDays}d` },
	                      { label: 'Pasos', value: selectedNote.isGrowth && selectedNote.tasks.length > 0 ? `${selectedCompletedSteps}/${selectedNote.tasks.length}` : 'Libre' },
	                      { label: 'Foco', value: `${selectedNote.focusedMinutes || 0}m` },
	                    ].map(item => (
	                      <div key={item.label} className="rounded-2xl bg-[var(--surface-strong)] px-3 py-3 text-center shadow-sm ring-1 ring-[var(--border)]">
	                        <p className="truncate text-lg font-semibold text-[var(--earth)]">{item.value}</p>
	                        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{item.label}</p>
	                      </div>
	                    ))}
	                  </div>
	                </details>
	
	                {selectedNote.growthStage === 'bloom' && (
	                  <section className="mt-4 rounded-[1.5rem] border border-[var(--tone-harvest-border)] bg-[var(--tone-harvest-bg)] p-4">
	                    <div className="flex items-start justify-between gap-3">
	                      <div>
	                        <p className="text-sm font-semibold text-[var(--tone-harvest)]">Lo aprendido</p>
	                        <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
	                          Opcional: guarda el cierre de esta idea sin convertirlo en diario.
	                        </p>
	                      </div>
	                      <button
	                        type="button"
	                        onClick={() => setHarvestNoteId(selectedNote.id)}
	                        className="shrink-0 rounded-full bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] shadow-sm"
	                      >
	                        Editar
	                      </button>
	                    </div>
	                    <textarea
	                      value={selectedNote.reflection || ''}
	                      onChange={(e) => updateNote(selectedNote.id, { reflection: e.target.value })}
	                      rows={3}
	                      className="mt-3 w-full resize-none rounded-2xl border border-[var(--tone-harvest-border)] bg-[var(--surface-strong)]/85 p-3 text-sm font-medium text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/65 focus:ring-0"
	                      placeholder="Qué aprendiste de esta idea?"
	                    />
	                    <textarea
	                      value={selectedNote.takeaway || ''}
	                      onChange={(e) => updateNote(selectedNote.id, { takeaway: e.target.value })}
	                      rows={2}
	                      className="mt-2 w-full resize-none rounded-2xl border border-[var(--tone-harvest-border)] bg-[var(--surface-strong)]/85 p-3 text-sm font-medium text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/65 focus:ring-0"
	                      placeholder="Qué te dejó este proyecto?"
	                    />
	                  </section>
	                )}
	
	                {selectedNote.growthStage === 'withered' && (
	                  <section className="mt-4 rounded-[1.5rem] border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] p-4">
	                    <p className="text-sm font-semibold text-[var(--tone-warning)]">Esta semilla se quedó quieta</p>
	                    <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">Puedes revivirla si todavía importa, o soltarla sin culpa.</p>
	                  </section>
	                )}
	
	                <details className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] [&_summary::-webkit-details-marker]:hidden">
	                  <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--earth)]">
	                    Organización
	                    <ChevronRight size={16} className="text-[var(--text-muted)]" />
	                  </summary>
	                  <div className="border-t border-[var(--border)]">
	                    <div className="border-b border-[var(--border)] px-4 py-3">
	                      <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Tipo</p>
	                      <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
	                        {SEED_TYPES.map(type => (
	                          <button
	                            key={type.id}
	                            onClick={() => updateNote(selectedNote.id, { seedType: type.id })}
	                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
	                              (selectedNote.seedType || 'idea') === type.id
	                                ? 'bg-[var(--sage)] text-[var(--on-sage)]'
	                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--earth)]'
	                            }`}
	                          >
	                            {type.label}
	                          </button>
	                        ))}
	                      </div>
	                    </div>
	                    <div className="border-b border-[var(--border)] px-4 py-3">
	                      <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Prioridad</p>
	                      <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
	                        {PRIORITY_OPTIONS.map(option => (
	                          <button
	                            key={option.id}
	                            onClick={() => updateNote(selectedNote.id, { priority: option.id })}
	                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
	                              selectedPriority.id === option.id
	                                ? 'bg-[var(--sage)] text-[var(--on-sage)]'
	                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--earth)]'
	                            }`}
	                          >
	                            {priorityLabel(option)}
	                          </button>
	                        ))}
	                      </div>
	                    </div>
	                    <label className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
	                      <span className="text-sm font-medium text-[var(--text-muted)]">Fecha objetivo</span>
	                      <input
	                        type="date"
	                        value={selectedNote.dueDate ? timestampToDateInput(selectedNote.dueDate) : ''}
	                        onChange={(e) => updateNote(selectedNote.id, { dueDate: e.target.value ? dateInputToEndOfDay(e.target.value) : undefined })}
	                        className="min-w-0 bg-transparent text-right text-sm font-semibold text-[var(--earth)] outline-none"
	                      />
	                    </label>
	                    <div className="flex min-h-12 items-center justify-between gap-2 px-4 py-2">
	                      <span className="text-sm font-medium text-[var(--text-muted)]">Riego</span>
	                      <div className="flex gap-1">
	                        {[
	                          { value: 1, label: 'Diario' },
	                          { value: 3, label: '3d' },
	                          { value: 7, label: 'Semana' },
	                        ].map(option => (
	                          <button
	                            key={option.value}
	                            onClick={() => updateNote(selectedNote.id, { wateringIntervalDays: option.value })}
	                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
	                              (selectedNote.wateringIntervalDays || 1) === option.value
	                                ? 'bg-[var(--sage)] text-[var(--on-sage)]'
	                                : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
	                            }`}
	                          >
	                            {option.label}
	                          </button>
	                        ))}
	                      </div>
	                    </div>
	                  </div>
	                </details>
	              </div>

              <div className="border-t border-[var(--border)] bg-[var(--surface-strong)]/92 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-2xl md:pb-3">
                 <div className="grid grid-cols-2 gap-2">
                   {selectedIsDone ? (
                     <>
                       <button
                         onClick={() => {
                           setFilterStage('all');
                           setSearch('');
                           setView('harvest');
                           setSelectedNoteId(null);
                         }}
                         className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                       >
                         <Archive size={15} /> {appLanguage === 'en' ? 'Harvests' : 'Cosechas'}
                       </button>
                       <button onClick={() => setView('3D')} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)]">
                         <Box size={15} /> {t('planet')}
                       </button>
                     </>
                   ) : selectedIsQuickSeed ? (
                     <>
                       <button onClick={() => completeQuickSeed(selectedNote.id)} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction">
                         <CheckCircle2 size={15} /> Hecho
                       </button>
                       <button onClick={() => selectedNote.inbox ? cultivateInboxNote(selectedNote.id) : openSproutPrompt(selectedNote.id)} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)]">
                         <Sprout size={15} /> Proyecto
                       </button>
                     </>
                   ) : (
                     <>
                       <button
                         onClick={() => openFocusMode(selectedNote.id)}
                         className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                       >
                         <Target size={15} /> Enfocar
                       </button>
                       <button onClick={() => addTask(selectedNote.id)} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)]">
                         <Plus size={15} /> Paso
                       </button>
                     </>
                   )}
                 </div>
                 {selectedIsProject && (
                   <div className="mt-2 grid grid-cols-2 gap-2">
                     <button onClick={() => openWatering(selectedNote.id)} className="flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-xs font-semibold text-[var(--sage)]">
                       <Droplets size={14} /> Regar
                     </button>
                     <button onClick={() => togglePauseNote(selectedNote.id)} className="flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-xs font-semibold text-[var(--sage)]">
                       <Pause size={14} /> {selectedNote.paused ? 'Reactivar' : 'Pausar'}
                     </button>
                   </div>
                 )}
                 <div className="mt-3 flex items-center justify-between">
                   <button 
                     onClick={() => deleteNote(selectedNote.id)}
                     className="flex items-center gap-2 text-xs font-semibold text-[var(--tone-danger)] transition-colors hover:opacity-75"
                   >
                     <Trash2 size={14} /> Eliminar
                   </button>
                   <span className="text-xs text-[var(--text-muted)]">{formatShortDate(selectedNote.createdAt)}</span>
                 </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {quickActionsNote && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[64] flex items-end justify-center bg-black/25 p-3 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setQuickActionsNoteId(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
                <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--seed-accent)]">Acciones rápidas</p>
                    <h3 className="mt-1 truncate text-2xl font-semibold tracking-tight text-[var(--earth)]">{quickActionsNote.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">{quickActionsNote.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickActionsNoteId(null)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--text-muted)]"
                    aria-label="Cerrar acciones rápidas"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="grid gap-2 border-t border-[var(--border)] p-3">
                  {!quickActionsNote.inbox && quickActionsNote.growthStage !== 'bloom' && (
                    <button onClick={() => runQuickAction('water')} className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-water-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-water)] ring-1 ring-[var(--tone-water-border)]">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80"><Droplets size={16} /></span>
                      Regar
                    </button>
                  )}
                  {quickActionsNote.inbox || !quickActionsNote.isGrowth ? (
                    <button onClick={() => runQuickAction('sprout')} className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-sprout-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-sprout)] ring-1 ring-[var(--tone-sprout-border)]">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80"><Sprout size={16} /></span>
                      Convertir en brote
                    </button>
                  ) : (
                    <button onClick={() => runQuickAction('focus')} className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--bg-app)] px-4 text-left text-sm font-semibold text-[var(--sage)]">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]"><Target size={16} /></span>
                      Enfocar
                    </button>
                  )}
                  {quickActionsNote.inbox ? (
                    <button onClick={() => runQuickAction('later')} className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-warning-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-warning)] ring-1 ring-[var(--tone-warning-border)]">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80"><Archive size={16} /></span>
                      Guardar para luego
                    </button>
                  ) : (
                    <button onClick={() => runQuickAction('pause')} className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-warning-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-warning)] ring-1 ring-[var(--tone-warning-border)]">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80"><Pause size={16} /></span>
                      {quickActionsNote.paused ? 'Reanudar' : 'Pausar'}
                    </button>
                  )}
                  <button onClick={() => runQuickAction('harvest')} className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-harvest-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-harvest)] ring-1 ring-[var(--tone-harvest-border)]">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80"><CheckCircle2 size={16} /></span>
                    Cosechar
                  </button>
                  <button onClick={() => runQuickAction('delete')} className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-danger-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-danger)] ring-1 ring-[var(--tone-danger-border)]">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80"><Trash2 size={16} /></span>
                    Eliminar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sproutPromptNoteId && (() => {
            const note = notes.find(n => n.id === sproutPromptNoteId);
            if (!note) return null;

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[62] flex items-end justify-center bg-black/25 p-4 backdrop-blur-sm sm:items-center"
                onClick={() => setSproutPromptNoteId(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 28, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.97 }}
                  transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                  className="w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--seed-accent)]">Semilla a brote</p>
                      <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--earth)]">¿Cuál es el primer paso de 5 minutos?</h3>
                    </div>
                    <button onClick={() => setSproutPromptNoteId(null)} className="grid h-9 w-9 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-app)]" aria-label="Cerrar">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl bg-[var(--bg-app)] p-4">
                    <p className="text-sm font-semibold text-[var(--earth)]">{note.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{note.content}</p>
                  </div>

                  <textarea
                    autoFocus
                    value={sproutFirstStep}
                    onChange={(event) => setSproutFirstStep(event.target.value)}
                    rows={3}
                    placeholder="Ej. Escribir 3 ideas, abrir el archivo, mandar un mensaje..."
                    className="mt-4 w-full resize-none rounded-2xl bg-[var(--bg-app)] p-4 text-sm font-medium outline-none focus:ring-0"
                  />

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSproutPromptNoteId(null)}
                      className="h-11 rounded-full bg-[var(--bg-app)] text-sm font-semibold text-[var(--text-muted)]"
                    >
                      Ahora no
                    </button>
                    <button
                      onClick={confirmSproutPrompt}
                      className="h-11 rounded-full bg-[var(--sage)] text-sm font-semibold text-[var(--on-sage)] shadow-sm"
                    >
                      Crear brote
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <AnimatePresence>
          {wateringNoteId && (() => {
            const note = notes.find(n => n.id === wateringNoteId);
            if (!note) return null;
            const nextTask = note.tasks.find(task => !task.completed);
            const reviewAge = formatReviewAge(note);

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/24 p-3 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-xl sm:items-center sm:p-4"
                onClick={() => setWateringNoteId(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  className="w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl sm:p-6"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
	                    <div>
	                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Riego inteligente</p>
	                      <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--earth)]">¿Sigue viva?</h3>
                        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">{reviewAge}</p>
	                    </div>
                    <button onClick={() => setWateringNoteId(null)} className="p-2 rounded-full hover:bg-[var(--bg-app)] transition-colors">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-4">
                    <p className="font-semibold text-[var(--earth)]">{note.title}</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
	                      Regar no significa trabajar. Solo decide qué merece esta idea hoy.
                    </p>
                    {nextTask && (
                      <p className="mt-3 rounded-2xl bg-[var(--surface-strong)] px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--sage)]">
                        Siguiente paso: {nextTask.text}
                      </p>
                    )}
                  </div>

                  <textarea
                    value={wateringNote}
                    onChange={(event) => setWateringNote(event.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-4 text-base font-medium leading-relaxed text-[var(--earth)] outline-none transition-all placeholder:text-[var(--text-muted)]/65 focus:bg-[var(--surface-strong)] focus:ring-0 sm:text-sm"
	                    placeholder="Opcional: qué viste al volver?"
	                  />

	                  <div className="mt-5 grid grid-cols-1 gap-2">
	                    <button
	                      onClick={() => waterNote(note.id, wateringNote.trim() || 'Riego rápido: sigue viva')}
	                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 py-3 text-sm font-semibold text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
	                    >
	                      <Droplets size={17} /> Sí, regar
	                    </button>
	                    <button
	                      onClick={() => {
	                        setWateringNoteId(null);
	                        openSproutPrompt(note.id);
	                      }}
	                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 py-3 text-sm font-semibold text-[var(--sage)] transition-colors hover:bg-[var(--surface-strong)]"
	                    >
	                      <Sprout size={17} /> Convertir en brote
	                    </button>
	                    <div className="grid grid-cols-3 gap-2">
	                      <button
	                        onClick={() => { togglePauseNote(note.id); recordWateringRitual(); markRecentlyWatered(note.id); setWateringNoteId(null); }}
	                        className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--bg-app)] px-3 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--sage)]"
	                      >
	                        <Pause size={13} /> Pausar
	                      </button>
	                      <button
	                        onClick={() => harvestFromWatering(note.id)}
	                        className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--tone-harvest-bg)] px-3 text-xs font-semibold text-[var(--tone-harvest)] ring-1 ring-[var(--tone-harvest-border)] transition-colors hover:bg-[var(--surface-hover)]"
	                      >
	                        <CheckCircle2 size={13} /> Cosechar
	                      </button>
	                      <button
	                        onClick={() => {
	                          setWateringNoteId(null);
	                          deleteNote(note.id);
	                        }}
	                        className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--tone-danger-bg)] px-3 text-xs font-semibold text-[var(--tone-danger)] ring-1 ring-[var(--tone-danger-border)] transition-colors hover:opacity-85"
	                      >
	                        <Trash2 size={13} /> Soltar
	                      </button>
	                    </div>
	                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <AnimatePresence>
          {celebration && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-3 shadow-2xl backdrop-blur-2xl"
            >
              <Sparkles className="text-[var(--seed-accent)]" size={18} />
              <span className="text-sm font-black text-[var(--earth)]">{celebration}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {flowerReward && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[65] flex items-end justify-center bg-black/20 p-4 backdrop-blur-sm sm:items-center"
              onClick={() => setFlowerReward(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="relative grid h-48 place-items-center bg-[linear-gradient(180deg,var(--tone-harvest-bg),var(--surface-soft))]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_20%_76%,rgba(122,138,105,0.15),transparent_28%),radial-gradient(circle_at_82%_70%,rgba(176,148,98,0.13),transparent_26%)]" />
                  <motion.div
                    initial={{ scale: 0.55, y: 18, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: 'spring', damping: 16, stiffness: 220, delay: 0.08 }}
                    className="relative z-10 grid h-32 w-32 place-items-center rounded-full bg-[var(--surface-strong)]/70 shadow-[0_22px_60px_rgba(47,62,51,0.14)]"
                  >
                    <PlantIllustration stage="bloom" progress={100} isGrowth={false} theme={activePlanet.theme || theme} />
                  </motion.div>
                  <Sparkles className="absolute right-12 top-10 text-[var(--seed-accent)]" size={22} />
                  <Sparkles className="absolute bottom-12 left-12 text-[var(--sage)]" size={18} />
                </div>
                <div className="p-5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Idea cosechada</p>
                  <h3 className="mt-2 font-serif text-3xl font-black leading-tight text-[var(--earth)]">Ciclo cerrado</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
                    “{flowerReward.title}” ya queda guardada. Si te dejó algo, puedes anotarlo en una frase.
                  </p>
                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      onClick={() => {
                        const id = flowerReward.id;
                        setFlowerReward(null);
                        window.setTimeout(() => setHarvestNoteId(id), 120);
                      }}
                      className="rounded-2xl bg-[var(--sage)] px-4 py-3 text-sm font-black text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
                    >
                      Añadir aprendizaje
                    </button>
                    <button
                      onClick={() => {
                        setFlowerReward(null);
                        setFilterStage('all');
                        setSearch('');
                        setView('harvest');
                      }}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3 text-sm font-black text-[var(--sage)] hover:bg-[var(--surface-soft)]"
                    >
                      Ver cosechas
                    </button>
                    <button
                      onClick={() => {
                        setFlowerReward(null);
                        setView('today');
                      }}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3 text-sm font-black text-[var(--sage)] hover:bg-[var(--surface-soft)]"
                    >
                      Seguir
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {harvestNoteId && (() => {
            const note = notes.find(n => n.id === harvestNoteId);
            if (!note) return null;

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[65] bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                onClick={() => setHarvestNoteId(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  className="w-full max-w-lg rounded-[2rem] bg-[var(--surface-strong)] border border-[var(--border)] shadow-2xl p-6"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="relative mb-5 flex h-36 items-center justify-center overflow-hidden rounded-[2rem] border border-[var(--tone-harvest-border)] bg-[linear-gradient(180deg,var(--tone-harvest-bg),var(--surface-soft))]">
                    <div className="seed-card-sheen" />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2.8, repeat: Infinity }}>
                      <PlantIllustration stage="bloom" progress={100} isGrowth />
                    </motion.div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--tone-harvest)]">Aprendizaje opcional</p>
                  <h3 className="mt-2 text-3xl font-serif font-black leading-tight text-[var(--earth)]">{note.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
                    Una frase basta. Si no hay nada que guardar, puedes cerrar y la cosecha se mantiene.
                  </p>
                  <textarea
                    value={note.reflection || ''}
                    onChange={(event) => updateNote(note.id, { reflection: event.target.value, takeaway: event.target.value })}
                    rows={4}
                    className="mt-5 w-full rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-4 text-sm outline-none resize-none focus:bg-[var(--surface-strong)] focus:ring-0 transition-all"
                    placeholder="¿Qué te dejó esta idea?"
                  />
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setHarvestNoteId(null)}
                      className="rounded-2xl bg-[var(--sage)] text-[var(--on-sage)] py-4 font-black shadow-lg shadow-[var(--sage)]/20"
                    >
                      Guardar cierre
                    </button>
                    <button
                      onClick={() => {
                        setHarvestNoteId(null);
                        setView('harvest');
                      }}
                      className="rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] py-4 font-black border border-[var(--border)]"
                    >
                      Ver lo aprendido
                    </button>
                    <button
                      onClick={() => setHarvestNoteId(null)}
                      className="rounded-2xl border border-transparent py-2 text-sm font-black text-[var(--text-muted)] sm:col-span-2"
                    >
                      Ahora no
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[66] flex items-end justify-center bg-black/18 p-0 backdrop-blur-2xl sm:items-center sm:p-4"
              onClick={closeSettings}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="flex h-[92dvh] max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2.25rem] bg-[var(--bg-app)]/96 p-0 shadow-[0_28px_100px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:h-auto sm:max-h-[86vh] sm:rounded-[2.25rem] sm:ring-1 sm:ring-[var(--border)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--text-muted)]/20 sm:hidden" />
                <div className="relative flex shrink-0 items-center justify-center border-b border-[var(--border)] px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
                  {settingsPage !== 'root' && (
                    <button
                      type="button"
                      onClick={() => setSettingsPage('root')}
                      className="absolute left-3 top-2.5 flex h-10 items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-[var(--sage)] transition-colors active:bg-[var(--surface-hover)] sm:left-4 sm:top-3.5 sm:hover:bg-[var(--surface-hover)]"
                      aria-label="Volver a ajustes"
                    >
                      <ChevronLeft size={19} />
                      <span>Atrás</span>
                    </button>
                  )}
                  <h3 className="max-w-[12rem] truncate text-[1.05rem] font-semibold tracking-tight text-[var(--earth)]">{settingsTitles[settingsPage]}</h3>
                  <button onClick={closeSettings} className="absolute right-4 top-3 rounded-full px-2.5 py-2 text-sm font-semibold text-[var(--sage)] transition-colors hover:bg-[var(--surface-hover)] sm:right-5 sm:top-4" aria-label="Cerrar ajustes">
                    Listo
                  </button>
                </div>

                <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 app-scrollbar sm:px-6 sm:pb-6">
                  <AnimatePresence mode="wait" initial={false}>
                    {settingsPage === 'root' && (
                      <motion.div
                        key="settings-root"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        <section className="overflow-hidden rounded-[1.85rem] bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-soft))] shadow-sm ring-1 ring-[var(--border)]">
                          <button
                            type="button"
                            onClick={() => setSettingsPage('profile')}
                            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors active:bg-[var(--surface-hover)] sm:px-5 sm:hover:bg-[var(--surface-hover)]"
                          >
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--sage)] text-xl font-semibold text-[var(--on-sage)] shadow-sm">
                              {accountInitials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-xl font-semibold tracking-tight text-[var(--earth)]">{account.name || 'Tu jardín'}</h4>
                              <p className="mt-0.5 truncate text-sm font-medium text-[var(--text-muted)]">{session?.user?.email || account.email || 'Sin sesión en la nube'}</p>
                            </div>
                            <ChevronRight size={18} className="shrink-0 text-[var(--text-muted)]/65" />
                          </button>
                          <div className="grid grid-cols-4 border-t border-[var(--border)] bg-[var(--surface-strong)]/42">
                            {[
                              { label: 'Ideas', value: notes.length },
                              { label: t('sprouts'), value: profileStats.active },
                              { label: 'Racha', value: wateringRitual.streak },
                              { label: 'Min', value: profileStats.totalFocus },
                            ].map(item => (
                              <div key={item.label} className="border-r border-[var(--border)] px-2 py-3 text-center last:border-r-0">
                                <p className="text-lg font-semibold text-[var(--earth)]">{item.value}</p>
                                <p className="mt-0.5 truncate text-[9px] font-medium text-[var(--text-muted)]">{item.label}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        {renderSettingsSection('Seed', settingsRows.map(renderSettingsNavRow))}

                        {renderSettingsSection('Ayuda', (
                          <button
                            type="button"
                            onClick={() => {
                              closeSettings();
                              setOnboardingStep(0);
                              setShowOnboarding(true);
                            }}
                            className="flex min-h-[4rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--surface-hover)] sm:hover:bg-[var(--surface-hover)]"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                              <Sparkles size={17} strokeWidth={2.2} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-semibold text-[var(--earth)]">Ver guía inicial</span>
                              <span className="mt-0.5 block truncate text-xs font-medium text-[var(--text-muted)]">Plantar, regar y cosechar en 3 pasos</span>
                            </span>
                            <ChevronRight size={17} className="shrink-0 text-[var(--text-muted)]/65" />
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {settingsPage === 'profile' && (
                      <motion.div
                        key="settings-profile"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        {renderSettingsSection('Identidad', (
                          <>
                            <label className="flex min-h-14 items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
                              <span className="w-24 shrink-0 text-sm font-medium text-[var(--text-muted)]">Nombre</span>
                              <input
                                value={account.name}
                                onChange={(event) => setAccount(current => ({ ...current, name: event.target.value }))}
                                className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/60"
                                placeholder="Tu nombre"
                              />
                            </label>
                            <label className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                              <span className="w-24 shrink-0 text-sm font-medium text-[var(--text-muted)]">Rol</span>
                              <input
                                value={account.role}
                                onChange={(event) => setAccount(current => ({ ...current, role: event.target.value }))}
                                className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/60"
                                placeholder="Creador, estudiante..."
                              />
                            </label>
                          </>
                        ))}

                        {renderSettingsSection('Uso', (
                          <div className="space-y-4 px-4 py-4">
                            <div>
                              <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Uso principal</p>
                              <AppSelect
                                value={account.purpose || 'Ideas personales'}
                                onChange={(value) => setAccount(current => ({ ...current, purpose: value }))}
                                ariaLabel="Uso principal"
                                options={PROFILE_PURPOSE_OPTIONS}
                              />
                            </div>
                            <label className="block">
                              <span className="text-sm font-medium text-[var(--text-muted)]">Estoy cultivando</span>
                              <textarea
                                value={account.mantra || ''}
                                onChange={(event) => setAccount(current => ({ ...current, mantra: event.target.value }))}
                                rows={4}
                                className="mt-2 w-full resize-none rounded-2xl bg-[var(--bg-app)] px-3 py-3 text-sm font-medium leading-relaxed text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/60"
                                placeholder="Ideas para crear una vida más tranquila..."
                              />
                            </label>
                          </div>
                        ))}
                      </motion.div>
                    )}

                    {settingsPage === 'appearance' && (
                      <motion.div
                        key="settings-appearance"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        {renderSettingsSection('Jardín actual', (
                          <div className="space-y-3 px-4 py-4">
                            <p className="text-sm font-medium leading-relaxed text-[var(--text-muted)]">Cambia el ambiente solo para {activePlanet.name}. El resto de jardines conserva su propia sensación.</p>
                            <AppSelect
                              value={activePlanet.theme || theme}
                              onChange={(value) => {
                                const selectedTheme = value as Theme;
                                setTheme(selectedTheme);
                                setPlanets(current => current.map(planet => planet.id === activePlanet.id ? touchPlanet({ ...planet, theme: selectedTheme }) : planet));
                              }}
                              ariaLabel="Ecosistema del jardín actual"
                              options={THEME_SELECT_OPTIONS}
                            />
                          </div>
                        ))}

                        {renderSettingsSection('Interacciones', (
                          <>
                            <div className="flex min-h-14 items-center gap-3 border-b border-[var(--border)] px-4 py-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                                <Sparkles size={16} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[var(--earth)]">Haptics</p>
                                <p className="truncate text-xs font-medium text-[var(--text-muted)]">Vibración sutil en acciones importantes</p>
                              </div>
                              <AppSwitch
                                checked={hapticsEnabled}
                                onChange={(checked) => {
                                  setHapticsEnabled(checked);
                                  if (checked) window.setTimeout(() => feel('open', true), 0);
                                }}
                                ariaLabel={hapticsEnabled ? 'Desactivar haptics' : 'Activar haptics'}
                              />
                            </div>
                            <div className="flex min-h-14 items-center gap-3 px-4 py-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                                <Droplets size={16} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[var(--earth)]">Sonidos suaves</p>
                                <p className="truncate text-xs font-medium text-[var(--text-muted)]">Pop al plantar, gota al regar y bloom al cosechar</p>
                              </div>
                              <AppSwitch
                                checked={soundsEnabled}
                                onChange={(checked) => {
                                  setSoundsEnabled(checked);
                                  if (checked) playMicroSound('pop', true);
                                }}
                                ariaLabel={soundsEnabled ? 'Desactivar sonidos' : 'Activar sonidos'}
                              />
                            </div>
                          </>
                        ))}
                      </motion.div>
                    )}

                    {settingsPage === 'today' && (
                      <motion.div
                        key="settings-today"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        <p className="px-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">Elige solo lo que ayuda a comenzar el día. Seed mantiene Hoy ligero aunque actives varios módulos.</p>
                        {renderSettingsSection('Módulos', (
                          <>
                            {[
                              { id: 'summary' as const, icon: LayoutGrid, title: 'Resumen', detail: 'Semillas, brotes y cierres' },
                              { id: 'watering' as const, icon: Droplets, title: 'Riego', detail: 'Ideas que conviene revisar' },
                              { id: 'learning' as const, icon: Archive, title: 'Lo aprendido', detail: 'Último cierre guardado' },
                              { id: 'path' as const, icon: CalendarIcon, title: t('path'), detail: 'Acceso al calendario' },
                            ].map(item => (
                              <div key={item.id} className="flex min-h-14 items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                                  <item.icon size={16} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-[var(--earth)]">{item.title}</p>
                                  <p className="truncate text-xs font-medium text-[var(--text-muted)]">{item.detail}</p>
                                </div>
                                <AppSwitch
                                  checked={todayWidgets.includes(item.id)}
                                  onChange={(checked) => toggleTodayWidget(item.id, checked)}
                                  ariaLabel={`${todayWidgets.includes(item.id) ? 'Ocultar' : 'Mostrar'} ${item.title} en Hoy`}
                                />
                              </div>
                            ))}
                          </>
                        ))}
                      </motion.div>
                    )}

                    {settingsPage === 'watering' && (
                      <motion.div
                        key="settings-watering"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        {renderSettingsSection('Ritmo', (
                          <div className="space-y-4 px-4 py-4">
                            <div>
                              <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Riego por defecto</p>
                              <AppSelect
                                value={String(defaultWateringInterval)}
                                onChange={(value) => setDefaultWateringInterval(Number(value))}
                                ariaLabel="Riego por defecto"
                                options={WATERING_INTERVAL_OPTIONS}
                              />
                            </div>
                            <label className="flex min-h-12 items-center justify-between gap-3">
                              <span>
                                <span className="block text-sm font-semibold text-[var(--earth)]">Hora de recordatorio</span>
                                <span className="block text-xs font-medium text-[var(--text-muted)]">Aviso suave, sin presión</span>
                              </span>
                              <input
                                type="time"
                                value={`${String(reminderHour).padStart(2, '0')}:00`}
                                onChange={(event) => {
                                  const hour = Number(event.target.value.split(':')[0]);
                                  setReminderHour(Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : reminderHour);
                                }}
                                className="bg-transparent text-right text-sm font-semibold text-[var(--earth)] outline-none"
                              />
                            </label>
                          </div>
                        ))}

                        {renderSettingsSection('Recordatorios', (
                          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                              <Clock size={16} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--earth)]">Activar avisos</p>
                              <p className="truncate text-xs font-medium text-[var(--text-muted)]">Seed te recuerda revisar ideas vivas</p>
                            </div>
                            <AppSwitch
                              checked={notificationsEnabled}
                              onChange={(checked) => checked ? enableNotifications() : setNotificationsEnabled(false)}
                              ariaLabel={notificationsEnabled ? 'Desactivar recordatorios' : 'Activar recordatorios'}
                            />
                          </div>
                        ))}
                      </motion.div>
                    )}

                    {settingsPage === 'data' && (
                      <motion.div
                        key="settings-data"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        {renderSettingsSection('Cuenta', (
                          <div className="px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[var(--earth)]">{session?.user ? 'Cuenta conectada' : 'Modo local'}</p>
                                <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                                  {session?.user ? session.user.email : 'Inicia sesión solo si quieres llevar tus semillas a otros dispositivos.'}
                                </p>
                              </div>
                              {session?.user && (
                                <button onClick={signOut} className="shrink-0 rounded-full bg-[var(--bg-app)] px-3 py-2 text-xs font-semibold text-[var(--sage)] ring-1 ring-[var(--border)]">
                                  Salir
                                </button>
                              )}
                            </div>

                            {!session?.user ? (
                              <div className="mt-4 space-y-2">
                                <input
                                  type="email"
                                  value={authEmail}
                                  onChange={(event) => setAuthEmail(event.target.value)}
                                  placeholder="correo@email.com"
                                  className="h-11 w-full rounded-2xl bg-[var(--bg-app)] px-3 text-sm outline-none focus:ring-0"
                                />
                                <input
                                  type="password"
                                  value={authPassword}
                                  onChange={(event) => setAuthPassword(event.target.value)}
                                  placeholder="Contraseña"
                                  className="h-11 w-full rounded-2xl bg-[var(--bg-app)] px-3 text-sm outline-none focus:ring-0"
                                />
                                <input
                                  type="password"
                                  value={authConfirmPassword}
                                  onChange={(event) => setAuthConfirmPassword(event.target.value)}
                                  placeholder="Confirmar contraseña"
                                  className="h-11 w-full rounded-2xl bg-[var(--bg-app)] px-3 text-sm outline-none focus:ring-0"
                                />
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <button
                                    onClick={signInWithEmail}
                                    disabled={Boolean(authDisabledReason)}
                                    className="h-11 rounded-full bg-[var(--sage)] text-sm font-semibold text-[var(--on-sage)] disabled:opacity-40"
                                  >
                                    Entrar
                                  </button>
                                  <button
                                    onClick={signUpWithEmail}
                                    disabled={Boolean(authDisabledReason)}
                                    className="h-11 rounded-full bg-[var(--bg-app)] text-sm font-semibold text-[var(--sage)] ring-1 ring-[var(--border)] disabled:opacity-40"
                                  >
                                    Crear cuenta
                                  </button>
                                </div>
                                {authDisabledReason && (
                                  <p className="text-xs font-medium text-[var(--text-muted)]">{authDisabledReason}</p>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={syncGarden}
                                disabled={isSyncing}
                                className="mt-4 h-11 w-full rounded-full bg-[var(--sage)] text-sm font-semibold text-[var(--on-sage)] disabled:opacity-50"
                              >
                                {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                              </button>
                            )}

                            {(authStatus || syncStatus) && (
                              <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">{syncStatus || authStatus}</p>
                            )}
                          </div>
                        ))}

                        {renderSettingsSection('Backups', (
                          <>
                            {[
                              { label: 'Exportar Markdown', icon: Download, onClick: exportGarden },
                              { label: 'Exportar backup', icon: Download, onClick: exportBackup },
                              { label: 'Importar backup', icon: Archive, onClick: () => importInputRef.current?.click() },
                            ].map(item => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={item.onClick}
                                className="flex min-h-12 w-full items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-hover)]"
                              >
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                                  <item.icon size={15} />
                                </span>
                                <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--earth)]">{item.label}</span>
                                <ChevronRight size={15} className="text-[var(--text-muted)]" />
                              </button>
                            ))}
                          </>
                        ))}

                        {renderSettingsSection('Zona sensible', (
                          <button onClick={clearGardenData} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-[var(--tone-danger)] transition-colors hover:bg-[var(--tone-danger-bg)]">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--tone-danger-bg)] text-[var(--tone-danger)]">
                              <Trash2 size={15} />
                            </span>
                            <span className="min-w-0 flex-1">Borrar datos locales</span>
                            <ChevronRight size={15} className="text-[var(--tone-danger)] opacity-55" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) importBackup(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showOnboarding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md sm:items-center sm:p-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 360, damping: 34 }}
                className="flex max-h-[min(88vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-white/55 bg-[var(--surface-strong)] shadow-[0_24px_90px_rgba(20,30,24,0.28)] sm:max-w-2xl"
              >
                {(() => {
                  const step = ONBOARDING_STEPS[onboardingStep] || ONBOARDING_STEPS[0];
                  const StepIcon = step.icon;
                  const isLastStep = onboardingStep === ONBOARDING_STEPS.length - 1;

                  return (
                    <>
                      <div className="relative shrink-0 border-b border-[var(--border)] bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-soft))] px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_0%,rgba(255,255,255,0.82),transparent_30%),radial-gradient(circle_at_4%_100%,rgba(122,169,92,0.16),transparent_34%)]" />
                        <div className="relative">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--seed-accent)]">Primer recorrido</p>
                              <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--earth)] sm:text-3xl">
                                Planta. Riega. Cosecha.
                              </h2>
                            </div>
                            <button
                              onClick={finishOnboarding}
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-[var(--text-muted)] shadow-sm transition-colors hover:text-[var(--earth)]"
                              aria-label="Cerrar guía"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="mt-4 flex items-center gap-2">
                            {ONBOARDING_STEPS.map((item, index) => (
                              <button
                                key={item.title}
                                onClick={() => setOnboardingStep(index)}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${index <= onboardingStep ? 'bg-[var(--sage)]' : 'bg-[var(--border)]'}`}
                                aria-label={`Ver paso ${index + 1}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 app-scrollbar sm:px-6 sm:py-6">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={step.title}
                            initial={{ opacity: 0, x: 18 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -18 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-4"
                          >
                            <div className="rounded-[1.8rem] bg-[var(--bg-app)] p-4 shadow-sm ring-1 ring-[var(--border)] sm:p-5">
                              <div className="flex items-start gap-4">
                                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--sage)] text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20">
                                  <StepIcon size={22} />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--seed-accent)]">
                                    Paso {onboardingStep + 1} de {ONBOARDING_STEPS.length} · {step.eyebrow}
                                  </p>
                                  <h3 className="mt-1 text-3xl font-black leading-tight tracking-tight text-[var(--earth)] sm:text-4xl">{step.title}</h3>
                                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">{step.text}</p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 items-center gap-2 rounded-[1.5rem] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border)]">
                              {[
                                { label: 'Plantar', icon: Leaf, active: onboardingStep >= 0 },
                                { label: 'Regar', icon: Droplets, active: onboardingStep >= 1 },
                                { label: 'Cosechar', icon: CheckCircle2, active: onboardingStep >= 2 },
                              ].map((item) => {
                                const ItemIcon = item.icon;
                                return (
                                  <div key={item.label} className={`rounded-2xl px-2 py-3 text-center transition-colors ${item.active ? 'bg-[var(--surface-strong)] text-[var(--earth)] shadow-sm' : 'text-[var(--text-muted)]/45'}`}>
                                    <ItemIcon size={18} className="mx-auto" />
                                    <p className="mt-2 truncate text-[11px] font-black">{item.label}</p>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="rounded-[1.4rem] bg-[var(--surface-strong)] px-4 py-3">
                              <p className="text-sm font-black leading-snug text-[var(--sage)]">{step.action}</p>
                              <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">{step.detail}</p>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-strong)] px-5 py-3 sm:px-6">
                        <div className="grid grid-cols-[auto_1fr] gap-3">
                          <button
                            onClick={() => setOnboardingStep(value => Math.max(0, value - 1))}
                            disabled={onboardingStep === 0}
                            className="min-h-12 rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] px-4 font-black text-[var(--sage)] transition-opacity disabled:opacity-35"
                          >
                            Atrás
                          </button>
                          <button
                            onClick={() => {
                              if (isLastStep) {
                                finishOnboarding();
                                startPlanting();
                                return;
                              }
                              setOnboardingStep(value => Math.min(ONBOARDING_STEPS.length - 1, value + 1));
                            }}
                            className="min-h-12 rounded-2xl bg-[var(--sage)] px-5 font-black text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
                          >
                            {isLastStep ? 'Plantar semilla' : 'Siguiente'}
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            finishOnboarding();
                            setView('3D');
                          }}
                          className="mt-2 min-h-10 w-full rounded-2xl text-sm font-black text-[var(--text-muted)] transition-colors hover:text-[var(--earth)]"
                        >
                          Ver mi jardín primero
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

	        <AnimatePresence>
	          {isAdding && (
		            <motion.div
		              ref={quickEntryOverlayRef}
		              className="quick-entry-overlay fixed inset-0 z-[70] overflow-hidden text-[var(--text-main)]"
	              initial={{ opacity: 0 }}
	              animate={{ opacity: 1 }}
	              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={closeQuickEntry}
	            >
	              <div className={`absolute inset-0 ${quickEntryKeyboardMode ? 'bg-black/24 backdrop-blur-xl' : 'bg-black/10 backdrop-blur-md'}`} />
	              <div
	                className={`absolute inset-x-0 flex justify-center px-3 sm:p-5 ${
	                  quickEntryKeyboardMode
	                    ? 'items-end pb-0 pt-2'
	                    : 'inset-y-0 items-center py-[calc(env(safe-area-inset-top)+0.8rem)]'
	                }`}
	                style={quickEntryViewportStyle}
	              >
	              <motion.div
		                className={`relative flex w-full max-w-lg flex-col overflow-hidden border border-white/45 bg-[var(--surface-strong)]/96 shadow-[0_26px_90px_rgba(0,0,0,0.18)] backdrop-blur-2xl ${
		                  quickEntryKeyboardMode
		                    ? 'quick-entry-keyboard max-h-full min-h-[17.5rem] rounded-t-[1.85rem] rounded-b-[1.25rem]'
		                    : 'h-[min(54dvh,28rem)] min-h-[22.5rem] rounded-[2.15rem]'
		                }`}
		                style={quickEntryKeyboardMode
		                  ? { height: `min(22.5rem, calc(${Math.max(300, Math.round(quickEntryViewport.height))}px - 0.5rem))` }
			                  : undefined}
	                initial={{ y: 10, scale: 0.965, opacity: 0 }}
	                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 8, scale: 0.975, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 560, damping: 44, mass: 0.68 }}
                drag={quickEntryKeyboardMode || (createMode === 'sprout' && showProjectTodos) ? false : 'y'}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.14}
                dragDirectionLock
                onDragEnd={(_, info) => {
                  if (!quickEntryKeyboardMode && !(createMode === 'sprout' && showProjectTodos) && info.offset.y > 78) {
                    closeQuickEntry();
                  }
                }}
                onClick={(event) => event.stopPropagation()}
              >
	                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,var(--bg-app)_0%,transparent_82%)] opacity-55" />
	                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/70" />
	                <div className={`relative mx-auto h-1 w-10 rounded-full bg-[var(--border)]/75 sm:hidden ${quickEntryKeyboardMode ? 'mt-2' : 'mt-3'}`} />
	                <div className={`relative z-10 flex shrink-0 items-center border-b border-[var(--border)]/55 px-4 sm:px-5 ${
	                  quickEntryKeyboardMode ? 'h-14' : 'h-[4.85rem] pt-1'
	                }`}>
                  <button
                    type="button"
                    onClick={() => {
                      closeQuickEntry();
                    }}
                    className="absolute left-4 top-1/2 z-10 h-9 -translate-y-1/2 rounded-full text-left text-[15px] font-semibold text-[var(--sage)]"
                  >
                    {t('cancel')}
                  </button>
	                  <div className="pointer-events-none absolute inset-x-24 top-1/2 min-w-0 -translate-y-1/2 text-center">
	                    <p className="truncate text-[16px] font-semibold leading-5 text-[var(--earth)]">
	                      {quickEntryCopy.title}
	                    </p>
	                    <p className={`mt-1 truncate text-[11px] font-medium text-[var(--text-muted)] ${quickEntryKeyboardMode ? 'hidden' : 'block'}`}>
	                      {quickEntryCopy.subtitle}
	                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addNote}
                    disabled={!newNote.title.trim() && !newNote.content.trim()}
                    className={`absolute right-4 top-1/2 z-10 h-9 -translate-y-1/2 rounded-full text-right text-[15px] font-semibold transition-colors disabled:opacity-35 ${
                      newNote.title.trim() || newNote.content.trim() ? 'text-[var(--sage)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {quickEntryCopy.action}
                  </button>
                </div>

	                <div className={`relative z-10 flex min-h-0 flex-1 flex-col px-5 sm:px-6 ${quickEntryKeyboardMode ? 'pt-3' : 'pt-5'}`}>
	                  {createMode === 'seed' ? (
	                    <div className="flex min-h-0 flex-1 flex-col">
	                      <div className={`flex shrink-0 items-center gap-3 ${quickEntryKeyboardMode ? 'mb-2' : 'mb-4'}`}>
	                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--sage)]">
	                          <Leaf size={17} />
	                        </span>
	                        <div className="min-w-0">
	                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
	                            {appLanguage === 'en' ? 'One field capture' : 'Captura en un solo campo'}
	                          </p>
	                          <p className="mt-0.5 truncate text-sm font-medium text-[var(--earth)]">
	                            {appLanguage === 'en' ? 'First line becomes the title.' : 'La primera línea será el título.'}
	                          </p>
	                        </div>
	                      </div>
	                      <textarea
	                        inputMode="text"
	                        autoCapitalize="sentences"
	                        autoComplete="off"
	                        spellCheck
	                        data-quick-entry-autofocus="true"
	                        onFocus={() => setQuickEntryPicker(null)}
	                        placeholder={quickEntryCopy.placeholder}
	                        rows={6}
	                        value={newNote.content}
	                        onChange={(event) => setNewNote({ ...newNote, title: '', content: event.target.value })}
	                        enterKeyHint="done"
	                        onKeyDown={(event) => {
	                          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
	                            addNote();
	                          }
	                        }}
	                        className="quick-seed-textarea min-h-0 flex-1 resize-none bg-transparent text-[1.32rem] font-medium leading-[1.42] tracking-normal text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/40 sm:text-[1.42rem]"
	                      />
	                    </div>
	                  ) : (
	                    <>
	                      <div className={`flex shrink-0 items-center gap-3 ${quickEntryKeyboardMode ? 'mb-2' : 'mb-4'}`}>
	                        {createMode === 'journal' && (
	                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--sage)]">
	                            <Sparkles size={16} />
	                          </span>
	                        )}
	                        <input
	                          type="text"
	                          inputMode="text"
	                          autoCapitalize="sentences"
	                          autoComplete="off"
	                          spellCheck
	                          data-quick-entry-autofocus={createMode === 'sprout' ? 'true' : undefined}
	                          onFocus={() => setQuickEntryPicker(null)}
	                          placeholder={quickEntryCopy.titlePlaceholder}
	                          value={newNote.title}
	                          onChange={(event) => setNewNote({ ...newNote, title: event.target.value })}
	                          className="quick-entry-title-input min-w-0 flex-1 bg-transparent text-[1.55rem] font-medium leading-none tracking-normal text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/44 sm:text-[1.75rem]"
	                        />
	                      </div>

	                      <div className="relative min-h-0 flex-1">
	                        {createMode === 'sprout' && showProjectTodos ? (
	                          <div data-project-todo-list className="h-full min-h-0 overscroll-contain overflow-y-auto rounded-[1.25rem] bg-[var(--bg-app)]/45 p-2 app-scrollbar">
	                            <DndContext sensors={projectTodoSensors} collisionDetection={closestCenter} onDragEnd={handleProjectTodoDragEnd}>
	                              <SortableContext items={projectTodos.map(todo => todo.id)} strategy={verticalListSortingStrategy}>
	                                <div className="grid gap-1.5">
	                                  {projectTodos.map((todo, index) => (
	                                    <ProjectTodoDraftRow
	                                      key={todo.id}
	                                      todo={todo}
	                                      index={index}
	                                      total={projectTodos.length}
	                                      appLanguage={appLanguage}
	                                      onToggle={toggleProjectTodo}
	                                      onChange={updateProjectTodo}
	                                      onEnter={addProjectTodoAfter}
	                                      onRemove={removeProjectTodo}
	                                      onFocus={() => setQuickEntryPicker(null)}
	                                    />
	                                  ))}
	                                </div>
	                              </SortableContext>
	                            </DndContext>
	                            <button
	                              type="button"
	                              onClick={() => addProjectTodoAfter()}
	                              className="mt-2 flex h-10 w-full items-center justify-center rounded-2xl text-sm font-semibold text-[var(--sage)] transition-colors hover:bg-[var(--surface-strong)]"
	                            >
	                              {appLanguage === 'en' ? 'Add step' : 'Agregar paso'}
	                            </button>
	                          </div>
	                        ) : (
	                          <textarea
	                            inputMode="text"
	                            autoCapitalize="sentences"
	                            autoComplete="off"
	                            spellCheck
	                            data-quick-entry-autofocus={createMode !== 'sprout' ? 'true' : undefined}
	                            onFocus={() => setQuickEntryPicker(null)}
	                            placeholder={createMode === 'sprout'
	                              ? quickEntryCopy.placeholder
	                              : newNote.title
	                                ? (appLanguage === 'en' ? 'Notes' : 'Notas')
	                                : quickEntryCopy.placeholder}
	                            rows={5}
	                            value={newNote.content}
	                            onChange={(event) => setNewNote({ ...newNote, content: event.target.value })}
	                            enterKeyHint="done"
	                            onKeyDown={(event) => {
	                              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
	                                addNote();
	                              }
	                            }}
	                            className="quick-seed-textarea h-full min-h-0 w-full resize-none bg-transparent text-[1.12rem] font-medium leading-[1.5] tracking-normal text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/42 sm:text-[1.22rem]"
	                          />
	                        )}
	                      </div>
	                    </>
	                  )}

		                  <div className={`relative mb-3 flex shrink-0 flex-col gap-2 rounded-[1.35rem] bg-[var(--bg-app)]/62 p-2 shadow-[inset_0_0_0_1px_var(--border)] ${quickEntryKeyboardMode ? 'mt-1' : 'mt-4'}`}>
		                    <AnimatePresence>
		                      {quickEntryPicker && (
		                        <motion.div
		                          key={quickEntryPicker}
		                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
		                          animate={{ opacity: 1, y: 0, scale: 1 }}
		                          exit={{ opacity: 0, y: 6, scale: 0.98 }}
		                          transition={{ duration: 0.16 }}
		                          className="absolute bottom-[calc(100%+0.45rem)] left-2 right-2 z-30 max-h-56 overflow-y-auto rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-strong)]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-2xl app-scrollbar"
		                        >
		                          {quickEntryPicker === 'type' && (
		                            <div className="grid gap-1">
		                              {SEED_TYPES.map(type => (
		                                <button
		                                  key={type.id}
		                                  type="button"
		                                  onClick={() => {
		                                    setNewNote({ ...newNote, seedType: type.id });
		                                    setQuickEntryPicker(null);
		                                  }}
		                                  className={`flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold transition-colors ${
		                                    newNote.seedType === type.id
		                                      ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--earth)]'
		                                  }`}
		                                >
		                                  {type.label}
		                                  {newNote.seedType === type.id && <CheckCircle2 size={15} />}
		                                </button>
		                              ))}
		                            </div>
		                          )}
		                          {quickEntryPicker === 'priority' && (
		                            <div className="grid gap-1">
		                              {PRIORITY_OPTIONS.map(option => (
		                                <button
		                                  key={option.id}
		                                  type="button"
		                                  onClick={() => {
		                                    setNewNote({ ...newNote, priority: option.id });
		                                    setQuickEntryPicker(null);
		                                  }}
		                                  className={`flex h-12 w-full items-center justify-between rounded-xl px-3 text-left transition-colors ${
		                                    newNote.priority === option.id
		                                      ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                                      : 'text-[var(--earth)] hover:bg-[var(--bg-app)]'
		                                  }`}
		                                >
		                                  <span className="min-w-0">
		                                    <span className="block truncate text-sm font-semibold">{priorityLabel(option)}</span>
		                                    <span className={`mt-0.5 block truncate text-[10px] font-medium ${newNote.priority === option.id ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{priorityDetail(option)}</span>
		                                  </span>
		                                  {newNote.priority === option.id && <CheckCircle2 size={15} className="shrink-0" />}
		                                </button>
		                              ))}
		                            </div>
		                          )}
		                          {quickEntryPicker === 'garden' && (
		                            <div className="grid gap-1">
		                              {planets.map(planet => (
		                                <button
		                                  key={planet.id}
		                                  type="button"
		                                  onClick={() => {
		                                    setNewNote({ ...newNote, planetId: planet.id });
		                                    setQuickEntryPicker(null);
		                                  }}
		                                  className={`flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold transition-colors ${
		                                    newNote.planetId === planet.id
		                                      ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--earth)]'
		                                  }`}
		                                >
		                                  <span className="min-w-0 truncate">{planet.name}</span>
		                                  {newNote.planetId === planet.id && <CheckCircle2 size={15} className="shrink-0" />}
		                                </button>
		                              ))}
		                            </div>
		                          )}
		                        </motion.div>
		                      )}
		                    </AnimatePresence>
		                    <div className="flex min-h-10 items-center gap-2">
		                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-strong)] text-[var(--sage)]">
		                        {createMode === 'sprout' ? <Sprout size={15} /> : createMode === 'journal' ? <Sparkles size={15} /> : <Leaf size={15} />}
		                      </span>
		                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-muted)]">
		                        {newNote.dueDate
		                          ? `${formatShortDate(dateInputToEndOfDay(newNote.dueDate) || new Date().getTime())} · ${priorityLabel(quickEntryPriority)}`
		                          : `${createMode === 'seed' ? quickEntryTypeLabel : quickEntryCopy.compactLabel} · ${quickEntryPlanet.name}`}
		                      </span>
		                      <button
		                        type="button"
		                        onClick={() => {
		                          setShowQuickEntryDetails(value => !value);
		                          setQuickEntryPicker(null);
		                        }}
		                        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
		                          showQuickEntryDetails
		                            ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                            : 'bg-[var(--surface-strong)] text-[var(--sage)]'
		                        }`}
		                      >
		                        {quickEntryCopy.details}
		                        <ChevronDown size={13} className={`transition-transform ${showQuickEntryDetails ? 'rotate-180' : ''}`} />
		                      </button>
		                    </div>

		                    <AnimatePresence initial={false}>
		                      {showQuickEntryDetails && (
		                        <motion.div
		                          initial={{ opacity: 0, height: 0 }}
		                          animate={{ opacity: 1, height: 'auto' }}
		                          exit={{ opacity: 0, height: 0 }}
		                          className="overflow-hidden"
		                        >
		                          <div className="grid grid-cols-5 gap-1.5 border-t border-[var(--border)] pt-2">
		                            <label className={`relative grid h-9 place-items-center rounded-full transition-colors ${
		                              newNote.dueDate ? 'bg-[var(--sage)] text-[var(--on-sage)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--sage)]'
		                            }`} aria-label={t('date')}>
		                              <CalendarIcon size={17} />
		                              <input
		                                type="date"
		                                value={newNote.dueDate}
		                                onChange={(event) => {
		                                  setNewNote({ ...newNote, dueDate: event.target.value });
		                                  setQuickEntryPicker(null);
		                                }}
		                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
		                              />
		                            </label>

		                            {createMode === 'seed' ? (
		                              <button
		                                type="button"
		                                onClick={() => setQuickEntryPicker(current => current === 'type' ? null : 'type')}
		                                className={`grid h-9 place-items-center rounded-full transition-colors ${
		                                  quickEntryPicker === 'type'
		                                    ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--sage)]'
		                                }`}
		                                aria-label={appLanguage === 'en' ? 'Seed type' : 'Tipo de semilla'}
		                                aria-expanded={quickEntryPicker === 'type'}
		                              >
		                                <Tag size={17} />
		                              </button>
		                            ) : (
		                              <span className="grid h-9 place-items-center rounded-full text-[var(--text-muted)]">
		                                {createMode === 'sprout' ? <ListChecks size={17} /> : <Sparkles size={17} />}
		                              </span>
		                            )}

		                            <button
		                              type="button"
		                              onClick={() => {
		                                setQuickEntryPicker(current => current === 'priority' ? null : 'priority');
		                              }}
		                              className={`grid h-9 place-items-center rounded-full transition-colors ${
		                                newNote.priority === 'important'
		                                  ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                                  : quickEntryPicker === 'priority'
		                                    ? 'bg-[var(--surface-strong)] text-[var(--sage)]'
		                                    : newNote.priority === 'light'
		                                    ? 'bg-[var(--surface-strong)] text-[var(--text-muted)]'
		                                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--sage)]'
		                              }`}
		                              aria-label={appLanguage === 'en' ? 'Priority' : 'Prioridad'}
		                              aria-expanded={quickEntryPicker === 'priority'}
		                            >
		                              <Star size={17} />
		                            </button>

		                            {planets.length > 1 ? (
		                              <button
		                                type="button"
		                                onClick={() => setQuickEntryPicker(current => current === 'garden' ? null : 'garden')}
		                                className={`grid h-9 place-items-center rounded-full transition-colors ${
		                                  quickEntryPicker === 'garden'
		                                    ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--sage)]'
		                                }`}
		                                aria-label={appLanguage === 'en' ? 'Garden' : 'Jardín'}
		                                aria-expanded={quickEntryPicker === 'garden'}
		                              >
		                                <Box size={17} />
		                              </button>
		                            ) : (
		                              <span className="grid h-9 place-items-center rounded-full text-[var(--text-muted)]">
		                                <Box size={17} />
		                              </span>
		                            )}

		                            {createMode === 'sprout' ? (
		                              <button
		                                type="button"
		                                onClick={() => {
		                                  setShowProjectTodos(value => {
		                                    const nextValue = !value;
		                                    if (nextValue) {
		                                      const nextTodos = buildProjectTodosFromContent();
		                                      setProjectTodos(nextTodos);
		                                    setNewNote(current => ({
		                                        ...current,
		                                        content: nextTodos.map(todo => todo.text).join('\n'),
		                                      }));
		                                    }
		                                    return nextValue;
		                                  });
		                                  setQuickEntryPicker(null);
		                                }}
		                                className={`grid h-9 place-items-center rounded-full transition-colors ${
		                                  showProjectTodos
		                                    ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--sage)]'
		                                }`}
		                                aria-label={appLanguage === 'en' ? 'Show checklist circles' : 'Mostrar círculos de pasos'}
		                                aria-pressed={showProjectTodos}
		                              >
		                                <ListChecks size={17} />
		                              </button>
		                            ) : createMode === 'seed' ? (
		                              <button
		                                type="button"
		                                onClick={() => {
		                                  setCreateMode('sprout');
		                                  setNewNote({ ...newNote, seedType: 'project' });
		                                  setShowProjectTodos(false);
		                                  setQuickEntryPicker(null);
		                                }}
		                                className={`grid h-9 place-items-center rounded-full transition-colors ${
		                                  'text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--sage)]'
		                                }`}
		                                aria-label="Convertir en brote"
		                              >
		                                <ListChecks size={17} />
		                              </button>
		                            ) : (
		                              <span className="grid h-9 place-items-center rounded-full text-[var(--text-muted)]">
		                                <Sparkles size={17} />
		                              </span>
		                            )}
		                          </div>
		                          <button
		                            type="button"
		                            onClick={() => {
		                              setNewNote({ ...newNote, dueDate: newNote.dueDate === quickEntryToday ? '' : quickEntryToday });
		                              setQuickEntryPicker(null);
		                            }}
		                            className={`mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold transition-colors ${
		                              newNote.dueDate === quickEntryToday
		                                ? 'bg-[var(--sage)] text-[var(--on-sage)]'
		                                : 'bg-[var(--surface-strong)] text-[var(--text-muted)] hover:text-[var(--sage)]'
		                            }`}
		                          >
		                            <Flag size={14} />
		                            {newNote.dueDate === quickEntryToday
		                              ? appLanguage === 'en' ? 'Planned for today' : 'Para hoy'
		                              : appLanguage === 'en' ? 'Use today if this matters now' : 'Marcar para hoy si importa ahora'}
		                          </button>
		                        </motion.div>
		                      )}
		                    </AnimatePresence>
		                  </div>
                </div>

                <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
              </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Button */}
        {!isAdding && view !== 'focus' && !showGardenFullscreen && (
          <>
            <AnimatePresence>
              {showCreateMenu && (
                <>
                  <motion.button
                    type="button"
                    aria-label="Cerrar opciones de creación"
                    className="fixed inset-0 z-40 bg-black/[0.03] backdrop-blur-[2px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    onClick={() => setShowCreateMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.78, rotate: -2 }}
                    animate={{ opacity: 1, y: 0, scale: [0.78, 1.045, 0.985, 1], rotate: [ -2, 1.5, -0.5, 0 ] }}
                    exit={{ opacity: 0, y: 12, scale: 0.92, rotate: -1 }}
                    transition={{ duration: 0.38, ease: [0.18, 1.28, 0.32, 1] }}
                    style={{ transformOrigin: '85% 100%' }}
                    className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-strong)]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.16)] backdrop-blur-2xl md:bottom-24 md:right-8"
                  >
                    <div className="px-3 pb-2 pt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {appLanguage === 'en' ? 'Choose capture type' : 'Elegir captura'}
                      </p>
                    </div>
                    {[
                      { id: 'seed' as const, icon: Leaf, title: appLanguage === 'en' ? 'Quick seed' : 'Semilla rápida', detail: appLanguage === 'en' ? 'Capture now, decide later' : 'Captura ahora, decide después' },
                      { id: 'sprout' as const, icon: Sprout, title: appLanguage === 'en' ? 'Small project' : 'Proyecto pequeño', detail: appLanguage === 'en' ? 'Name it and add steps' : 'Nómbralo y agrega pasos' },
                      { id: 'journal' as const, icon: Sparkles, title: appLanguage === 'en' ? 'Learning' : 'Aprendizaje', detail: appLanguage === 'en' ? 'Save what it left you' : 'Guarda lo que te dejó' },
                    ].map((item, index) => (
                      <motion.button
                        key={item.id}
                        type="button"
                        initial={{ opacity: 0, y: 14, scale: 0.9, rotate: -1 }}
                        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 24, mass: 0.72, delay: 0.05 + index * 0.045 }}
                        onClick={() => openCreateOption(item.id)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-[var(--bg-app)] active:bg-[var(--bg-app)]"
                      >
                        <motion.span
                          initial={{ scale: 0.75 }}
                          animate={{ scale: [0.75, 1.14, 1] }}
                          transition={{ duration: 0.32, delay: 0.08 + index * 0.055 }}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--sage)]"
                        >
                          <item.icon size={17} />
                        </motion.span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-[var(--earth)]">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs font-medium text-[var(--text-muted)]">{item.detail}</span>
                        </span>
                        <ChevronRight size={15} className="text-[var(--text-muted)]" />
                      </motion.button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            <motion.button
              whileTap={{ y: 1 }}
	              initial={{ scale: 0 }}
	              animate={{ scale: 1, rotate: showCreateMenu ? 45 : 0 }}
	              onPointerDown={startCreateMenuPress}
	              onPointerUp={clearCreateMenuPress}
	              onPointerCancel={clearCreateMenuPress}
	              onPointerLeave={clearCreateMenuPress}
	              onClick={() => {
	                clearCreateMenuPress();
	                if (showCreateMenu) {
	                  setShowCreateMenu(false);
	                  createMenuLongPressRef.current = false;
	                  return;
	                }
	                if (createMenuLongPressRef.current) {
	                  createMenuLongPressRef.current = false;
	                  return;
	                }
	                startPlanting();
	              }}
	              title={t('newSeed')}
	              className="no-touch-callout fixed bottom-[calc(env(safe-area-inset-bottom)+1.1rem)] right-5 z-50 grid h-13 w-13 touch-none select-none place-items-center rounded-full border border-white/40 bg-[var(--sage)] text-[var(--on-sage)] shadow-[0_14px_38px_rgba(47,62,51,0.24)] backdrop-blur-xl soft-interaction hover:scale-[1.03] hover:shadow-[0_18px_45px_rgba(47,62,51,0.28)] md:bottom-8 md:right-8"
              aria-label={showCreateMenu ? 'Cerrar opciones de creación' : t('newSeed')}
              aria-expanded={showCreateMenu}
            >
              <Plus size={25} strokeWidth={2.4} />
            </motion.button>
          </>
        )}
      </main>
    </div>
  );
}
