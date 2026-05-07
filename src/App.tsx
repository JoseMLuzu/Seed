/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  Leaf, 
  Sprout, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  ArrowRight,
  TrendingUp,
  X,
  Calendar as CalendarIcon,
  Skull,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Box,
  Settings,
  Droplets,
  Pause,
  Archive,
  Bell,
  Inbox,
  Target,
  Download,
  Sparkles,
  User
} from 'lucide-react';
import { Theme, SeedNote, Planet } from './types';
import { addFocusMinutes, cultivateInboxNote as cultivateNote, DAY_MS, daysSince, toggleTaskForNote, wateringDue, waterNote as waterSeedNote } from './seedLogic';
import { loadNotesFromDb, migrateLocalNotesToDb, saveNotesToDb } from './storage';
import { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import { deleteNoteFromSupabase, deletePlanetFromSupabase, pushGardenToSupabase, syncGardenWithSupabase } from './supabaseSync';

const Garden3D = lazy(() => import('./components/Garden3D'));

type AccountProfile = {
  name: string;
  email: string;
  role: string;
};

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
  { id: 'work', name: 'Trabajo', description: 'Proyectos, entregas y decisiones profesionales.', theme: 'forest', createdAt: 0 },
  { id: 'study', name: 'Universidad', description: 'Tareas, lecturas, examenes e investigacion.', theme: 'arctic', createdAt: 0 },
];

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

const STAGE_META: Record<SeedNote['growthStage'], { label: string; shortLabel: string; color: string; bg: string; aura: string }> = {
  seed: {
    label: 'Semilla',
    shortLabel: 'Idea nueva',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    aura: 'from-amber-100 via-orange-50 to-white',
  },
  sprout: {
    label: 'En Brote',
    shortLabel: 'En progreso',
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    aura: 'from-emerald-100 via-lime-50 to-white',
  },
  bloom: {
    label: 'Cosechada',
    shortLabel: 'Completada',
    color: 'text-green-700',
    bg: 'bg-green-100',
    aura: 'from-green-100 via-pink-50 to-white',
  },
  withered: {
    label: 'Marchita',
    shortLabel: 'Vencida',
    color: 'text-red-700',
    bg: 'bg-red-100',
    aura: 'from-stone-200 via-red-50 to-white',
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
      tone: 'bg-stone-100 text-stone-700 border-stone-200',
      actionTone: 'bg-stone-700 text-white',
      kind: 'pause' as const,
    };
  }

  if (note.growthStage === 'bloom') {
    return {
      label: 'Cosechada',
      title: note.reflection ? 'Aprendizaje guardado' : 'Guarda lo aprendido',
      detail: note.reflection || 'Cierra el ciclo con una reflexión breve.',
      action: note.reflection ? 'Ver' : 'Reflexionar',
      tone: 'bg-green-50 text-green-700 border-green-100',
      actionTone: 'bg-green-600 text-white',
      kind: 'open' as const,
    };
  }

  if (note.growthStage === 'withered') {
    return {
      label: 'Marchita',
      title: 'Revivir o soltar',
      detail: 'Decide si todavía vale la pena convertirla en acción.',
      action: 'Revivir',
      tone: 'bg-red-50 text-red-700 border-red-100',
      actionTone: 'bg-red-500 text-white',
      kind: 'grow' as const,
    };
  }

  if (!note.isGrowth) {
    return {
      label: 'Sin paso',
      title: 'Define el primer paso',
      detail: 'Una idea empieza a crecer cuando tiene una acción pequeña.',
      action: 'Cultivar',
      tone: 'bg-amber-50 text-amber-800 border-amber-100',
      actionTone: 'bg-[var(--seed-accent)] text-white',
      kind: 'grow' as const,
    };
  }

  if (wateringDue(note)) {
    return {
      label: 'Riego',
      title: 'Vale un riego',
      detail: `${daysWithoutReview} día${daysWithoutReview === 1 ? '' : 's'} sin mirar. Riégala en 20 segundos para que no se pierda.`,
      action: 'Regar',
      tone: 'bg-sky-50 text-sky-800 border-sky-100',
      actionTone: 'bg-[var(--sage)] text-white',
      kind: 'water' as const,
    };
  }

  if (openTask) {
    return {
      label: 'Siguiente',
      title: 'Lista para enfocar',
      detail: openTask.text || 'Describe el siguiente paso antes de enfocarte.',
      action: 'Enfocar',
      tone: 'bg-emerald-50 text-emerald-800 border-emerald-100',
      actionTone: 'bg-[var(--accent)] text-white',
      kind: 'focus' as const,
    };
  }

  return {
    label: 'Paso',
    title: 'Añade una acción',
    detail: 'Esta idea necesita un siguiente paso para seguir avanzando.',
    action: 'Abrir',
    tone: 'bg-[var(--bg-app)] text-[var(--sage)] border-[var(--border)]',
    actionTone: 'bg-[var(--earth)] text-white',
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

function CalendarView({ 
  currentMonth, 
  setCurrentMonth, 
  notes, 
  onSelectNote 
}: { 
  currentMonth: Date; 
  setCurrentMonth: (d: Date) => void; 
  notes: SeedNote[]; 
  onSelectNote: (id: string) => void;
  key?: string;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const notesByDay = useMemo(() => {
    const map: Record<string, SeedNote[]> = {};
    notes.forEach(note => {
      if (note.dueDate) {
        const dateKey = format(note.dueDate, 'yyyy-MM-dd');
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(note);
      }
    });
    return map;
  }, [notes]);

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="pb-20"
    >
      <div className="flex items-center justify-between mb-8 bg-[var(--surface-strong)] p-4 rounded-2xl shadow-sm border border-[var(--border)]">
        <h3 className="text-xl font-serif font-bold text-[var(--earth)] capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors text-[var(--sage)]"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--sage)] hover:bg-[var(--sage)]/10 rounded-lg transition-colors"
          >
            Hoy
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors text-[var(--sage)]"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-[var(--surface-strong)] rounded-3xl shadow-xl border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-soft)]">
          {daysOfWeek.map(day => (
            <div key={day} className="py-4 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-r border-[var(--border)] last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayNotes = notesByDay[dateKey] || [];
            const isTodayDay = isToday(day);
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div 
                key={dateKey} 
                className={`min-h-[120px] p-2 border-r border-b border-[var(--border)] group transition-all ${idx % 7 === 6 ? 'border-r-0' : ''} ${!isCurrentMonth ? 'bg-[var(--surface-soft)]' : 'bg-[var(--surface-strong)]'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${isTodayDay ? 'bg-[var(--sage)] text-white shadow-sm' : isCurrentMonth ? 'text-[var(--earth)]' : 'text-[var(--text-muted)]'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayNotes.length > 0 && (
                    <div className="w-2 h-2 rounded-full bg-[var(--seed-accent)] animate-pulse" />
                  )}
                </div>
                <div className="space-y-1">
                  {dayNotes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => onSelectNote(note.id)}
                      className={`w-full text-left p-1.5 rounded-lg text-[10px] font-bold truncate transition-all border ${
                        note.growthStage === 'bloom' ? 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100' :
                        note.growthStage === 'withered' ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100' :
                        'bg-[var(--bg-app)] text-[var(--sage)] border-[var(--border)] hover:bg-[var(--surface-strong)] hover:shadow-sm'
                      }`}
                    >
                      {note.growthStage === 'withered' ? '🥀 ' : note.growthStage === 'bloom' ? '🌸 ' : '🌱 '}
                      {note.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function TodayView({
  notes,
  quickNote,
  setQuickNote,
  onQuickCapture,
  onOpenWatering,
  onSelectNote,
  onToggleTask,
  onFocusNote,
  onEnableNotifications,
  onNavigate,
  onShowWateringQueue,
  wateredToday,
  wateringStreak,
  getProgress,
}: {
  notes: SeedNote[];
  quickNote: string;
  setQuickNote: (value: string) => void;
  onQuickCapture: () => void;
  onOpenWatering: (id: string) => void;
  onSelectNote: (id: string) => void;
  onToggleTask: (noteId: string, taskId: string) => void;
  onFocusNote: (id: string) => void;
  onEnableNotifications: () => void;
  onNavigate: (view: 'today' | 'inbox' | 'focus' | 'garden' | 'harvest' | 'calendar' | '3D') => void;
  onShowWateringQueue: () => void;
  wateredToday: boolean;
  wateringStreak: number;
  getProgress: (note: SeedNote) => number;
}) {
  const activeNotes = notes.filter(note => !note.inbox && note.growthStage !== 'bloom' && !note.paused);
  const allThirstyNotes = activeNotes
    .filter(wateringDue)
    .sort((a, b) => daysSince(b.lastWateredAt || b.createdAt) - daysSince(a.lastWateredAt || a.createdAt));
  const thirstyNotes = allThirstyNotes.slice(0, 3);
  const hiddenThirstyCount = Math.max(0, allThirstyNotes.length - thirstyNotes.length);
  const nextActions = notes
    .filter(note => !note.inbox && note.isGrowth && !note.paused && note.growthStage !== 'bloom' && !wateringDue(note))
    .map(note => ({ note, task: note.tasks.find(task => !task.completed) }))
    .filter((item): item is { note: SeedNote; task: NonNullable<typeof item.task> } => Boolean(item.task))
    .slice(0, 4);
  const inboxNotes = notes
    .filter(note => note.inbox)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  const dueSoon = notes
    .filter(note => !note.inbox && note.dueDate && note.growthStage !== 'bloom' && !note.paused)
    .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
    .slice(0, 3);
  const harvests = notes
    .filter(note => note.growthStage === 'bloom')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  const firstWatering = thirstyNotes[0];

  return (
    <motion.div
      key="today-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="pb-24 space-y-6"
    >
      <div className="rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] shadow-[0_18px_60px_rgb(47,62,51,0.08)] p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Captura rápida</p>
            <h3 className="text-2xl font-serif font-black text-[var(--earth)] mt-1">Planta una semilla</h3>
          </div>
          <button
            onClick={onEnableNotifications}
            className="h-10 w-10 rounded-full bg-[var(--bg-app)] text-[var(--sage)] flex items-center justify-center hover:bg-[var(--surface-strong)] transition-colors"
            title="Activar recordatorios"
          >
            <Bell size={18} />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={quickNote}
            onChange={(event) => setQuickNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onQuickCapture();
            }}
            placeholder="Anota una idea antes de que se escape..."
            className="flex-1 bg-[var(--bg-app)] border border-[var(--border)] rounded-2xl px-4 py-3 outline-none focus:bg-[var(--surface-strong)] focus:ring-1 focus:ring-[var(--sage)] transition-all text-sm"
          />
          <button
            onClick={onQuickCapture}
            disabled={!quickNote.trim()}
            className="bg-[var(--sage)] disabled:opacity-40 text-white rounded-2xl px-5 py-3 font-black flex items-center justify-center gap-2 shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
          >
            <Plus size={18} /> Plantar
          </button>
        </div>
      </div>

      {inboxNotes.length > 0 && (
        <section className="rounded-[2rem] bg-[var(--surface-soft)] border border-[var(--border)] p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Semillero</p>
              <h3 className="mt-1 text-2xl font-serif font-black text-[var(--earth)]">
                {inboxNotes.length === 1 ? '1 semilla por cultivar' : `${inboxNotes.length} semillas por cultivar`}
              </h3>
              <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">Son ideas rápidas. Elige cuáles pasan al jardín cuando tengas claridad.</p>
            </div>
            <button
              onClick={() => onNavigate('inbox')}
              className="rounded-2xl bg-[var(--sage)] text-white px-5 py-3 font-black shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
            >
              Cultivar semillas
            </button>
          </div>
        </section>
      )}

      <section className={`rounded-[2rem] border p-5 md:p-6 shadow-sm ${firstWatering ? 'bg-[var(--card-bg)] border-[var(--border)]' : wateredToday ? 'bg-green-50 border-green-100' : 'bg-[var(--card-bg)] border-[var(--border)]'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${firstWatering ? 'bg-[var(--sage)] text-white' : wateredToday ? 'bg-green-600 text-white' : 'bg-[var(--sage)] text-white'}`}>
              <Droplets size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Riego diario</p>
              <h3 className="mt-1 text-2xl md:text-3xl font-serif font-black text-[var(--earth)]">
                {firstWatering ? wateredToday ? 'Aún hay ideas por regar' : 'Riega 1 idea hoy' : wateredToday ? 'Jardín cuidado hoy' : 'Tu jardín está fresco'}
              </h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
                {firstWatering
                  ? wateredToday
                    ? `Ya cuidaste tu racha de ${wateringStreak} día${wateringStreak === 1 ? '' : 's'}, pero puedes revisar otra idea si quieres.`
                    : 'Una revisión de 20 segundos basta: mira la idea, decide si sigue viva o crea un micro-paso.'
                  : wateredToday
                    ? `Llevas ${wateringStreak} día${wateringStreak === 1 ? '' : 's'} regando tu jardín.`
                    : 'No hay ideas pidiendo riego ahora. Puedes plantar o avanzar un paso.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => firstWatering ? onOpenWatering(firstWatering.id) : undefined}
            disabled={!firstWatering}
            className="rounded-2xl bg-[var(--sage)] disabled:bg-[var(--surface-strong)] disabled:text-[var(--text-muted)] text-white px-5 py-3 font-black shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
          >
            {firstWatering ? wateredToday ? 'Regar otra' : 'Regar ahora' : wateredToday ? 'Hecho por hoy' : 'Sin riego pendiente'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {thirstyNotes.length > 0 && (
          <section className="rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-serif text-2xl font-black text-[var(--earth)]">Ideas para regar</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Solo revisa las más antiguas. Hoy basta con una.</p>
              </div>
              <Droplets size={20} className="text-[var(--sage)] shrink-0 mt-1" />
            </div>
            <div className="space-y-3">
              {thirstyNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => onOpenWatering(note.id)}
                  className="w-full text-left rounded-2xl bg-[var(--bg-app)] hover:bg-[var(--surface-strong)] border border-[var(--border)] p-4 soft-interaction group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--earth)] truncate">{note.title}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-1">
                        {daysSince(note.lastWateredAt || note.createdAt)} días sin revisar
                      </p>
                      {note.lastWateringNote && (
                        <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-1">{note.lastWateringNote}</p>
                      )}
                    </div>
                    <span className="h-9 w-9 rounded-full bg-[var(--surface-strong)] text-[var(--sage)] flex items-center justify-center shadow-sm transition-colors group-hover:bg-[var(--surface-hover)]">
                      <Droplets size={17} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {hiddenThirstyCount > 0 && (
              <button
                onClick={onShowWateringQueue}
                className="mt-4 w-full rounded-2xl bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--sage)] px-4 py-3 text-sm font-black hover:bg-[var(--surface-strong)] transition-colors"
              >
                Ver {hiddenThirstyCount} más en el jardín
              </button>
            )}
          </section>
        )}

        <section className={`rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] shadow-sm p-5 ${thirstyNotes.length === 0 ? 'xl:col-span-2' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-2xl font-black text-[var(--earth)]">Siguiente paso</h3>
            <ArrowRight size={20} className="text-[var(--sage)]" />
          </div>
          <div className="space-y-3">
            {nextActions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                {thirstyNotes.length > 0
                  ? 'Primero riega las ideas pendientes. Después aparecerán aquí los pasos listos para enfocar.'
                  : 'Convierte una semilla en brote para ver acciones aquí.'}
              </p>
            ) : nextActions.map(({ note, task }) => (
              <div key={task.id} className="rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-4">
                <button onClick={() => onSelectNote(note.id)} className="text-left w-full">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)]">{note.title}</p>
                  <p className="font-semibold text-[var(--earth)] mt-1">{task.text || 'Describe el siguiente paso'}</p>
                </button>
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 h-2 rounded-full bg-[var(--surface-strong)] overflow-hidden">
                    <motion.div className="h-full bg-[var(--sage)]" animate={{ width: `${getProgress(note)}%` }} />
                  </div>
                  <button
                    onClick={() => onFocusNote(note.id)}
                    className="text-xs font-black text-white bg-[var(--sage)] px-3 py-2 rounded-xl active:translate-y-px soft-interaction"
                  >
                    Enfocar
                  </button>
                  <button
                    onClick={() => onToggleTask(note.id, task.id)}
                    className="text-xs font-black text-[var(--sage)] bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-2 rounded-xl active:translate-y-px soft-interaction"
                  >
                    Hecho
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {(dueSoon.length > 0 || harvests.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {dueSoon.length > 0 && (
            <section className="rounded-[2rem] bg-[var(--surface-soft)] border border-[var(--border)] p-5">
              <h3 className="font-serif text-2xl font-black text-[var(--earth)] mb-4">Próximas cosechas</h3>
              <div className="space-y-2">
                {dueSoon.map(note => (
                  <button key={note.id} onClick={() => onSelectNote(note.id)} className="w-full flex items-center justify-between rounded-2xl bg-[var(--surface-strong)] px-4 py-3 text-left">
                    <span className="font-bold text-[var(--earth)] truncate">{note.title}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--seed-accent)]">{format(note.dueDate!, 'd MMM')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {harvests.length > 0 && (
            <section className="rounded-[2rem] bg-[var(--surface-soft)] border border-[var(--border)] p-5">
              <h3 className="font-serif text-2xl font-black text-[var(--earth)] mb-4">Archivo de cosechas</h3>
              <div className="space-y-2">
                {harvests.map(note => (
                  <button key={note.id} onClick={() => onSelectNote(note.id)} className="w-full flex items-center gap-3 rounded-2xl bg-[var(--surface-strong)] px-4 py-3 text-left">
                    <Archive size={16} className="text-green-600 shrink-0" />
                    <span className="font-bold text-[var(--earth)] truncate">{note.title}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </motion.div>
  );
}

function InboxView({
  notes,
  onCultivate,
  onSaveLater,
  onDelete,
  onSelectNote,
}: {
  notes: SeedNote[];
  onCultivate: (id: string) => void;
  onSaveLater: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectNote: (id: string) => void;
}) {
  const inboxNotes = notes.filter(note => note.inbox);

  return (
    <motion.div
      key="inbox-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="pb-24"
    >
      <div className="rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] p-6 shadow-sm mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Semillero</p>
        <h3 className="text-3xl font-serif font-black text-[var(--earth)] mt-1">Semillas rápidas</h3>
        <p className="text-sm text-[var(--text-muted)] mt-2">Aquí caen ideas crudas. Elige una y conviértela en el siguiente brote del jardín.</p>
      </div>

      <div className="space-y-3">
        {inboxNotes.length === 0 ? (
          <div className="rounded-[2rem] bg-[var(--surface-soft)] border border-[var(--border)] p-8 text-center">
            <Inbox className="mx-auto text-[var(--sage)] opacity-40 mb-4" size={40} />
            <p className="font-serif text-2xl text-[var(--earth)]">Semillero limpio</p>
            <p className="text-sm text-[var(--text-muted)] mt-2">Cuando captures ideas rápidas, aparecerán aquí antes de pasar al jardín.</p>
          </div>
        ) : inboxNotes.map(note => (
          <div key={note.id} className="rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] p-5 shadow-sm">
            <button onClick={() => onSelectNote(note.id)} className="text-left w-full">
              <p className="font-serif text-2xl font-black text-[var(--earth)]">{note.title}</p>
              <p className="text-sm text-[var(--text-muted)] mt-2 line-clamp-2">{note.content}</p>
            </button>
            <div className="mt-5">
              <button onClick={() => onCultivate(note.id)} className="w-full rounded-2xl bg-[var(--sage)] text-white py-3 text-sm font-black flex items-center justify-center gap-2 shadow-sm active:translate-y-px soft-interaction">
                <Sprout size={16} /> Cultivar ahora
              </button>
              <div className="flex items-center justify-center gap-5 mt-3 text-[11px] font-black">
                <button onClick={() => onSaveLater(note.id)} className="text-[var(--text-muted)] hover:text-[var(--sage)] transition-colors flex items-center gap-1.5">
                  <Archive size={13} /> Después
                </button>
                <button onClick={() => onDelete(note.id)} className="text-red-400 hover:text-red-600 transition-colors flex items-center gap-1.5">
                  <Trash2 size={13} /> Soltar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function HarvestView({ notes, onSelectNote }: { notes: SeedNote[]; onSelectNote: (id: string) => void }) {
  const harvests = notes.filter(note => note.growthStage === 'bloom');
  const totalMinutes = harvests.reduce((sum, note) => sum + (note.focusedMinutes || 0), 0);
  const totalSteps = harvests.reduce((sum, note) => sum + note.tasks.length, 0);

  return (
    <motion.div key="harvest-view" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="pb-24">
      <div className="rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] p-6 shadow-sm mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Archivo vivo</p>
        <h3 className="text-3xl font-serif font-black text-[var(--earth)] mt-1">Cosechas</h3>
        <p className="text-sm text-[var(--text-muted)] mt-2">Ideas terminadas, aprendizajes y resultados que ya no quieres perder.</p>
        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            { label: 'Ideas', value: harvests.length },
            { label: 'Pasos', value: totalSteps },
            { label: 'Min', value: totalMinutes },
          ].map(item => (
            <div key={item.label} className="rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] px-3 py-3 text-center">
              <p className="text-2xl font-serif font-black text-[var(--earth)]">{item.value}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {harvests.length === 0 ? (
          <div className="lg:col-span-2 rounded-[2rem] bg-[var(--surface-soft)] border border-[var(--border)] p-8 text-center">
            <Archive className="mx-auto text-[var(--sage)] opacity-40 mb-4" size={44} />
            <p className="font-serif text-2xl text-[var(--earth)]">Todavía no hay cosechas</p>
            <p className="text-sm text-[var(--text-muted)] mt-2">Completa los pasos de una idea para guardarla aquí.</p>
          </div>
        ) : harvests.map(note => (
          <button key={note.id} onClick={() => onSelectNote(note.id)} className="rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border)] p-5 text-left shadow-sm hover:shadow-md soft-interaction">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Cosechada</p>
            <h4 className="font-serif text-2xl font-black text-[var(--earth)]">{note.title}</h4>
            <p className="text-sm text-[var(--text-muted)] mt-2 line-clamp-2">{note.reflection || note.content}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <span className="rounded-xl bg-[var(--bg-app)] px-2 py-2 text-[10px] font-black text-[var(--sage)]">{note.tasks.length} pasos</span>
              <span className="rounded-xl bg-[var(--bg-app)] px-2 py-2 text-[10px] font-black text-[var(--sage)]">{note.focusedMinutes || 0} min</span>
              <span className="rounded-xl bg-[var(--bg-app)] px-2 py-2 text-[10px] font-black text-[var(--sage)]">
                {format(note.harvestedAt || note.createdAt, 'd MMM')}
              </span>
            </div>
          </button>
        ))}
      </div>
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
  onLogFocus: (id: string, minutes: number) => void;
  onPickFocus: (id: string) => void;
  onExit: () => void;
}) {
  const focusCandidates = notes
    .filter(note => !note.inbox && !note.paused && note.growthStage !== 'bloom')
    .sort((a, b) => {
      const aScore = (wateringDue(a) ? 10 : 0) + daysSince(a.lastWateredAt || a.createdAt);
      const bScore = (wateringDue(b) ? 10 : 0) + daysSince(b.lastWateredAt || b.createdAt);
      return bScore - aScore;
    });
  const focusNote = focusCandidates.find(note => note.id === focusNoteId) || focusCandidates[0];
  const [step, setStep] = useState('');
  const [duration, setDuration] = useState(10);
  const [remaining, setRemaining] = useState(10 * 60);
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sessionStartCompleted, setSessionStartCompleted] = useState(0);
  const [sessionSummary, setSessionSummary] = useState<{ minutes: number; steps: number; growth: number } | null>(null);
  const nextTask = focusNote?.tasks.find(task => !task.completed);
  const completedSteps = focusNote?.tasks.filter(task => task.completed).length || 0;
  const progress = focusNote?.tasks.length ? Math.round((focusNote.tasks.filter(task => task.completed).length / focusNote.tasks.length) * 100) : 0;
  const isDay = new Date().getHours() >= 6 && new Date().getHours() < 19;
  const focusTips = [
    nextTask ? `Solo cultiva este paso: ${nextTask.text || 'un paso pequeño'}` : 'Define un paso tan pequeño que puedas empezarlo en menos de dos minutos.',
    active ? 'Si te distraes, vuelve al siguiente paso. No necesitas reiniciar la sesión.' : 'Antes de empezar, deja claro qué significa avanzar un poco.',
    progress >= 70 ? 'Ya estás cerca de cosechar. Cierra lo importante antes de pulir.' : 'Descansa cuando termine el bloque; una pausa corta también protege la idea.',
  ];

  useEffect(() => {
    if (!active || !focusNote) return;

    const timer = window.setInterval(() => {
      setRemaining(value => {
        if (value <= 1) {
          window.clearInterval(timer);
          setActive(false);
          setFinished(true);
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
  }, [focusNote?.id, duration]);

  const startFocus = (minutes: number) => {
    setDuration(minutes);
    setRemaining(minutes * 60);
    setFinished(false);
    setSessionSummary(null);
    setSessionStartCompleted(completedSteps);
    setActive(true);
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
  };

  const completeCurrentTask = () => {
    if (!focusNote || !nextTask) return;
    onToggleTask(focusNote.id, nextTask.id);
  };

  const formattedTime = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;

  if (!focusNote) {
    return (
      <motion.div key="focus-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24">
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
      className={`fixed inset-0 z-40 overflow-y-auto app-scrollbar ${isDay ? 'bg-[#dff5e8]' : 'bg-[#07110d]'} text-[var(--text-main)]`}
    >
      <div className="min-h-screen relative overflow-hidden p-5 md:p-8">
        <div className={`absolute inset-0 ${isDay ? 'bg-[radial-gradient(circle_at_78%_16%,rgba(255,229,143,0.75),transparent_14%),linear-gradient(180deg,#dff5e8_0%,#f8faf3_58%,#eef7e8_100%)]' : 'bg-[radial-gradient(circle_at_78%_16%,rgba(230,226,204,0.9),transparent_8%),linear-gradient(180deg,#07110d_0%,#0d1d17_55%,#14251b_100%)]'}`} />
        {!isDay && (
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,white_0_1px,transparent_1px),radial-gradient(circle_at_62%_34%,white_0_1px,transparent_1px)] bg-[length:120px_120px,180px_180px]" />
        )}

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-6">
            <button onClick={() => { stopFocus(); onExit(); }} className="rounded-full bg-[var(--surface-strong)] border border-[var(--border)] px-4 py-2 text-xs font-black text-[var(--sage)] shadow-sm soft-interaction">
              Salir de enfoque
            </button>
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-[var(--surface-strong)]/90 border border-[var(--border)] px-4 py-2 shadow-sm">
              <Target size={15} className="text-[var(--sage)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{active ? 'Sesión activa' : 'Preparado'}</span>
            </div>
          </div>

          <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-6 items-stretch">
            <div className="rounded-[2rem] bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--border)] shadow-[0_24px_90px_rgb(47,62,51,0.14)] p-5 md:p-8 flex flex-col">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-5 items-start">
                <div className="text-center xl:text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Modo enfoque</p>
                  <h3 className="text-3xl md:text-5xl font-serif font-black text-[var(--earth)] mt-2 leading-none">{focusNote.title}</h3>
                  <p className="text-[var(--text-muted)] mt-5 leading-relaxed max-w-2xl mx-auto xl:mx-0">{focusNote.content}</p>
                </div>

                <div className="rounded-[1.75rem] bg-[var(--bg-app)]/80 border border-[var(--border)] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--sage)]">Preparar bloque</p>
                  <label className="block mt-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Idea</span>
                    <select
                      value={focusNote.id}
                      onChange={(event) => onPickFocus(event.target.value)}
                      disabled={active}
                      className="mt-1 w-full rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-3 text-sm font-bold text-[var(--earth)] outline-none focus:ring-1 focus:ring-[var(--sage)] disabled:opacity-60"
                    >
                      {focusCandidates.map(note => (
                        <option key={note.id} value={note.id}>{note.title}</option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Tiempo</p>
                    <div className="mt-1 grid grid-cols-3 gap-1 rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-1">
                      {[5, 10, 25].map(minutes => (
                        <button
                          key={minutes}
                          onClick={() => { setDuration(minutes); setRemaining(minutes * 60); }}
                          disabled={active}
                          className={`rounded-xl py-2 text-xs font-black transition-all ${duration === minutes ? 'bg-[var(--sage)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--sage)]'} disabled:opacity-60`}
                        >
                          {minutes}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[2rem] bg-[var(--bg-app)]/80 border border-[var(--border)] p-5 flex-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] mb-2">Pasos</p>
                    <p className="font-serif text-2xl font-black text-[var(--earth)]">Una acción clara</p>
                  </div>
                  <span className="text-xs font-black text-[var(--sage)]">{progress}%</span>
                </div>

                <div className="space-y-3 mt-5">
                  {focusNote.tasks.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">Agrega un primer paso pequeño para empezar.</p>
                  ) : focusNote.tasks.map(task => (
                    <div key={task.id} className={`rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-3 flex items-start gap-3 transition-all ${task.completed ? 'opacity-55' : 'hover:border-[var(--sage)]/30 hover:shadow-sm'}`}>
                      <button
                        onClick={() => onToggleTask(focusNote.id, task.id)}
                        className={`mt-1 h-6 w-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${task.completed ? 'bg-[var(--sage)] border-[var(--sage)] text-white' : 'border-[var(--border)] text-transparent'}`}
                        aria-label={task.completed ? 'Marcar paso pendiente' : 'Completar paso'}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <input
                        value={task.text}
                        onChange={(event) => onUpdateTask(focusNote.id, task.id, event.target.value)}
                        className={`flex-1 bg-transparent outline-none text-sm ${task.completed ? 'line-through italic' : ''}`}
                        placeholder="Describe este paso"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <input
                    value={step}
                    onChange={(event) => setStep(event.target.value)}
                    placeholder="Nuevo paso pequeño..."
                    className="flex-1 rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] px-4 py-3 outline-none focus:ring-1 focus:ring-[var(--sage)]"
                  />
                  <button
                    onClick={() => { onAddTinyStep(focusNote.id, step); setStep(''); }}
                    className="rounded-2xl bg-[var(--sage)] text-white px-5 py-3 font-black"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-center">
                <button onClick={active ? stopFocus : () => startFocus(duration)} className="rounded-2xl bg-[var(--sage)] text-white py-4 px-5 font-black shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction">
                  {active ? 'Terminar y guardar' : `Empezar ${duration} min`}
                </button>
                <button onClick={() => onOpenWatering(focusNote.id)} className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] px-5 py-4 text-xs font-black text-[var(--sage)] hover:border-[var(--sage)]/40 soft-interaction">
                  Me bloqueé
                </button>
                <button onClick={() => onSelectNote(focusNote.id)} className="rounded-2xl bg-transparent border border-transparent px-4 py-4 text-xs font-black text-[var(--text-muted)] hover:text-[var(--sage)] soft-interaction">
                  Editar idea
                </button>
              </div>
            </div>

            <aside className="rounded-[2rem] bg-[var(--surface-strong)] backdrop-blur-xl border border-[var(--border)] p-5 md:p-6 shadow-[0_24px_90px_rgb(47,62,51,0.12)] lg:sticky lg:top-8 self-start">
              <div className="text-center rounded-[2rem] bg-[var(--bg-app)]/70 border border-[var(--border)] px-4 py-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)]">Tiempo restante</p>
                <p className="font-mono text-6xl md:text-7xl font-black text-[var(--earth)] mt-2 tabular-nums">{formattedTime}</p>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mt-2">{active ? 'Protegiendo tu atención' : finished ? 'Sesión terminada' : 'Listo para empezar'}</p>
              </div>

              <div className={`mt-5 h-64 rounded-[2rem] border border-[var(--border)] flex items-center justify-center relative overflow-hidden ${isDay ? 'bg-gradient-to-b from-sky-100 via-emerald-50 to-white' : 'bg-gradient-to-b from-[#14251b] via-[#1d3425] to-[#edf7ea]'}`}>
                <div className="seed-card-sheen" />
                <div className="absolute bottom-8 w-40 h-5 rounded-full bg-green-900/10 blur-md" />
                <motion.div
                  animate={{ scale: 1 + progress / 220, y: active ? [0, -4, 0] : 0 }}
                  transition={{ duration: 3.5, repeat: active ? Infinity : 0, ease: "easeInOut" }}
                >
                  <PlantIllustration stage={focusNote.growthStage} progress={progress} isGrowth={focusNote.isGrowth} theme={theme} />
                </motion.div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl bg-[var(--bg-app)]/70 border border-[var(--border)] p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Pasos</p>
                  <p className="text-2xl font-serif font-black text-[var(--earth)]">{focusNote.tasks.filter(task => task.completed).length}/{focusNote.tasks.length}</p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-app)]/70 border border-[var(--border)] p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Enfoque</p>
                  <p className="text-2xl font-serif font-black text-[var(--earth)]">{focusNote.focusedMinutes || 0}m</p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.75rem] bg-[var(--bg-app)]/70 border border-[var(--border)] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--sage)]">Consejos del jardinero</p>
                <div className="mt-3 space-y-2">
                  {focusTips.map(tip => (
                    <p key={tip} className="rounded-2xl bg-[var(--surface-strong)] px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                      {tip}
                    </p>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <AnimatePresence>
            {finished && sessionSummary && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-6 rounded-[2rem] bg-[var(--surface-strong)] border border-green-100 p-5 max-w-5xl shadow-xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-green-600">Resumen de enfoque</p>
                    <h4 className="mt-1 font-serif text-2xl font-black text-[var(--earth)]">Sesión terminada</h4>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">Si te bloqueaste, convierte el paso en algo más pequeño.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Min', value: sessionSummary.minutes },
                      { label: 'Pasos', value: sessionSummary.steps },
                      { label: 'Creció', value: `${sessionSummary.growth}%` },
                    ].map(item => (
                      <div key={item.label} className="rounded-2xl bg-green-50 px-4 py-3">
                        <p className="text-xl font-black text-green-700">{item.value}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-green-700/60">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
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
  return (
    <div className={`relative w-28 h-32 flex flex-col items-center justify-end ${swayClass}`}>
      <div className="absolute bottom-1 w-22 h-4 rounded-full bg-green-950/10 blur-sm" />
      <motion.div
        animate={{ height }}
        transition={stemTransition}
        className={`relative w-3 bg-gradient-to-t ${tree.trunk} rounded-full origin-bottom shadow-[inset_-4px_0_6px_rgba(0,0,0,0.12)]`}
      >
        <div className={`absolute left-1/2 top-5 h-9 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[-46deg]`} />
        <div className={`absolute right-1/2 top-8 h-8 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[48deg]`} />
      </motion.div>
      <motion.div
        animate={{ y: 58 - height, scale: crownScale }}
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

function LandingPage({ onEnter }: { onEnter: () => void }) {
  const features = [
    { icon: Leaf, title: 'Captura sin friccion', text: 'Anota ideas rapidas y conviertelas en brotes cuando estes listo.' },
    { icon: Droplets, title: 'Riego inteligente', text: 'Revisa ideas viejas sin presion: basta con mantener una viva.' },
    { icon: Target, title: 'Enfoque claro', text: 'Trabaja una idea a la vez con pasos pequenos y progreso visible.' },
    { icon: Archive, title: 'Cosecha aprendizajes', text: 'Cierra proyectos con una reflexion util, no solo con una lista tachada.' },
  ];
  const steps = [
    { label: 'Plantar', value: 'Idea rapida' },
    { label: 'Regar', value: '20 segundos' },
    { label: 'Enfocar', value: 'Un paso' },
    { label: 'Cosechar', value: 'Aprendizaje' },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f3e8] text-[#223126]">
      <section className="relative min-h-[92vh] flex items-center px-5 sm:px-8 lg:px-12 py-8 overflow-hidden">
        <img src="/icon-512.png" alt="" className="absolute right-[-8rem] top-[-7rem] w-[28rem] sm:w-[36rem] opacity-20 blur-[2px] rotate-[-10deg]" />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(247,243,232,0.96)_0%,rgba(247,243,232,0.84)_44%,rgba(247,243,232,0.42)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-52 bg-[linear-gradient(0deg,rgba(111,125,79,0.22),transparent)]" />
        <div className="absolute right-[8%] bottom-[8%] hidden lg:block w-[29rem]">
          <div className="relative rounded-[2rem] bg-white/72 border border-white/70 shadow-[0_34px_120px_rgba(47,59,47,0.18)] p-5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#c98f58]">Hoy</p>
                <h2 className="font-serif text-3xl font-black text-[#5a4635]">Tu jardin mental</h2>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-[#6f7d4f] text-white flex items-center justify-center">
                <Droplets size={21} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {steps.slice(0, 3).map(step => (
                <div key={step.label} className="rounded-2xl bg-[#f7f3e8] border border-[#eadfce] px-3 py-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#6b7280]">{step.label}</p>
                  <p className="mt-2 text-sm font-black text-[#5a4635]">{step.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[1.5rem] bg-[#f7f3e8] border border-[#eadfce] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#6f7d4f]">Idea para regar</p>
                  <p className="mt-1 font-black text-[#5a4635]">Redisenar el portfolio</p>
                </div>
                <span className="h-9 w-9 rounded-full bg-white text-[#6f7d4f] flex items-center justify-center">
                  <Droplets size={17} />
                </span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white overflow-hidden">
                <motion.div className="h-full bg-[#6f7d4f]" initial={{ width: 0 }} animate={{ width: '68%' }} transition={{ duration: 1.1, delay: 0.2 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <nav className="absolute top-0 left-0 right-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/icon-192.png" alt="Seed" className="h-11 w-11 rounded-2xl shadow-lg" />
              <div>
                <p className="text-2xl font-serif font-black text-[#6f7d4f] leading-none">Seed</p>
                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#c98f58]">Digital Garden</p>
              </div>
            </div>
            <button onClick={onEnter} className="rounded-full bg-white/76 border border-white px-4 py-2 text-sm font-black text-[#5a4635] shadow-sm hover:bg-white transition-colors">
              Abrir app
            </button>
          </nav>

          <div className="pt-28 max-w-3xl">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] font-black uppercase tracking-[0.3em] text-[#c98f58]">
              Jardin de ideas para personas que procrastinan
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-5 font-serif text-6xl sm:text-7xl lg:text-8xl font-black leading-[0.9] text-[#4f3d2e]">
              Seed
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-6 max-w-2xl text-lg sm:text-xl font-semibold leading-relaxed text-[#4f5d4f]">
              Una app simple para plantar ideas, revisarlas sin culpa y convertirlas en avances reales con pasos pequenos.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex flex-col sm:flex-row gap-3">
              <button onClick={onEnter} className="rounded-2xl bg-[#6f7d4f] text-white px-6 py-4 font-black shadow-xl shadow-[#6f7d4f]/25 flex items-center justify-center gap-2 active:translate-y-px soft-interaction">
                Entrar al jardin <ArrowRight size={18} />
              </button>
              <a href="#como-funciona" className="rounded-2xl bg-white/76 border border-white text-[#5a4635] px-6 py-4 font-black shadow-sm text-center hover:bg-white transition-colors">
                Ver como funciona
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="px-5 sm:px-8 lg:px-12 py-16 bg-[#fffaf0]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#c98f58]">Flujo simple</p>
            <h2 className="mt-3 font-serif text-4xl sm:text-5xl font-black text-[#5a4635]">No es otro Notion. Es un jardin que te dice que hacer despues.</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-4">
            {features.map(feature => (
              <div key={feature.title} className="rounded-[1.5rem] bg-white border border-[#eadfce] p-5 shadow-sm">
                <div className="h-11 w-11 rounded-2xl bg-[#eef1e6] text-[#6f7d4f] flex items-center justify-center mb-5">
                  <feature.icon size={20} />
                </div>
                <h3 className="font-serif text-2xl font-black text-[#5a4635]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed font-medium text-[#6b7280]">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 sm:px-8 lg:px-12 py-16 bg-[#eef1e6]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#c98f58]">Para volver todos los dias</p>
            <h2 className="mt-3 font-serif text-4xl sm:text-5xl font-black text-[#5a4635]">Riego, enfoque y cosecha mantienen tus ideas vivas.</h2>
            <p className="mt-5 text-base font-semibold leading-relaxed text-[#4f5d4f]">
              Seed evita la sobrecarga: no te pide organizar todo perfecto. Te muestra una idea para revisar, un paso para avanzar y un momento claro para cerrar.
            </p>
            <button onClick={onEnter} className="mt-7 rounded-2xl bg-[#223126] text-white px-6 py-4 font-black shadow-xl flex items-center gap-2 active:translate-y-px soft-interaction">
              Probar Seed <Sparkles size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {steps.map((step, index) => (
              <div key={step.label} className="rounded-[1.5rem] bg-white/82 border border-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#6f7d4f]">0{index + 1}</p>
                <h3 className="mt-3 font-serif text-3xl font-black text-[#5a4635]">{step.label}</h3>
                <p className="mt-2 text-sm font-semibold text-[#6b7280]">{step.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [notes, setNotes] = useState<SeedNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [showLanding, setShowLanding] = useState(() => localStorage.getItem('seed-landing-seen') !== 'true');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [planets, setPlanets] = useState<Planet[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('seed-planets') || '[]');
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PLANETS;
    } catch {
      return DEFAULT_PLANETS;
    }
  });
  const [activePlanetId, setActivePlanetId] = useState(() => localStorage.getItem('seed-active-planet') || DEFAULT_PLANET_ID);
  const [isAddingPlanet, setIsAddingPlanet] = useState(false);
  const [newPlanetName, setNewPlanetName] = useState('');
  const [showPlanetSettings, setShowPlanetSettings] = useState(false);
  const [editingPlanetName, setEditingPlanetName] = useState('');
  
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('seed-theme') as Theme) || 'earth';
  });

  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<SeedNote['growthStage'] | 'all'>('all');
  const [view, setView] = useState<'today' | 'inbox' | 'focus' | 'garden' | 'harvest' | 'calendar' | '3D'>('today');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState<{ title: string; content: string; dueDate: string; seedType: NonNullable<SeedNote['seedType']> }>({ title: '', content: '', dueDate: '', seedType: 'idea' });
  const [quickNote, setQuickNote] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [wateringNoteId, setWateringNoteId] = useState<string | null>(null);
  const [wateringNote, setWateringNote] = useState('');
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('seed-onboarded') !== 'true');
  const [showSettings, setShowSettings] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const applyingRemoteSyncRef = useRef(false);
  const remoteSyncReadyRef = useRef(false);
  const autoSyncTimerRef = useRef<number | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('seed-notifications') === 'true');
  const [defaultWateringInterval, setDefaultWateringInterval] = useState(() => Number(localStorage.getItem('seed-default-watering') || 1));
  const [reminderHour, setReminderHour] = useState(() => Number(localStorage.getItem('seed-reminder-hour') || 9));
  const [account, setAccount] = useState<AccountProfile>(() => {
    try {
      return JSON.parse(localStorage.getItem('seed-account') || '{"name":"Jardinero Digital","email":"jose@garden.com","role":"Cuidador de ideas"}');
    } catch {
      return { name: 'Jardinero Digital', email: 'jose@garden.com', role: 'Cuidador de ideas' };
    }
  });
  const [harvestNoteId, setHarvestNoteId] = useState<string | null>(null);
  const [recentlyWateredId, setRecentlyWateredId] = useState<string | null>(null);
  const [wateringRitual, setWateringRitual] = useState<{ lastDate: string; streak: number }>(() => {
    try {
      return JSON.parse(localStorage.getItem('seed-watering-ritual') || '{"lastDate":"","streak":0}');
    } catch {
      return { lastDate: '', streak: 0 };
    }
  });
  const todayKey = format(Date.now(), 'yyyy-MM-dd');
  const wateredToday = wateringRitual.lastDate === todayKey;
  const accountInitials = getAccountInitials(account.name, account.email);
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
    saveNotesToDb(notes);
  }, [notes, notesLoaded]);

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
    localStorage.setItem('seed-planets', JSON.stringify(planets));
  }, [planets]);

  useEffect(() => {
    if (!planets.some(planet => planet.id === activePlanetId)) {
      setActivePlanetId(planets[0]?.id || DEFAULT_PLANET_ID);
    }
  }, [activePlanetId, planets]);

  useEffect(() => {
    localStorage.setItem('seed-active-planet', activePlanetId);
  }, [activePlanetId]);

  useEffect(() => {
    localStorage.setItem('seed-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('seed-default-watering', String(defaultWateringInterval));
  }, [defaultWateringInterval]);

  useEffect(() => {
    localStorage.setItem('seed-notifications', notificationsEnabled ? 'true' : 'false');
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('seed-reminder-hour', String(reminderHour));
  }, [reminderHour]);

  useEffect(() => {
    localStorage.setItem('seed-account', JSON.stringify(account));
  }, [account]);

  useEffect(() => {
    localStorage.setItem('seed-watering-ritual', JSON.stringify(wateringRitual));
  }, [wateringRitual]);

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

    const notesChannel = supabase
      .channel(`seed-notes-${userId}`)
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'seed_notes', filter: `user_id=eq.${userId}` } as never,
        (payload: any) => {
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

          const incoming: SeedNote = {
            ...row.data,
            planetId: row.data.planetId || row.planet_id || DEFAULT_PLANET_ID,
          };

          setNotes(current => {
            const existing = current.find(note => note.id === incoming.id);
            if (existing && noteUpdatedAt(existing) > noteUpdatedAt(incoming)) return current;
            if (existing) return current.map(note => note.id === incoming.id ? incoming : note);
            return [incoming, ...current];
          });
          markRemoteApplyDone();
        },
      )
      .subscribe();

    const planetsChannel = supabase
      .channel(`seed-planets-${userId}`)
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'seed_planets', filter: `user_id=eq.${userId}` } as never,
        (payload: any) => {
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
        },
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
    if (localStorage.getItem('seed-last-notification-day') === todayKey) return;

    const delay = Math.max(5000, new Date().getHours() >= reminderHour ? 5000 : (reminderHour - new Date().getHours()) * 60 * 60 * 1000);
    const timeout = window.setTimeout(() => {
      localStorage.setItem('seed-last-notification-day', todayKey);
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
    if (!newNote.content.trim()) return;
    
    const note: SeedNote = {
      id: crypto.randomUUID(),
      title: newNote.title || 'Nueva Semilla',
      content: newNote.content,
      createdAt: Date.now(),
      tags: [],
      isGrowth: false,
      tasks: [],
      growthStage: 'seed',
      dueDate: newNote.dueDate ? new Date(newNote.dueDate).getTime() : undefined,
      lastWateredAt: Date.now(),
      wateringIntervalDays: defaultWateringInterval,
      inbox: false,
      seedType: newNote.seedType,
      planetId: activePlanetId,
    };
    
    setNotes([touchNote(note), ...notes]);
    setNewNote({ title: '', content: '', dueDate: '', seedType: 'idea' });
    setIsAdding(false);
    setSelectedNoteId(note.id);
    setView('garden');
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
      planetId: activePlanetId,
    };

    setNotes([touchNote(note), ...notes]);
    setQuickNote('');
    setView('inbox');
  };

  const deleteNote = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!window.confirm(`Eliminar "${note?.title || 'esta semilla'}"? Esta acción no se puede deshacer.`)) return;
    setNotes(notes.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
    if (session?.user) {
      deleteNoteFromSupabase(id, session.user).catch(error => {
        setSyncStatus(error instanceof Error ? error.message : 'No se pudo borrar la idea en la nube.');
      });
    }
  };

  const updateNote = (id: string, updates: Partial<SeedNote>) => {
    setNotes(notes.map(n => n.id === id ? touchNote({ ...n, ...updates }) : n));
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

  const growNote = (id: string) => {
    setNotes(notes.map(n => {
      if (n.id === id && !n.isGrowth) {
        const seedType = SEED_TYPES.find(type => type.id === (n.seedType || 'idea')) || SEED_TYPES[0];
        return touchNote({ 
          ...n, 
          isGrowth: true, 
          growthStage: 'sprout',
          paused: false,
          inbox: false,
          lastWateredAt: Date.now(),
          tasks: [{ id: crypto.randomUUID(), text: seedType.task, completed: false }]
        });
      }
      return n;
    }));
  };

  const waterNote = (id: string, note = 'Riego rápido: sigue viva') => {
    setNotes(notes.map(n => n.id === id ? touchNote(waterSeedNote(n, note)) : n));
    recordWateringRitual();
    markRecentlyWatered(id);
    setWateringNoteId(null);
    setWateringNote('');
  };

  const openWatering = (id: string) => {
    setWateringNoteId(id);
    setWateringNote('');
  };

  const cultivateInboxNote = (id: string) => {
    setNotes(notes.map(n => {
      if (n.id !== id) return n;
      const cultivated = cultivateNote(n);
      return touchNote({
        ...cultivated,
        isGrowth: true,
        growthStage: cultivated.growthStage === 'seed' ? 'sprout' : cultivated.growthStage,
        tasks: cultivated.tasks.length > 0
          ? cultivated.tasks
          : [{ id: crypto.randomUUID(), text: 'Dar el primer paso de 5 minutos', completed: false }],
      });
    }));
    setSelectedNoteId(id);
    setFilterStage('all');
    setSearch('');
    setView('garden');
  };

  const saveInboxForLater = (id: string) => {
    setNotes(notes.map(n => n.id === id ? touchNote({ ...n, inbox: false, paused: true, lastWateredAt: Date.now() }) : n));
  };

  const addTinyStep = (id: string, text?: string) => {
    const taskText = (text || wateringNote).trim() || 'Dedicar 2 minutos a destrabar esta idea';
    setNotes(notes.map(n => {
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
    setFocusNoteId(id);
    setSelectedNoteId(null);
    setView('focus');
    setWateringNoteId(null);
    setWateringNote('');
  };

  const togglePauseNote = (id: string) => {
    setNotes(notes.map(n => n.id === id ? touchNote({ ...n, paused: !n.paused }) : n));
  };

  const logFocusMinutes = (id: string, minutes: number) => {
    setNotes(notes.map(n => n.id === id ? touchNote(addFocusMinutes(n, minutes)) : n));
  };

  const showSeedNotification = async (body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Seed', {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'seed-daily-review',
      });
      return;
    }
    new Notification('Seed', { body, icon: '/icon-192.png', tag: 'seed-daily-review' });
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
    setNotes(notes.map(n => {
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
    setNotes(notes.map(n => {
      if (n.id === noteId) {
        return touchNote({
          ...n,
          tasks: n.tasks.map(t => t.id === taskId ? { ...t, text } : t)
        });
      }
      return n;
    }));
  };

  const toggleTask = (noteId: string, taskId: string) => {
    setNotes(notes.map(n => {
      if (n.id === noteId) {
        const currentTask = n.tasks.find(t => t.id === taskId);
        const wasBloom = n.growthStage === 'bloom';
        if (currentTask && !currentTask.completed) {
          setCelebration(n.title);
          window.setTimeout(() => setCelebration(null), 1800);
        }
        const updated = toggleTaskForNote(n, taskId);
        if (!wasBloom && updated.growthStage === 'bloom') {
          window.setTimeout(() => setHarvestNoteId(updated.id), 500);
        }
        return touchNote(updated);
      }
      return n;
    }));
  };

  const toggleConnection = (fromId: string, toId: string) => {
    setNotes(notes.map(n => {
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

  const selectedNote = useMemo(() => 
    planetNotes.find(n => n.id === selectedNoteId), 
  [planetNotes, selectedNoteId]);

  const growingNotes = useMemo(() => planetNotes.filter(n => n.isGrowth && !n.inbox && !n.paused && n.growthStage !== 'bloom'), [planetNotes]);

  const gardenStats = useMemo(() => {
    const total = planetNotes.filter(n => !n.inbox).length;
    const completed = planetNotes.filter(n => !n.inbox && n.growthStage === 'bloom').length;
    const active = planetNotes.filter(n => !n.inbox && n.growthStage === 'sprout').length;
    const seeds = planetNotes.filter(n => !n.inbox && n.growthStage === 'seed').length;
    const watering = planetNotes.filter(n => !n.inbox && !n.paused && n.growthStage !== 'bloom' && wateringDue(n)).length;

    return { total, completed, active, seeds, watering };
  }, [planetNotes]);

  const getProgress = (note: SeedNote) => {
    if (!note.tasks.length) return 0;
    const completed = note.tasks.filter(t => t.completed).length;
    return Math.round((completed / note.tasks.length) * 100);
  };

  const exportGarden = () => {
    const markdown = planetNotes.map(note => {
      const status = note.inbox ? 'Semillero' : note.paused ? 'Pausada' : STAGE_META[note.growthStage].label;
      const tasks = note.tasks.length ? `\n\n${note.tasks.map(task => `- [${task.completed ? 'x' : ' '}] ${task.text}`).join('\n')}` : '';
      const reflection = note.reflection ? `\n\nReflexión: ${note.reflection}` : '';
      return `# ${note.title}\n\nEstado: ${status}\nTipo: ${note.seedType || 'idea'}\n\n${note.content}${tasks}${reflection}`;
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
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: Date.now(), notes }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seed-backup-${format(Date.now(), 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedNotes = Array.isArray(parsed) ? parsed : parsed.notes;
    if (!Array.isArray(importedNotes)) {
      window.alert('El archivo no parece ser un backup de Seed.');
      return;
    }
    if (!window.confirm(`Importar ${importedNotes.length} ideas? Esto reemplazará tu jardín actual.`)) return;
    setNotes(importedNotes);
    setSelectedNoteId(null);
    setShowSettings(false);
  };

  const clearGardenData = () => {
    if (!window.confirm('Borrar todo tu jardín? Esta acción no se puede deshacer.')) return;
    if (!window.confirm('Confirmación final: se eliminarán todas las ideas, cosechas y rachas locales.')) return;
    setNotes([]);
    setSelectedNoteId(null);
    setWateringRitual({ lastDate: '', streak: 0 });
    localStorage.removeItem('seed-last-notification-day');
    setShowSettings(false);
  };

  const finishOnboarding = () => {
    localStorage.setItem('seed-onboarded', 'true');
    setShowOnboarding(false);
  };

  const startPlanting = () => {
    setSelectedNoteId(null);
    setFilterStage('all');
    setSearch('');
    setView('garden');
    setIsAdding(true);
  };

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
  };

  const addPlanet = () => {
    const name = newPlanetName.trim();
    if (!name) return;
    const planet: Planet = touchPlanet({
      id: crypto.randomUUID(),
      name,
      description: 'Nuevo espacio para cultivar ideas.',
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
      window.alert('Necesitas al menos un planeta para guardar tus ideas.');
      return;
    }

    const ideasInPlanet = notes.filter(note => (note.planetId || DEFAULT_PLANET_ID) === activePlanet.id).length;
    if (!window.confirm(`Borrar el planeta "${activePlanet.name}"? Se eliminarán ${ideasInPlanet} ideas de este planeta. Esta acción no se puede deshacer.`)) return;
    if (!window.confirm('Confirmación final: borrar este planeta y sus ideas permanentemente?')) return;

    const nextPlanet = planets.find(planet => planet.id !== activePlanet.id) || DEFAULT_PLANETS[0];
    setNotes(current => current.filter(note => (note.planetId || DEFAULT_PLANET_ID) !== activePlanet.id));
    setPlanets(current => current.filter(planet => planet.id !== activePlanet.id));
    if (session?.user) {
      deletePlanetFromSupabase(activePlanet.id, session.user).catch(error => {
        setSyncStatus(error instanceof Error ? error.message : 'No se pudo borrar el planeta en la nube.');
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

    setAuthStatus('Creando cuenta...');
    const { error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
    });
    setAuthStatus(error ? formatAuthError(error.message) : 'Cuenta creada. Revisa tu correo si Supabase pide confirmación.');
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
    setAuthStatus(error ? formatAuthError(error.message) : 'Sesión iniciada.');
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
      setSyncStatus(`Sincronizado: ${synced.planets.length} planetas y ${synced.notes.length} ideas.`);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'No se pudo sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const enterApp = () => {
    localStorage.setItem('seed-landing-seen', 'true');
    setShowLanding(false);
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
      setFocusNoteId(note.id);
      setView('focus');
      return;
    }

    if (action === 'pause') {
      togglePauseNote(note.id);
      return;
    }

    setSelectedNoteId(note.id);
  };

  if (showLanding) {
    return <LandingPage onEnter={enterApp} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-transparent text-[var(--text-main)] font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 max-h-[46vh] md:max-h-none bg-[var(--sidebar-bg)]/80 backdrop-blur-xl border-b md:border-b-0 md:border-r border-[var(--border)] p-4 md:p-8 flex flex-col shrink-0 overflow-y-auto app-scrollbar z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.02)_inset]">
        <motion.div 
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-6 group cursor-pointer"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-[var(--seed-primary)] rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="relative w-12 h-12 bg-gradient-to-br from-[var(--seed-primary)] to-[var(--sage)] rounded-2xl flex items-center justify-center shadow-xl shadow-[var(--sage)]/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <Leaf className="text-white sway" size={26} />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-serif font-black text-[var(--sage)] leading-none">Seed</h1>
            <p className="text-[9px] font-black tracking-[0.3em] uppercase text-[var(--seed-accent)] opacity-60">Digital Garden</p>
          </div>
        </motion.div>

        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between px-4">
            <p className="text-[10px] uppercase font-black text-[var(--seed-accent)] tracking-[0.25em] opacity-50">Planetas</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={openPlanetSettings}
                className="h-7 w-7 rounded-full bg-[var(--surface-strong)] text-[var(--sage)] flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
                aria-label="Editar planeta activo"
                title="Editar planeta activo"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={() => { setIsAddingPlanet(!isAddingPlanet); setShowPlanetSettings(false); }}
                className="h-7 w-7 rounded-full bg-[var(--surface-strong)] text-[var(--sage)] flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
                aria-label="Agregar planeta"
                title="Agregar planeta"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {isAddingPlanet && (
            <div className="rounded-2xl bg-[var(--surface-soft)] border border-[var(--border)] p-3">
              <input
                autoFocus
                value={newPlanetName}
                onChange={(event) => setNewPlanetName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addPlanet();
                  if (event.key === 'Escape') setIsAddingPlanet(false);
                }}
                placeholder="Nombre del planeta..."
                className="w-full bg-[var(--surface-strong)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--sage)]"
              />
              <button
                onClick={addPlanet}
                disabled={!newPlanetName.trim()}
                className="mt-2 w-full rounded-xl bg-[var(--sage)] disabled:opacity-40 text-white py-2 text-xs font-black"
              >
                Crear planeta
              </button>
            </div>
          )}

          {showPlanetSettings && (
            <div className="rounded-2xl bg-[var(--surface-soft)] border border-[var(--border)] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--seed-accent)] mb-2">Planeta activo</p>
              <input
                autoFocus
                value={editingPlanetName}
                onChange={(event) => setEditingPlanetName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') renameActivePlanet();
                  if (event.key === 'Escape') setShowPlanetSettings(false);
                }}
                className="w-full bg-[var(--surface-strong)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--sage)]"
              />
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <button
                  onClick={renameActivePlanet}
                  disabled={!editingPlanetName.trim()}
                  className="rounded-xl bg-[var(--sage)] disabled:opacity-40 text-white py-2 text-xs font-black"
                >
                  Guardar nombre
                </button>
                <button
                  onClick={deleteActivePlanet}
                  className="rounded-xl bg-red-50 text-red-500 px-3 py-2 text-xs font-black border border-red-100 hover:bg-red-100 transition-colors"
                  title="Borrar planeta"
                  aria-label="Borrar planeta activo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2 px-1 app-scrollbar snap-x snap-mandatory">
            {planets.map((planet) => {
              const count = notes.filter(note => (note.planetId || DEFAULT_PLANET_ID) === planet.id).length;
              return (
                <button
                  key={planet.id}
                  onClick={() => switchPlanet(planet.id)}
                  className={`snap-start shrink-0 w-28 rounded-2xl px-3 py-3 soft-interaction text-left ${
                    activePlanet.id === planet.id
                      ? 'bg-[var(--surface-strong)] shadow-xl shadow-black/5 text-[var(--sage)] ring-1 ring-black/5'
                      : 'text-[var(--earth)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  <span className="h-9 w-9 rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center font-serif font-black text-sm">
                    {planet.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="block min-w-0 mt-3">
                    <span className="block text-sm font-black truncate">{planet.name}</span>
                    <span className="block text-[10px] font-bold text-[var(--text-muted)]">{count} ideas</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 mb-8 md:mb-12">
          {[
            {
              title: 'Trabajo',
              items: [
                { id: 'today', label: 'Hoy', icon: Droplets },
                { id: 'garden', label: 'Jardín de ideas', icon: LayoutGrid },
                { id: 'focus', label: 'Concentración', icon: Target },
              ],
            },
            {
              title: 'Espacios',
              items: [
                { id: '3D', label: 'Planeta', icon: Box },
                { id: 'calendar', label: 'Calendario', icon: CalendarIcon },
                { id: 'harvest', label: 'Cosechas', icon: Archive },
              ],
            },
          ].map((section) => (
            <div key={section.title} className="space-y-1.5">
              <p className="text-[10px] uppercase font-black text-[var(--seed-accent)] px-4 mb-2 tracking-[0.25em] opacity-50">{section.title}</p>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl soft-interaction relative group ${
                    view === item.id
                      ? 'bg-[var(--surface-strong)] shadow-xl shadow-black/5 text-[var(--sage)] ring-1 ring-black/5'
                      : 'text-[var(--earth)] hover:bg-[var(--surface-soft)]'
                  }`}
                >
                  {view === item.id && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute left-2 w-1 h-5 bg-[var(--sage)] rounded-full"
                    />
                  )}
                  <item.icon size={18} className={view === item.id ? 'text-[var(--sage)]' : 'text-[var(--earth)] opacity-70'} />
                  <span className="font-bold tracking-tight text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <button 
          onClick={startPlanting}
          className="mb-8 bg-[var(--sage)] hover:bg-[var(--ink)] text-white w-full py-4.5 rounded-[2rem] font-black shadow-2xl shadow-[var(--sage)]/30 soft-interaction items-center justify-center gap-3 hidden md:flex active:translate-y-px active:shadow-inner"
        >
          <Plus size={20} strokeWidth={3} />
          <span className="tracking-tight">Plantar Idea</span>
        </button>

        <div className="mt-auto space-y-6">
          <div className="flex items-center gap-4 px-2 py-4 border-t border-[var(--border)]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--sage)] to-[var(--seed-accent)] flex items-center justify-center text-white font-serif font-bold italic shadow-lg ring-2 ring-[var(--surface-strong)]">
              {accountInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-[var(--earth)] truncate">{account.name || 'Jardinero Digital'}</p>
              <p className="text-[10px] font-medium text-[var(--text-muted)] truncate">{account.email || 'Sin correo'}</p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
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
        <section className={`flex-1 p-4 sm:p-6 md:p-10 overflow-y-auto app-scrollbar bg-transparent transition-all duration-300 ${selectedNoteId ? 'md:mr-[400px]' : ''}`}>
          <div className="max-w-4xl mx-auto">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start gap-5 md:gap-6">
              <div className="w-full">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-end justify-between gap-4"
                >
                  <div>
                    <h2 className="text-3xl md:text-4xl font-serif font-semibold text-[var(--earth)] leading-none">{activePlanet.name}</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-2 italic">{activePlanet.description || 'Cada nota es el comienzo de algo grande.'}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-2 shadow-sm">
                    <TrendingUp size={16} className="text-[var(--sage)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)]">{planetNotes.length} ideas</span>
                  </div>
                </motion.div>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[
                    { id: 'seed', label: 'Semillas', value: gardenStats.seeds, tone: 'bg-amber-100 text-amber-700' },
                    { id: 'sprout', label: 'Brotes', value: gardenStats.active, tone: 'bg-emerald-100 text-emerald-700' },
                    { id: 'bloom', label: 'Cosechas', value: gardenStats.completed, tone: 'bg-green-100 text-green-700' },
                  ].map((stat) => (
                    <motion.button
                      key={stat.label}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setFilterStage(filterStage === stat.id ? 'all' : stat.id as SeedNote['growthStage']);
                        setSelectedNoteId(null);
                        setView('garden');
                      }}
                      className={`rounded-2xl border px-4 py-3 shadow-sm text-left soft-interaction ${filterStage === stat.id ? 'bg-[var(--surface-strong)] border-[var(--sage)] ring-1 ring-[var(--sage)]/30' : 'bg-[var(--surface-soft)] border-[var(--border)] hover:bg-[var(--surface-strong)]'}`}
                    >
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{stat.label}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-2xl font-serif font-black text-[var(--earth)]">{stat.value}</span>
                        <span className={`h-7 w-7 rounded-full flex items-center justify-center ${stat.tone}`}>
                          <Circle size={10} fill="currentColor" />
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
                {growingNotes.length > 7 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-start gap-3"
                  >
                    <Pause size={18} className="text-amber-700 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800">
                      Tienes {growingNotes.length} brotes activos. Para avanzar mejor, pausa algunos o usa Enfoque.
                    </p>
                  </motion.div>
                )}
              </div>
              <div className="relative w-full md:w-64 md:mt-[5.75rem]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                <input
                  type="text"
                  placeholder="Buscar en el jardín..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-[var(--surface-soft)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--sage)] focus:bg-[var(--surface-strong)] transition-all text-sm"
                />
              </div>
            </header>

            <AnimatePresence mode="popLayout" initial={false}>
              {view === 'today' ? (
                <TodayView
                  notes={planetNotes}
                  quickNote={quickNote}
                  setQuickNote={setQuickNote}
                  onQuickCapture={addQuickNote}
                  onOpenWatering={openWatering}
                  onSelectNote={setSelectedNoteId}
                  onToggleTask={toggleTask}
                  onFocusNote={(id) => {
                    setFocusNoteId(id);
                    setView('focus');
                  }}
                  onEnableNotifications={enableNotifications}
                  onNavigate={setView}
                  onShowWateringQueue={showWateringQueue}
                  wateredToday={wateredToday}
                  wateringStreak={wateringRitual.streak}
                  getProgress={getProgress}
                />
              ) : view === 'inbox' ? (
                <InboxView
                  notes={planetNotes}
                  onCultivate={cultivateInboxNote}
                  onSaveLater={saveInboxForLater}
                  onDelete={deleteNote}
                  onSelectNote={setSelectedNoteId}
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
                  onLogFocus={logFocusMinutes}
                  onPickFocus={setFocusNoteId}
                  onExit={() => setView('today')}
                />
              ) : view === 'harvest' ? (
                <HarvestView notes={planetNotes} onSelectNote={setSelectedNoteId} />
              ) : view === 'garden' ? (
                <motion.div
                  key="garden-view"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-5 flex gap-2 overflow-x-auto pb-2 app-scrollbar">
                    {[
                      { id: 'all', label: 'Todo el jardín', count: gardenStats.total },
                      { id: 'water', label: 'Por regar', count: gardenStats.watering },
                      { id: 'seed', label: 'Semillas', count: gardenStats.seeds },
                      { id: 'sprout', label: 'Brotes', count: gardenStats.active },
                      { id: 'bloom', label: 'Cosechas', count: gardenStats.completed },
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
                              ? 'bg-[var(--sage)] text-white border-[var(--sage)] shadow-lg shadow-[var(--sage)]/20'
                              : 'bg-[var(--surface-soft)] text-[var(--earth)] border-[var(--border)] hover:bg-[var(--surface-strong)]'
                          }`}
                        >
                          {item.label} <span className={isActive ? 'text-white/70' : 'text-[var(--text-muted)]'}>{item.count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isAdding && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-[var(--surface-strong)] p-8 rounded-3xl border border-[var(--seed-accent)] mb-8 shadow-xl relative"
                    >
                      <button onClick={() => setIsAdding(false)} className="absolute top-6 right-6 text-[var(--text-muted)] hover:text-red-500" aria-label="Cerrar formulario">
                        <X size={20} />
                      </button>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--seed-accent)] mb-4">Plantando en {activePlanet.name}</p>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Título de la idea..."
                        value={newNote.title}
                        onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                        className="text-2xl font-serif font-bold bg-transparent outline-none mb-4 w-full placeholder:opacity-30"
                      />
                      <textarea
                        placeholder="Escribe aquí tu pensamiento..."
                        rows={4}
                        value={newNote.content}
                        onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                        className="bg-transparent outline-none resize-none text-[var(--text-main)] w-full placeholder:opacity-30 mb-6 leading-relaxed"
                      />
                      <div className="mb-8 p-4 bg-[var(--bg-app)] rounded-xl flex items-center gap-4">
                        <CalendarIcon className="text-[var(--sage)]" size={20} />
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-[var(--sage)] uppercase mb-1">Fecha límite (Opcional)</p>
                          <input 
                            type="date"
                            value={newNote.dueDate}
                            onChange={(e) => setNewNote({ ...newNote, dueDate: e.target.value })}
                            className="bg-transparent outline-none text-sm w-full"
                          />
                        </div>
                      </div>
                      <div className="mb-8">
                        <p className="text-[10px] font-bold text-[var(--sage)] uppercase mb-3">Tipo de semilla</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {SEED_TYPES.map(type => (
                            <button
                              key={type.id}
                              onClick={() => setNewNote({ ...newNote, seedType: type.id })}
                              className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                                newNote.seedType === type.id
                                  ? 'bg-[var(--sage)] text-white shadow-md'
                                  : 'bg-[var(--bg-app)] text-[var(--sage)] hover:bg-[var(--surface-strong)]'
                              }`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={addNote}
                          disabled={!newNote.content.trim()}
                          className="bg-[var(--sage)] text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 hover:brightness-105 soft-interaction shadow-md active:translate-y-px"
                        >
                          Plantar idea
                        </button>
                        <button onClick={() => setIsAdding(false)} className="px-6 py-3 text-sm font-medium hover:bg-[var(--surface-hover)] rounded-xl transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                    {filteredNotes.map((note) => {
                      const progress = getProgress(note);
                      const stageMeta = STAGE_META[note.growthStage];
                      const nextTask = note.tasks.find(task => !task.completed);
                      const guidance = getIdeaGuidance(note);

                      return (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        whileHover={{ y: -4 }}
                        whileTap={{ y: -1 }}
                        transition={{ type: 'tween', duration: 0.18 }}
                        onClick={() => setSelectedNoteId(note.id)}
                        className={`seed-card bg-[var(--surface-strong)] border group relative cursor-pointer overflow-hidden ${
                          selectedNoteId === note.id 
                            ? 'border-[var(--sage)] shadow-xl ring-2 ring-[var(--sage)]/35' 
                            : 'border-[var(--border)] shadow-[0_12px_34px_rgb(47,62,51,0.08)] hover:border-[var(--seed)]/55 hover:shadow-[0_18px_52px_rgb(47,62,51,0.12)]'
                        }`}
                      >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                        <div className={`h-52 bg-gradient-to-b ${stageMeta.aura} relative flex items-center justify-center pt-8 overflow-hidden`}>
                          <div className="seed-card-sheen" />
                          <div className="absolute inset-x-8 bottom-7 h-8 rounded-full bg-[#3e2723]/10 blur-xl" />
                          <div className="absolute bottom-5 w-3/5 h-3 bg-[#3e2723]/20 rounded-full" />
                          <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full bg-[var(--surface-soft)] border border-[var(--border)] px-3 py-1.5 shadow-sm backdrop-blur">
                            <span className={`w-2 h-2 rounded-full ${stageMeta.bg}`} />
                            <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${stageMeta.color}`}>
                              {guidance.label}
                            </span>
                          </div>
                          
                          <motion.div
                            className="relative z-10"
                            animate={{ y: note.growthStage === 'withered' ? 0 : [0, -2, 0] }}
                            transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <PlantIllustration 
                              stage={note.growthStage} 
                              progress={progress} 
                              isGrowth={note.isGrowth} 
                              theme={activePlanet.theme || theme}
                            />
                          </motion.div>
                        </div>

                        <div className="p-6">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${stageMeta.bg} ${stageMeta.color}`}>
                                {stageMeta.label}
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] opacity-60">
                                {new Date(note.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 text-[var(--text-muted)] hover:text-red-500 soft-interaction p-2 bg-[var(--surface-soft)] rounded-full"
                              aria-label={`Eliminar ${note.title}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <h3 className={`text-2xl font-serif font-bold mb-3 leading-tight transition-colors ${selectedNoteId === note.id ? 'text-[var(--sage)]' : note.growthStage === 'withered' ? 'text-[var(--text-muted)]' : 'text-[var(--earth)]'}`}>{note.title}</h3>
                          <p className="text-sm leading-relaxed text-[var(--text-muted)] line-clamp-2 min-h-[2.75rem]">
                            {note.content}
                          </p>

                          <div className={`mt-5 rounded-2xl border px-4 py-3 ${guidance.tone}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-70">Ahora</p>
                                <p className="mt-1 text-sm font-black leading-tight">{guidance.title}</p>
                                <p className="mt-1 text-xs font-semibold leading-relaxed opacity-75 line-clamp-2">{guidance.detail}</p>
                              </div>
                              {guidance.kind === 'water' ? <Droplets size={18} className="shrink-0 mt-1" /> :
                               guidance.kind === 'focus' ? <Target size={18} className="shrink-0 mt-1" /> :
                               guidance.kind === 'grow' ? <Sprout size={18} className="shrink-0 mt-1" /> :
                               guidance.kind === 'pause' ? <Pause size={18} className="shrink-0 mt-1" /> :
                               <ArrowRight size={18} className="shrink-0 mt-1" />}
                            </div>
                          </div>
                          
                          {note.dueDate && (
                            <div className={`flex items-center gap-2 text-[11px] font-black mt-4 ${note.growthStage === 'withered' ? 'text-red-400' : 'text-[var(--seed)]'}`}>
                              {note.growthStage === 'withered' ? <Skull size={14} /> : <CalendarIcon size={14} />}
                              <span className="uppercase tracking-widest">{note.growthStage === 'withered' ? 'MARCHITA' : 'COSECHA'}: {format(note.dueDate, 'd MMM')}</span>
                            </div>
                          )}

                          {note.isGrowth && (
                            <div className="mt-8">
                              {nextTask && (
                                <div className="mb-4 rounded-2xl bg-[var(--bg-app)] px-4 py-3 border border-[var(--border)]">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--sage)] mb-1">Siguiente paso</p>
                                  <p className="text-sm font-semibold text-[var(--earth)] line-clamp-1">{nextTask.text || 'Describe el siguiente paso'}</p>
                                </div>
                              )}
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black text-[var(--sage)] tracking-[0.2em]">DESARROLLO</span>
                                <span className="text-xs font-black text-[var(--sage)]">{progress}%</span>
                              </div>
                              <div className="h-2.5 w-full bg-[var(--surface-soft)] rounded-full overflow-hidden p-0.5 border border-[var(--border)]">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                                  className={`h-full rounded-full ${note.growthStage === 'bloom' ? 'bg-green-500' : 'bg-[var(--sage)]'}`}
                                />
                              </div>
                            </div>
                          )}

                          <div className="mt-6 pt-5 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                              <span>{note.tasks.length} pasos</span>
                              <span>{note.connections?.length || 0} vínculos</span>
                              <span>{note.focusedMinutes || 0} min</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  runCardAction(note, guidance.kind);
                                }}
                                className={`h-9 rounded-full px-3 flex items-center gap-1.5 justify-center text-[10px] font-black uppercase tracking-widest soft-interaction shadow-sm active:translate-y-px ${guidance.actionTone}`}
                                title={guidance.title}
                              >
                                {guidance.kind === 'water' ? <Droplets size={15} /> :
                                 guidance.kind === 'focus' ? <Target size={15} /> :
                                 guidance.kind === 'grow' ? <Sprout size={15} /> :
                                 guidance.kind === 'pause' ? <Pause size={15} /> :
                                 <ArrowRight size={15} />}
                                <span>{guidance.action}</span>
                              </button>
                              <ArrowRight size={16} className="text-[var(--sage)] opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
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
                />
              ) : (
                <motion.div
                  key="3d-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
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
                      notes={filteredNotes} 
                      theme={activePlanet.theme || theme}
                      planetName={activePlanet.name}
                      onSelectNote={setSelectedNoteId} 
                      onReviewNote={openWatering}
                      onFocusNote={(id) => {
                        setFocusNoteId(id);
                        setView('focus');
                      }}
                      recentlyWateredId={recentlyWateredId}
                    />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>

            {filteredNotes.length === 0 && !isAdding && view === 'garden' && (
              <div className="text-center py-24 flex flex-col items-center rounded-[2rem] bg-[var(--surface-soft)] border border-[var(--border)]">
                <div className="relative mb-8">
                  <Leaf className="text-[var(--seed)] opacity-10" size={120} />
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Sprout size={48} className="text-[var(--sage)] opacity-20" />
                  </motion.div>
                </div>
                <p className="text-[var(--earth)] opacity-50 font-serif italic text-2xl max-w-xs mx-auto leading-relaxed">
                  {search || filterStage !== 'all'
                    ? 'No hay ideas con este filtro. Prueba Colección Total o busca otra palabra.'
                    : 'Escribe una idea que no quieres perder. No tiene que estar perfecta.'}
                </p>
                <motion.button 
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  onClick={() => {
                    startPlanting();
                  }}
                  className="mt-10 bg-[var(--sage)] text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-[var(--sage)]/20 soft-interaction hover:brightness-110"
                >
                  Plantar mi primera semilla
                </motion.button>
              </div>
            )}
          </div>
        </section>

        {/* Selected Note Detail Panel (Focus Mode) */}
        <AnimatePresence>
          {selectedNoteId && selectedNote && (
            <motion.aside 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full md:w-[400px] bg-[var(--surface-strong)] border-l border-[var(--border)] shadow-2xl flex flex-col z-30"
            >
              <div className="p-8 pb-4 flex justify-between items-center border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedNote.growthStage === 'bloom' ? 'bg-green-500' : 
                    selectedNote.growthStage === 'withered' ? 'bg-red-500' : 'bg-[var(--seed)]'
                  }`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {selectedNote.inbox ? 'Semilla en semillero' :
                     selectedNote.growthStage === 'bloom' ? 'Idea Cosechada' : 
                     selectedNote.growthStage === 'withered' ? 'Idea Marchita' :
                     selectedNote.isGrowth ? 'Idea en Brote' : 'Semilla'}
                  </span>
                </div>
                <button onClick={() => setSelectedNoteId(null)} className="p-2 hover:bg-[var(--surface-hover)] rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto app-scrollbar p-8">
                {/* Large Visual Representation */}
                <div className={`mb-10 h-48 bg-gradient-to-b ${STAGE_META[selectedNote.growthStage].aura} rounded-[2rem] flex items-center justify-center relative overflow-hidden border border-[var(--border)] shadow-sm`}>
                  <div className="seed-card-sheen" />
                  <div className="absolute bottom-5 w-2/3 h-4 bg-[#3e2723]/10 rounded-full blur-sm" />
                  <PlantIllustration 
                    stage={selectedNote.growthStage} 
                    progress={getProgress(selectedNote)} 
                    isGrowth={selectedNote.isGrowth} 
                    theme={activePlanet.theme || theme}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {selectedNote.inbox ? (
                    <button
                      onClick={() => cultivateInboxNote(selectedNote.id)}
                    className="col-span-2 rounded-2xl bg-[var(--sage)] text-white px-4 py-3 flex items-center justify-center gap-2 text-xs font-black hover:brightness-105 soft-interaction"
                    >
                      <Sprout size={16} /> Mover al jardín
                    </button>
                  ) : null}
                  <button
                    onClick={() => openWatering(selectedNote.id)}
                    disabled={selectedNote.growthStage === 'bloom'}
                    className="rounded-2xl bg-[var(--bg-app)] disabled:opacity-40 border border-[var(--border)] px-4 py-3 flex items-center justify-center gap-2 text-xs font-black text-[var(--sage)] hover:bg-[var(--surface-strong)] transition-colors"
                  >
                    <Droplets size={16} /> Revisar
                  </button>
                  <button
                    onClick={() => togglePauseNote(selectedNote.id)}
                    disabled={selectedNote.growthStage === 'bloom'}
                    className="rounded-2xl bg-[var(--bg-app)] disabled:opacity-40 border border-[var(--border)] px-4 py-3 flex items-center justify-center gap-2 text-xs font-black text-[var(--sage)] hover:bg-[var(--surface-strong)] transition-colors"
                  >
                    <Pause size={16} /> {selectedNote.paused ? 'Reactivar' : 'Pausar'}
                  </button>
                </div>

                <div className="mb-8 rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[var(--seed-accent)] tracking-widest">TIEMPO DE ENFOQUE</p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Minutos protegidos para esta idea</p>
                  </div>
                  <span className="font-mono text-2xl font-black text-[var(--earth)]">{selectedNote.focusedMinutes || 0}m</span>
                </div>

                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                  className="text-2xl font-serif font-bold text-[var(--earth)] bg-transparent outline-none w-full mb-6"
                  placeholder="Sin título"
                />
                
                <p className="text-[10px] uppercase font-bold text-[var(--seed-accent)] mb-2 tracking-widest">PENSAMIENTO PROFUNDO</p>
                <textarea
                  value={selectedNote.content}
                  onChange={(e) => updateNote(selectedNote.id, { content: e.target.value })}
                  rows={8}
                  className="text-[var(--text-main)] bg-transparent outline-none w-full leading-relaxed resize-none mb-6 placeholder:opacity-20"
                  placeholder="Profundiza en tu idea aquí..."
                />

                <div className="mb-6">
                  <p className="text-[10px] uppercase font-bold text-[var(--seed-accent)] mb-3 tracking-widest">TIPO DE SEMILLA</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SEED_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => updateNote(selectedNote.id, { seedType: type.id })}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${
                          (selectedNote.seedType || 'idea') === type.id
                            ? 'bg-[var(--sage)] text-white'
                            : 'bg-[var(--bg-app)] text-[var(--sage)] hover:bg-[var(--surface-strong)]'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] uppercase font-bold text-[var(--seed-accent)] tracking-widest">CONEXIONES NEURONALES</p>
                    <button 
                      onClick={() => setIsLinking(!isLinking)}
                      className="text-[10px] bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 transition-colors"
                    >
                      {isLinking ? 'CERRAR' : 'EDITAR'}
                    </button>
                  </div>
                  
                  {isLinking ? (
                    <div className="space-y-1 mb-4 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl">
                      {planetNotes.filter(n => n.id !== selectedNote.id).map(n => {
                        const isConnected = selectedNote.connections?.includes(n.id);
                        return (
                          <button
                            key={n.id}
                            onClick={() => toggleConnection(selectedNote.id, n.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs flex justify-between items-center ${isConnected ? 'bg-green-100 text-green-700' : 'hover:bg-[var(--surface-strong)]'}`}
                          >
                            <span>{n.title}</span>
                            {isConnected && <CheckCircle2 size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedNote.connections?.map(id => {
                        const target = planetNotes.find(n => n.id === id);
                        if (!target) return null;
                        return (
                          <button 
                            key={id}
                            onClick={() => setSelectedNoteId(id)}
                            className="text-[10px] bg-slate-50 px-3 py-1 rounded-full border border-slate-100 text-slate-600 hover:bg-[var(--surface-strong)] hover:shadow-sm"
                          >
                            {target.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mb-10 flex items-center gap-4 p-4 bg-[var(--bg-app)] rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-[var(--surface-strong)] flex items-center justify-center text-[var(--sage)] shadow-sm">
                    <CalendarIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[var(--sage)] uppercase mb-1">Fecha de Cosecha</p>
                    <input 
                      type="date"
                      value={selectedNote.dueDate ? new Date(selectedNote.dueDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateNote(selectedNote.id, { dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined })}
                      className="bg-transparent outline-none text-sm font-semibold w-full"
                    />
                  </div>
                </div>

                <div className="mb-10">
                  <p className="text-[10px] uppercase font-bold text-[var(--seed-accent)] mb-3 tracking-widest">FRECUENCIA DE RIEGO</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 1, label: 'Diario' },
                      { value: 3, label: '3 días' },
                      { value: 7, label: 'Semanal' },
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => updateNote(selectedNote.id, { wateringIntervalDays: option.value })}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${
                          (selectedNote.wateringIntervalDays || 1) === option.value
                            ? 'bg-[var(--sage)] text-white'
                            : 'bg-[var(--bg-app)] text-[var(--sage)] hover:bg-[var(--surface-strong)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!selectedNote.isGrowth ? (
                  <div className={`p-6 rounded-2xl border border-dashed text-center ${
                    selectedNote.growthStage === 'withered' ? 'bg-red-50 border-red-200' : 'bg-[var(--bg-app)] border-[var(--sage)]'
                  }`}>
                    <p className="text-sm italic opacity-70 mb-4">
                      {selectedNote.growthStage === 'withered' 
                        ? '"Esta semilla se ha marchitado por el tiempo, pero aún puede renacer."' 
                        : '"Para que esta semilla crezca, necesita una acción."'}
                    </p>
                    <button 
                      onClick={() => growNote(selectedNote.id)}
                      className={`${
                        selectedNote.growthStage === 'withered' ? 'bg-red-500' : 'bg-[var(--sage)]'
                      } text-white w-full py-4 rounded-xl font-bold shadow-md hover:brightness-105 soft-interaction flex items-center justify-center gap-2`}
                    >
                      <span>{selectedNote.growthStage === 'withered' ? 'Revivir y Cultivar' : 'Cultivar Idea'}</span>
                      <Sprout size={18} />
                    </button>
                    <p className="text-[9px] mt-4 opacity-50 uppercase tracking-tighter">Convierte este pensamiento en un proyecto accionable</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] uppercase font-bold text-[var(--seed-accent)] tracking-widest">PASOS DE CRECIMIENTO</p>
                      <span className="text-[10px] bg-[var(--bg-app)] px-2 py-0.5 rounded-full text-[var(--sage)] font-bold">
                        {getProgress(selectedNote)}% COMPLETADO
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      <AnimatePresence>
                        {selectedNote.tasks.map(task => (
                          <motion.div 
                            key={task.id} 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-start gap-3 group/task"
                          >
                            <button 
                              onClick={() => toggleTask(selectedNote.id, task.id)}
                              className={`w-6 h-6 rounded-lg border-2 transition-all mt-0.5 shrink-0 flex items-center justify-center ${task.completed ? 'bg-[var(--sage)] border-[var(--sage)]' : 'border-[var(--border)] hover:border-[var(--sage)]'}`}
                            >
                              {task.completed && <CheckCircle2 className="text-white" size={14} />}
                            </button>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={task.text}
                                onChange={(e) => updateTask(selectedNote.id, task.id, e.target.value)}
                                className={`text-sm bg-transparent outline-none w-full transition-all ${task.completed ? 'line-through opacity-40 italic' : ''}`}
                                placeholder="Describe el paso..."
                              />
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <button 
                        onClick={() => addTask(selectedNote.id)}
                        className="text-xs font-bold text-[var(--sage)] flex items-center gap-2 hover:translate-x-1 transition-transform"
                      >
                        <Plus size={14} /> <span>Añadir siguiente paso</span>
                      </button>
                    </div>

                    <div className="mt-12 pt-8 border-t border-[var(--border)] text-center">
                      {selectedNote.growthStage === 'bloom' ? (
                        <div>
                          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity }}>
                            <CheckCircle2 className="mx-auto text-green-500 mb-4" size={32} />
                          </motion.div>
                          <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-4">¡Idea Cosechada con Éxito!</p>
                          <textarea
                            value={selectedNote.reflection || ''}
                            onChange={(e) => updateNote(selectedNote.id, { reflection: e.target.value })}
                            rows={3}
                            className="w-full rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-3 text-sm outline-none resize-none"
                            placeholder="Qué aprendiste de esta cosecha?"
                          />
                        </div>
                      ) : selectedNote.growthStage === 'withered' ? (
                        <div>
                          <Skull className="mx-auto text-red-400 mb-4 opacity-50" size={32} />
                          <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Esta planta se ha marchitado</p>
                          <p className="text-[10px] opacity-40 mt-1">Llegaste tarde a la cosecha.</p>
                        </div>
                      ) : (
                        <p className="text-[10px] italic opacity-40 italic">Completa todos los pasos para ver esta idea florecer.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-[var(--border)] bg-[var(--surface-soft)] flex justify-between items-center">
                 <button 
                   onClick={() => deleteNote(selectedNote.id)}
                   className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-2"
                 >
                   <Trash2 size={14} /> Eliminar Semilla
                 </button>
                 <span className="text-[10px] font-mono opacity-30">REF: {selectedNote.id.split('-')[0]}</span>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {wateringNoteId && (() => {
            const note = notes.find(n => n.id === wateringNoteId);
            if (!note) return null;

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                onClick={() => setWateringNoteId(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  className="w-full max-w-md rounded-[2rem] bg-[var(--surface-strong)] shadow-2xl border border-[var(--border)] p-6"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Riego rápido</p>
                      <h3 className="text-2xl font-serif font-black text-[var(--earth)] mt-1">20 segundos para no perderla</h3>
                    </div>
                    <button onClick={() => setWateringNoteId(null)} className="p-2 rounded-full hover:bg-[var(--bg-app)] transition-colors">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-4 mb-4">
                    <p className="font-bold text-[var(--earth)]">{note.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      Regar no significa trabajar. Solo mira la idea y decide una acción ligera: sigue viva, necesita un micro-paso o puede pausar.
                    </p>
                  </div>

                  <textarea
                    value={wateringNote}
                    onChange={(event) => setWateringNote(event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-4 text-sm outline-none resize-none focus:bg-[var(--surface-strong)] focus:ring-1 focus:ring-[var(--sage)] transition-all"
                    placeholder="Opcional: qué la bloquea o qué sigue?"
                  />

                  <div className="grid grid-cols-1 gap-3 mt-5">
                    <button
                      onClick={() => waterNote(note.id, wateringNote.trim() || 'Riego rápido: sigue viva')}
                      className="w-full rounded-2xl bg-[var(--sage)] text-white px-4 py-3 font-black flex items-center justify-center gap-2 shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
                    >
                      <Droplets size={17} /> Sigue viva
                    </button>
                    <button
                      onClick={() => addTinyStep(note.id)}
                      className="w-full rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] px-4 py-3 font-black flex items-center justify-center gap-2 border border-[var(--border)] hover:bg-[var(--surface-strong)] transition-colors"
                    >
                      <Plus size={17} /> Crear micro-paso y enfocar
                    </button>
                    <div className="flex items-center justify-between px-2 pt-1 text-[11px] font-black">
                      <button
                        onClick={() => { togglePauseNote(note.id); recordWateringRitual(); markRecentlyWatered(note.id); setWateringNoteId(null); }}
                        className="text-stone-500 hover:text-[var(--sage)] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Pause size={13} /> Pausar sin culpa
                      </button>
                      <button
                        onClick={() => { setSelectedNoteId(note.id); setWateringNoteId(null); }}
                        className="text-stone-500 hover:text-[var(--sage)] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ArrowRight size={13} /> Abrir detalle
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
              className="fixed left-1/2 top-8 -translate-x-1/2 z-[60] rounded-full bg-[var(--surface-strong)] border border-[var(--border)] shadow-2xl px-5 py-3 flex items-center gap-3"
            >
              <Sparkles className="text-[var(--seed-accent)]" size={18} />
              <span className="text-sm font-black text-[var(--earth)]">+1 avance en {celebration}</span>
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
                  <div className="h-36 rounded-[2rem] bg-gradient-to-b from-green-100 via-pink-50 to-white border border-green-100 flex items-center justify-center relative overflow-hidden mb-5">
                    <div className="seed-card-sheen" />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2.8, repeat: Infinity }}>
                      <PlantIllustration stage="bloom" progress={100} isGrowth />
                    </motion.div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-green-600">Cosecha lista</p>
                  <h3 className="mt-2 text-3xl font-serif font-black text-[var(--earth)] leading-tight">{note.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
                    Cierra el ciclo con una nota corta. Esto convierte la tarea terminada en aprendizaje reutilizable.
                  </p>
                  <textarea
                    value={note.reflection || ''}
                    onChange={(event) => updateNote(note.id, { reflection: event.target.value })}
                    rows={4}
                    className="mt-5 w-full rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-4 text-sm outline-none resize-none focus:bg-[var(--surface-strong)] focus:ring-1 focus:ring-[var(--sage)] transition-all"
                    placeholder="Qué aprendiste? Qué harías distinto? Qué sigue?"
                  />
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setHarvestNoteId(null)}
                      className="rounded-2xl bg-[var(--sage)] text-white py-4 font-black shadow-lg shadow-[var(--sage)]/20"
                    >
                      Guardar cosecha
                    </button>
                    <button
                      onClick={() => {
                        setHarvestNoteId(null);
                        setView('harvest');
                      }}
                      className="rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] py-4 font-black border border-[var(--border)]"
                    >
                      Ver cosechas
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
              className="fixed inset-0 z-[66] bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
              onClick={() => setShowSettings(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="w-full max-w-xl max-h-[88vh] rounded-[2rem] bg-[var(--surface-strong)] border border-[var(--border)] shadow-2xl p-0 overflow-hidden flex flex-col"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-[var(--border)] shrink-0">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Ajustes</p>
                    <h3 className="text-3xl font-serif font-black text-[var(--earth)] mt-1">Tu jardín</h3>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="p-2 rounded-full hover:bg-[var(--bg-app)] transition-colors" aria-label="Cerrar ajustes">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-5 p-5 sm:p-6 overflow-y-auto app-scrollbar">
                  <section className="rounded-[2rem] bg-[var(--bg-app)] border border-[var(--border)] p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[var(--sage)] to-[var(--seed-accent)] text-white flex items-center justify-center font-serif text-xl font-black shadow-lg shadow-[var(--sage)]/15">
                        {accountInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)]">Cuenta local</p>
                          <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${isSupabaseConfigured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isSupabaseConfigured ? 'Supabase listo' : 'Sin Supabase'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Nombre</span>
                            <input
                              value={account.name}
                              onChange={(event) => setAccount(current => ({ ...current, name: event.target.value }))}
                              className="mt-1 w-full rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-[var(--sage)]"
                              placeholder="Tu nombre"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Correo</span>
                            <input
                              type="email"
                              value={account.email}
                              onChange={(event) => setAccount(current => ({ ...current, email: event.target.value }))}
                              className="mt-1 w-full rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-[var(--sage)]"
                              placeholder="tu@email.com"
                            />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Rol</span>
                            <input
                              value={account.role}
                              onChange={(event) => setAccount(current => ({ ...current, role: event.target.value }))}
                              className="mt-1 w-full rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-[var(--sage)]"
                              placeholder="Ej. Creador, estudiante, fundador..."
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Ideas', value: notes.length },
                        { label: 'Racha', value: wateringRitual.streak },
                        { label: 'Min', value: notes.reduce((sum, note) => sum + (note.focusedMinutes || 0), 0) },
                      ].map(item => (
                        <div key={item.label} className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-3">
                          <p className="text-2xl font-serif font-black text-[var(--earth)]">{item.value}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)]">Sync Supabase</p>
                          <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                            {session?.user ? `Conectado como ${session.user.email}` : 'Crea una cuenta o inicia sesión para sincronizar entre dispositivos.'}
                          </p>
                        </div>
                        {session?.user && (
                          <button onClick={signOut} className="rounded-xl bg-[var(--bg-app)] border border-[var(--border)] px-3 py-2 text-xs font-black text-[var(--sage)]">
                            Cerrar sesión
                          </button>
                        )}
                      </div>

                      {!session?.user && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="email"
                            value={authEmail}
                            onChange={(event) => setAuthEmail(event.target.value)}
                            placeholder="correo@email.com"
                            className="rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--sage)]"
                          />
                          <input
                            type="password"
                            value={authPassword}
                            onChange={(event) => setAuthPassword(event.target.value)}
                            placeholder="Contraseña"
                            className="rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--sage)]"
                          />
                          <button
                            onClick={signInWithEmail}
                            disabled={Boolean(authDisabledReason)}
                            className="rounded-2xl bg-[var(--sage)] disabled:opacity-40 text-white py-3 text-xs font-black"
                          >
                            Iniciar sesión
                          </button>
                          <button
                            onClick={signUpWithEmail}
                            disabled={Boolean(authDisabledReason)}
                            className="rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] text-[var(--sage)] py-3 text-xs font-black"
                          >
                            Crear cuenta
                          </button>
                          {authDisabledReason && (
                            <p className="sm:col-span-2 text-xs font-semibold text-[var(--text-muted)]">{authDisabledReason}</p>
                          )}
                        </div>
                      )}

                      {session?.user && (
                        <button
                          onClick={syncGarden}
                          disabled={isSyncing}
                          className="mt-4 w-full rounded-2xl bg-[var(--sage)] disabled:opacity-50 text-white py-3 text-xs font-black"
                        >
                          {isSyncing ? 'Sincronizando...' : 'Sincronizar jardín'}
                        </button>
                      )}

                      {(authStatus || syncStatus) && (
                        <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">{syncStatus || authStatus}</p>
                      )}
                    </div>
                    <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">
                      {isSupabaseConfigured
                        ? 'Supabase ya esta configurado. El sync es manual por ahora para mantener control sobre los datos locales.'
                        : 'Esta cuenta vive en este dispositivo. Para sincronizar entre usuarios o equipos hará falta añadir Supabase.'}
                    </p>
                  </section>

                  <section>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] mb-3">Ecosistema</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {THEMES.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setTheme(item.id);
                            setPlanets(current => current.map(planet => planet.id === activePlanet.id ? touchPlanet({ ...planet, theme: item.id }) : planet));
                          }}
                          className={`rounded-2xl border px-3 py-4 text-center transition-all ${(activePlanet.theme || theme) === item.id ? 'bg-[var(--sage)] text-white border-[var(--sage)]' : 'bg-[var(--bg-app)] text-[var(--earth)] border-[var(--border)]'}`}
                        >
                          <span className="block text-xl mb-2">{item.icon}</span>
                          <span className="text-[10px] font-black">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] mb-3">Riego por defecto</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 3, 7].map(days => (
                        <button
                          key={days}
                          onClick={() => setDefaultWateringInterval(days)}
                          className={`rounded-2xl px-3 py-3 text-xs font-black transition-all ${defaultWateringInterval === days ? 'bg-[var(--sage)] text-white' : 'bg-[var(--bg-app)] text-[var(--sage)] border border-[var(--border)]'}`}
                        >
                          {days === 1 ? 'Diario' : days === 3 ? '3 días' : 'Semanal'}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-[var(--earth)]">Recordatorios</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">Aviso diario si hay ideas que valen un riego rápido mientras la app pueda notificar.</p>
                    </div>
                    <button
                      onClick={() => notificationsEnabled ? setNotificationsEnabled(false) : enableNotifications()}
                      className={`rounded-full px-4 py-2 text-xs font-black ${notificationsEnabled ? 'bg-[var(--sage)] text-white' : 'bg-[var(--surface-strong)] text-[var(--sage)] border border-[var(--border)]'}`}
                    >
                      {notificationsEnabled ? 'Activo' : 'Activar'}
                    </button>
                  </section>

                  <section>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] mb-3">Hora de recordatorio</p>
                    <input
                      type="range"
                      min={7}
                      max={21}
                      value={reminderHour}
                      onChange={(event) => setReminderHour(Number(event.target.value))}
                      className="w-full accent-[var(--sage)]"
                    />
                    <p className="mt-2 text-sm font-black text-[var(--earth)]">{reminderHour}:00</p>
                  </section>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={exportGarden} className="rounded-2xl bg-[var(--earth)] text-white py-4 font-black flex items-center justify-center gap-2">
                      <Download size={17} /> Markdown
                    </button>
                    <button onClick={exportBackup} className="rounded-2xl bg-[var(--earth)] text-white py-4 font-black flex items-center justify-center gap-2">
                      <Download size={17} /> Backup
                    </button>
                    <button onClick={() => importInputRef.current?.click()} className="rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] py-4 font-black border border-[var(--border)]">
                      Importar backup
                    </button>
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setShowOnboarding(true);
                      }}
                      className="rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] py-4 font-black border border-[var(--border)]"
                    >
                      Ver guía
                    </button>
                    <button onClick={clearGardenData} className="sm:col-span-2 rounded-2xl bg-red-50 text-red-600 py-4 font-black border border-red-100">
                      Borrar datos locales
                    </button>
                  </div>
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
              className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className="w-full max-w-3xl rounded-[2rem] bg-[var(--surface-strong)] border border-[var(--border)] shadow-2xl p-6 sm:p-7"
              >
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">Bienvenido a Seed</p>
                    <h2 className="text-3xl sm:text-4xl font-serif font-black text-[var(--earth)] mt-2 leading-tight">Planta ideas sin complicarte</h2>
                    <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
                      Seed funciona con tres decisiones pequeñas: guardar la idea, revisarla cuando vuelva y enfocarte en un paso.
                    </p>
                  </div>
                  <button
                    onClick={finishOnboarding}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--earth)] transition-colors"
                    aria-label="Cerrar guía"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                  {[
                    { icon: Leaf, title: 'Planta', text: 'Captura una idea aunque esté incompleta.' },
                    { icon: Droplets, title: 'Revisa', text: 'Riega para decidir si sigue viva, se pausa o necesita ayuda.' },
                    { icon: Target, title: 'Enfoca', text: 'Elige un paso pequeño y trabaja sin ver todo lo demás.' },
                  ].map((step) => (
                    <div key={step.title} className="rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] p-4">
                      <span className="h-10 w-10 rounded-2xl bg-[var(--sage)] text-white flex items-center justify-center shadow-lg shadow-[var(--sage)]/20">
                        <step.icon size={19} />
                      </span>
                      <p className="mt-4 font-serif text-xl font-black text-[var(--earth)]">{step.title}</p>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">{step.text}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  <button
                    onClick={() => {
                      finishOnboarding();
                      startPlanting();
                    }}
                    className="rounded-2xl bg-[var(--sage)] text-white py-4 px-5 font-black shadow-lg shadow-[var(--sage)]/20 flex items-center justify-center gap-2 active:translate-y-px soft-interaction"
                  >
                    <Leaf size={18} /> Plantar primera idea
                  </button>
                  <button
                    onClick={() => {
                      finishOnboarding();
                      setView('3D');
                    }}
                    className="rounded-2xl bg-[var(--bg-app)] text-[var(--sage)] py-4 px-5 font-black border border-[var(--border)] hover:bg-[var(--surface-strong)] transition-colors"
                  >
                    Ver ecosistema
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Button */}
        {!isAdding && !selectedNoteId && (
          <motion.button
            whileTap={{ y: 1 }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={startPlanting}
            className="fixed bottom-8 right-8 w-14 h-14 bg-[var(--sage)] text-white rounded-full shadow-2xl flex items-center justify-center z-50 overflow-hidden hover:shadow-[0_18px_45px_rgba(47,62,51,0.28)] soft-interaction"
          >
            <Leaf size={28} />
          </motion.button>
        )}
      </main>
    </div>
  );
}
