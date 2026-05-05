/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
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
  Moon, 
  Sun, 
  Palette,
  ArrowRight,
  TrendingUp,
  X,
  Calendar as CalendarIcon,
  Clock,
  Skull,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Box,
  Settings
} from 'lucide-react';
import { Theme, SeedNote, Task } from './types';
import Garden3D from './components/Garden3D';

const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'earth', label: 'Tierra', icon: '🟤' },
  { id: 'forest', label: 'Bosque', icon: '🌲' },
  { id: 'bloom', label: 'Flor', icon: '🌸' },
  { id: 'night', label: 'Noche', icon: '🌙' },
];

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
      <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-[var(--border)]">
        <h3 className="text-xl font-serif font-bold text-[var(--earth)] capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-[var(--sage)]"
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
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-[var(--sage)]"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-gray-50/50">
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
                className={`min-h-[120px] p-2 border-r border-b border-[var(--border)] group transition-all ${idx % 7 === 6 ? 'border-r-0' : ''} ${!isCurrentMonth ? 'bg-gray-50/30' : 'bg-white'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${isTodayDay ? 'bg-[var(--sage)] text-white shadow-sm' : isCurrentMonth ? 'text-[var(--earth)]' : 'text-gray-300'}`}>
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
                        'bg-[var(--bg-app)] text-[var(--sage)] border-[var(--border)] hover:bg-white hover:shadow-sm'
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

function PlantIllustration({ stage, progress, isGrowth }: { stage: SeedNote['growthStage']; progress: number; isGrowth: boolean }) {
  const swayClass = stage !== 'withered' ? 'sway' : '';
  
  if (stage === 'seed' && !isGrowth) {
    return (
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className="w-4 h-4 bg-[#8b5e3c] rounded-full shadow-inner" />
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute w-6 h-6 border border-white/20 rounded-full"
        />
      </div>
    );
  }

  if (stage === 'withered') {
    return (
      <div className="relative w-12 h-20 flex flex-col items-center justify-end">
        <div className="w-1 h-12 bg-gray-400 rounded-full origin-bottom rotate-12" />
        <div className="w-6 h-4 bg-gray-300 rounded-full -mt-10 -ml-4 rotate-45" />
        <Skull size={16} className="text-gray-400 mt-2 opacity-50" />
      </div>
    );
  }

  if (stage === 'bloom') {
    return (
      <div className={`relative w-16 h-24 flex flex-col items-center justify-end ${swayClass}`}>
        <div className="w-1.5 h-16 bg-green-500 rounded-full" />
        <div className="absolute top-0 flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="relative"
          >
            <div className="w-10 h-10 bg-yellow-400 rounded-full shadow-lg" />
            {[0, 72, 144, 216, 288].map(deg => (
              <div 
                key={deg}
                style={{ transform: `rotate(${deg}deg) translateY(-14px)` }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-pink-400 rounded-full -z-10"
              />
            ))}
          </motion.div>
        </div>
        <div className="w-6 h-3 bg-green-600 rounded-full -mt-8 -ml-8 rotate-[-30deg]" />
        <div className="w-6 h-3 bg-green-600 rounded-full -mt-4 ml-8 rotate-[30deg]" />
      </div>
    );
  }

  // Sprout / Growing stage
  const height = 10 + (progress * 0.4); // 10px to 50px
  return (
    <div className={`relative w-12 h-20 flex flex-col items-center justify-end ${swayClass}`}>
      <div style={{ height: `${height}px` }} className="w-1 h-full bg-green-400 rounded-full transition-all duration-1000" />
      <div className="absolute top-0 flex gap-1 -mt-2">
        <div className="w-4 h-3 bg-green-500 rounded-full rotate-[-45deg] origin-right" />
        <div className="w-4 h-3 bg-green-500 rounded-full rotate-[45deg] origin-left" />
      </div>
    </div>
  );
}

export default function App() {
  const [notes, setNotes] = useState<SeedNote[]>(() => {
    const saved = localStorage.getItem('seed-notes');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('seed-theme') as Theme) || 'earth';
  });

  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<SeedNote['growthStage'] | 'all'>('all');
  const [view, setView] = useState<'garden' | 'calendar' | '3D'>('garden');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState({ title: '', content: '', dueDate: '' });
  const [isLinking, setIsLinking] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('seed-notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('seed-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Check for withered seeds periodically
  useEffect(() => {
    const checkWithered = () => {
      const now = Date.now();
      let changed = false;
      const updatedNotes = notes.map(note => {
        if (note.dueDate && note.dueDate < now && note.growthStage !== 'bloom' && note.growthStage !== 'withered') {
          changed = true;
          return { ...note, growthStage: 'withered' as const };
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
      dueDate: newNote.dueDate ? new Date(newNote.dueDate).getTime() : undefined
    };
    
    setNotes([note, ...notes]);
    setNewNote({ title: '', content: '', dueDate: '' });
    setIsAdding(false);
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  const updateNote = (id: string, updates: Partial<SeedNote>) => {
    setNotes(notes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const growNote = (id: string) => {
    setNotes(notes.map(n => {
      if (n.id === id && !n.isGrowth) {
        return { 
          ...n, 
          isGrowth: true, 
          growthStage: 'sprout',
          tasks: [{ id: crypto.randomUUID(), text: 'Primer paso para que esta idea crezca...', completed: false }]
        };
      }
      return n;
    }));
  };

  const addTask = (noteId: string) => {
    setNotes(notes.map(n => {
      if (n.id === noteId) {
        return { 
          ...n, 
          tasks: [...n.tasks, { id: crypto.randomUUID(), text: '', completed: false }] 
        };
      }
      return n;
    }));
  };

  const updateTask = (noteId: string, taskId: string, text: string) => {
    setNotes(notes.map(n => {
      if (n.id === noteId) {
        return {
          ...n,
          tasks: n.tasks.map(t => t.id === taskId ? { ...t, text } : t)
        };
      }
      return n;
    }));
  };

  const toggleTask = (noteId: string, taskId: string) => {
    setNotes(notes.map(n => {
      if (n.id === noteId) {
        const newTasks = n.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
        const allCompleted = newTasks.length > 0 && newTasks.every(t => t.completed);
        return {
          ...n,
          tasks: newTasks,
          growthStage: allCompleted ? 'bloom' : 'sprout'
        };
      }
      return n;
    }));
  };

  const toggleConnection = (fromId: string, toId: string) => {
    setNotes(notes.map(n => {
      if (n.id === fromId) {
        const connections = n.connections || [];
        const exists = connections.includes(toId);
        return {
          ...n,
          connections: exists ? connections.filter(id => id !== toId) : [...connections, toId]
        };
      }
      return n;
    }));
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) ||
                            n.content.toLowerCase().includes(search.toLowerCase());
      const matchesStage = filterStage === 'all' || n.growthStage === filterStage;
      return matchesSearch && matchesStage;
    });
  }, [notes, search, filterStage]);

  const selectedNote = useMemo(() => 
    notes.find(n => n.id === selectedNoteId), 
  [notes, selectedNoteId]);

  const growingNotes = useMemo(() => notes.filter(n => n.isGrowth), [notes]);

  const upcomingDeadlines = useMemo(() => {
    return notes
      .filter(n => n.dueDate && n.growthStage !== 'bloom')
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
      .slice(0, 3);
  }, [notes]);

  const getProgress = (note: SeedNote) => {
    if (!note.tasks.length) return 0;
    const completed = note.tasks.filter(t => t.completed).length;
    return Math.round((completed / note.tasks.length) * 100);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)] font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-[var(--sidebar-bg)]/80 backdrop-blur-xl border-r border-[var(--border)] p-6 md:p-8 flex flex-col shrink-0 overflow-y-auto z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.02)_inset]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-4 mb-12 group cursor-pointer"
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

        <div className="space-y-4 mb-12">
          <p className="text-[10px] uppercase font-black text-[var(--seed-accent)] px-4 mb-2 tracking-[0.25em] opacity-50">Explora</p>
          <div className="space-y-1">
            {[
              { id: 'garden', label: 'El Jardín', icon: LayoutGrid },
              { id: '3D', label: 'Ecosistema 3D', icon: Box },
              { id: 'calendar', label: 'Ciclo Vital', icon: CalendarIcon },
            ].map((item) => (
              <motion.button 
                key={item.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all relative group ${
                  view === item.id 
                    ? 'bg-white shadow-xl shadow-black/5 text-[var(--sage)] ring-1 ring-black/5' 
                    : 'text-[var(--earth)] hover:bg-white/40'
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
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-4 mb-12">
          <p className="text-[10px] uppercase font-black text-[var(--seed-accent)] px-4 mb-2 tracking-[0.25em] opacity-50">Filtros</p>
          <div className="space-y-1">
            <motion.button 
              whileHover={{ x: 4 }}
              onClick={() => { setFilterStage('all'); setSelectedNoteId(null); setView('garden'); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${filterStage === 'all' && view === 'garden' ? 'bg-white shadow-sm text-[var(--sage)] ring-1 ring-black/5' : 'text-[var(--earth)] hover:bg-white/40'}`}
            >
              <Palette size={18} className="opacity-70" />
              <span className="font-bold tracking-tight text-sm">Colección Total</span>
            </motion.button>
            
            {[
              { id: 'seed', label: 'Semillas', color: 'var(--seed-accent)' },
              { id: 'sprout', label: 'Brotes', color: 'var(--sage)' },
              { id: 'bloom', label: 'Cosechas', color: 'var(--earth)' },
            ].map((stage) => (
              <motion.button 
                key={stage.id}
                whileHover={{ x: 4 }}
                onClick={() => { setFilterStage(stage.id as any); setSelectedNoteId(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${filterStage === stage.id ? 'bg-white shadow-sm text-[var(--sage)] ring-1 ring-black/5' : 'text-[var(--earth)] hover:bg-white/40'}`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full shadow-inner" 
                  style={{ backgroundColor: stage.color }} 
                />
                <span className="font-bold tracking-tight text-sm">{stage.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsAdding(true)}
          className="mb-12 bg-[var(--sage)] hover:bg-[var(--ink)] text-white w-full py-4.5 rounded-[2rem] font-black shadow-2xl shadow-[var(--sage)]/30 transition-all flex items-center justify-center gap-3 hidden md:flex active:shadow-inner"
        >
          <Plus size={20} strokeWidth={3} />
          <span className="tracking-tight">Plantar Idea</span>
        </motion.button>

        {upcomingDeadlines.length > 0 && (
          <div className="mb-12">
            <p className="text-[10px] uppercase font-black text-[var(--seed-accent)] px-4 mb-5 tracking-[0.25em] opacity-50 flex items-center gap-2">
              <Clock size={12} strokeWidth={3} /> Próximas Cosechas
            </p>
            <div className="space-y-3">
              {upcomingDeadlines.map(note => (
                <motion.button 
                  key={note.id}
                  whileHover={{ y: -2, scale: 1.02 }}
                  onClick={() => setSelectedNoteId(note.id)}
                  className="w-full text-left p-4 rounded-3xl bg-white/40 hover:bg-white shadow-sm hover:shadow-xl hover:shadow-black/5 transition-all group border border-white/50"
                >
                  <p className="text-xs font-serif font-black text-[var(--earth)] truncate group-hover:text-[var(--sage)] transition-colors">{note.title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 bg-black/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${getProgress(note)}%` }}
                        className="h-full bg-[var(--sage)]"
                      />
                    </div>
                    <span className="text-[9px] text-[var(--sage)] font-black uppercase tabular-nums">
                      {new Date(note.dueDate!).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto space-y-6">
          <div className="p-4 bg-white/40 rounded-3xl border border-white/50">
            <p className="text-[9px] uppercase font-black text-[var(--seed-accent)] mb-4 tracking-[0.25em] opacity-60 px-1">Ecosistemas</p>
            <div className="flex justify-between items-center bg-black/5 p-1 rounded-2xl">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative p-2.5 rounded-xl transition-all flex-1 flex justify-center ${theme === t.id ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:scale-110'}`}
                  title={t.label}
                >
                  <span className="text-lg leading-none">{t.icon}</span>
                  {theme === t.id && (
                    <motion.div layoutId="theme-active" className="absolute -bottom-1 w-1 h-1 bg-[var(--sage)] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 px-2 py-4 border-t border-[var(--border)]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--sage)] to-[var(--seed-accent)] flex items-center justify-center text-white font-serif font-bold italic shadow-lg ring-2 ring-white">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-[var(--earth)] truncate">Jardinero Digital</p>
              <p className="text-[10px] font-medium text-[var(--text-muted)] truncate">jose@garden.com</p>
            </div>
            <button className="p-2 text-[var(--text-muted)] hover:text-[var(--sage)] transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>


      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <section className={`flex-1 p-6 md:p-10 overflow-y-auto bg-[var(--bg-app)] transition-all duration-300 ${selectedNoteId ? 'md:mr-[400px]' : ''}`}>
          <div className="max-w-4xl mx-auto">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-3xl font-serif font-semibold text-[var(--earth)]">Tus Semillas</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1 italic">Cada nota es el comienzo de algo grande.</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                <input
                  type="text"
                  placeholder="Buscar en el jardín..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-[var(--border)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--sage)] focus:bg-white transition-all text-sm"
                />
              </div>
            </header>

            <AnimatePresence mode="popLayout" initial={false}>
              {view === 'garden' ? (
                <motion.div
                  key="garden-view"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  {isAdding && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white p-8 rounded-3xl border border-[var(--seed-accent)] mb-8 shadow-xl relative"
                    >
                      <button onClick={() => setIsAdding(false)} className="absolute top-6 right-6 text-[var(--text-muted)] hover:text-red-500">
                        <X size={20} />
                      </button>
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
                      <div className="flex gap-4">
                        <button
                          onClick={addNote}
                          disabled={!newNote.content.trim()}
                          className="bg-[var(--sage)] text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 hover:brightness-105 transition-all shadow-md active:scale-95"
                        >
                          Plantar idea
                        </button>
                        <button onClick={() => setIsAdding(false)} className="px-6 py-3 text-sm font-medium hover:bg-gray-50 rounded-xl transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">
                    {filteredNotes.map((note) => (
                      <motion.div
                        layout
                        key={note.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        whileHover={{ y: -8 }}
                        onClick={() => setSelectedNoteId(note.id)}
                        className={`bg-white rounded-[2rem] border transition-all group relative cursor-pointer overflow-hidden ${
                          selectedNoteId === note.id 
                            ? 'border-[var(--sage)] shadow-2xl ring-2 ring-[var(--sage)]' 
                            : 'border-[var(--border)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-[var(--seed)]'
                        }`}
                      >
                        {/* Organic Plant Section */}
                        <div className="h-48 bg-gradient-to-b from-blue-50 to-white relative flex items-center justify-center pt-8">
                          <div className="absolute bottom-0 w-full h-8 bg-[#5d4037]/10 rounded-t-[100%] blur-xl" />
                          <div className="absolute bottom-0 w-3/4 h-4 bg-[#3e2723]/20 rounded-full" />
                          
                          <PlantIllustration 
                            stage={note.growthStage} 
                            progress={getProgress(note)} 
                            isGrowth={note.isGrowth} 
                          />
                        </div>

                        <div className="p-8 pt-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              {note.isGrowth && (
                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${
                                  note.growthStage === 'bloom' ? 'bg-green-100 text-green-700' : 
                                  note.growthStage === 'withered' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {note.growthStage === 'bloom' ? 'Cosechada' : note.growthStage === 'withered' ? 'Marchita' : 'En Brote'}
                                </div>
                              )}
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] opacity-60">
                                {new Date(note.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-2 bg-gray-50 rounded-full"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <h3 className={`text-2xl font-serif font-bold mb-3 transition-colors ${selectedNoteId === note.id ? 'text-[var(--sage)]' : note.growthStage === 'withered' ? 'text-gray-400' : 'text-[var(--earth)]'}`}>{note.title}</h3>
                          
                          {note.dueDate && (
                            <div className={`flex items-center gap-2 text-[11px] font-black mb-4 ${note.growthStage === 'withered' ? 'text-red-400' : 'text-[var(--seed)]'}`}>
                              {note.growthStage === 'withered' ? <Skull size={14} /> : <CalendarIcon size={14} />}
                              <span className="uppercase tracking-widest">{note.growthStage === 'withered' ? 'MARCHITA' : 'COSECHA'}: {format(note.dueDate, 'd MMM')}</span>
                            </div>
                          )}

                          {note.isGrowth && (
                            <div className="mt-8">
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black text-[var(--sage)] tracking-[0.2em]">DESARROLLO</span>
                                <span className="text-xs font-black text-[var(--sage)]">{getProgress(note)}%</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-50">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${getProgress(note)}%` }}
                                  className={`h-full rounded-full ${note.growthStage === 'bloom' ? 'bg-green-500' : 'bg-[var(--sage)]'}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ) : view === 'calendar' ? (
                <CalendarView 
                  key="calendar-view"
                  currentMonth={currentMonth} 
                  setCurrentMonth={setCurrentMonth} 
                  notes={notes} 
                  onSelectNote={setSelectedNoteId} 
                />
              ) : (
                <motion.div
                  key="3d-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Garden3D 
                    notes={filteredNotes} 
                    onSelectNote={setSelectedNoteId} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {filteredNotes.length === 0 && !isAdding && view !== '3D' && (
              <div className="text-center py-32 flex flex-col items-center">
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
                  "Todo gran bosque comienza con una pequeña semilla en la mano."
                </p>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsAdding(true)}
                  className="mt-10 bg-[var(--sage)] text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-[var(--sage)]/20 transition-all hover:brightness-110"
                >
                  Plantar mi primera idea
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
              className="absolute right-0 top-0 bottom-0 w-full md:w-[400px] bg-white border-l border-[var(--border)] shadow-2xl flex flex-col z-30"
            >
              <div className="p-8 pb-4 flex justify-between items-center border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedNote.growthStage === 'bloom' ? 'bg-green-500' : 
                    selectedNote.growthStage === 'withered' ? 'bg-red-500' : 'bg-[var(--seed)]'
                  }`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {selectedNote.growthStage === 'bloom' ? 'Idea Cosechada' : 
                     selectedNote.growthStage === 'withered' ? 'Idea Marchita' :
                     selectedNote.isGrowth ? 'Idea en Brote' : 'Semilla'}
                  </span>
                </div>
                <button onClick={() => setSelectedNoteId(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {/* Large Visual Representation */}
                <div className="mb-10 h-40 bg-gradient-to-b from-[var(--bg-app)] to-white rounded-[2rem] flex items-center justify-center relative overflow-hidden border border-[var(--border)]">
                  <div className="absolute bottom-0 w-full h-4 bg-[#3e2723]/5 rounded-full" />
                  <PlantIllustration 
                    stage={selectedNote.growthStage} 
                    progress={getProgress(selectedNote)} 
                    isGrowth={selectedNote.isGrowth} 
                  />
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
                      {notes.filter(n => n.id !== selectedNote.id).map(n => {
                        const isConnected = selectedNote.connections?.includes(n.id);
                        return (
                          <button
                            key={n.id}
                            onClick={() => toggleConnection(selectedNote.id, n.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs flex justify-between items-center ${isConnected ? 'bg-green-100 text-green-700' : 'hover:bg-white'}`}
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
                        const target = notes.find(n => n.id === id);
                        if (!target) return null;
                        return (
                          <button 
                            key={id}
                            onClick={() => setSelectedNoteId(id)}
                            className="text-[10px] bg-slate-50 px-3 py-1 rounded-full border border-slate-100 text-slate-600 hover:bg-white hover:shadow-sm"
                          >
                            {target.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mb-10 flex items-center gap-4 p-4 bg-[var(--bg-app)] rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[var(--sage)] shadow-sm">
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
                      } text-white w-full py-4 rounded-xl font-bold shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2`}
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
                        <div className="animate-bounce">
                          <CheckCircle2 className="mx-auto text-green-500 mb-4" size={32} />
                          <p className="text-xs font-bold text-green-600 uppercase tracking-widest">¡Idea Cosechada con Éxito!</p>
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

              <div className="p-8 border-t border-[var(--border)] bg-gray-50 flex justify-between items-center">
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

        {/* Floating Action Button */}
        {!isAdding && !selectedNoteId && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => setIsAdding(true)}
            className="fixed bottom-8 right-8 w-14 h-14 bg-[var(--sage)] text-white rounded-full shadow-2xl flex items-center justify-center z-50 overflow-hidden hover:scale-110 active:scale-95 transition-all"
          >
            <Leaf size={28} />
          </motion.button>
        )}
      </main>
    </div>
  );
}
