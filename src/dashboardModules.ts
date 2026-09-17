import { gardenName } from './gardenVocabulary';

export const DASHBOARD_MODULES = [
  { id: 'capture', title: gardenName('plant', 'es'), titleEn: gardenName('plant', 'en'), detail: 'Captura rápida: guarda semillas y apuntes sin salir de tu paseo.', detailEn: 'Quick capture: save seeds and notes without leaving your walk.' },
  { id: 'focus', title: gardenName('dailyFocus', 'es'), titleEn: gardenName('dailyFocus', 'en'), detail: 'Objetivo diario: un paso concreto y su progreso, separado del proyecto.', detailEn: 'Daily goal: one specific step and its progress, separate from the project.' },
  { id: 'upcoming', title: gardenName('upcoming', 'es'), titleEn: gardenName('upcoming', 'en'), detail: 'Fechas cercanas, vencidas y elementos importantes.', detailEn: 'Upcoming dates, overdue items and priorities.' },
  { id: 'summary', title: 'Tu jardín de un vistazo', titleEn: 'Your garden at a glance', detail: 'Tarjetas de Semillas, Brotes y Cosechas.', detailEn: 'Cards for Seeds, Sprouts and Harvests.' },
  { id: 'watering', title: gardenName('water', 'es'), titleEn: gardenName('water', 'en'), detail: 'Revisar y decidir: una semilla o brote que necesita atención.', detailEn: 'Review and decide: a seed or sprout that needs attention.' },
  { id: 'projects', title: 'Retomar un brote', titleEn: 'Pick up a sprout', detail: 'Proyecto en marcha: último avance y siguiente labor.', detailEn: 'A project in progress: last advance and next garden task.' },
  { id: 'learning', title: gardenName('learning', 'es'), titleEn: gardenName('learning', 'en'), detail: 'Reflexiones de elementos terminados que pueden inspirar nuevas semillas.', detailEn: 'Reflections from completed items that can inspire new seeds.' },
  { id: 'journal', title: 'Diario del jardinero', titleEn: 'Gardener’s journal', detail: 'Tu reflexión, estado de ánimo e historial, sin obligaciones.', detailEn: 'Your reflection, mood and history, without obligations.' },
  { id: 'board', title: gardenName('board', 'es'), titleEn: gardenName('board', 'en'), detail: 'Pizarra: conecta ideas y organiza tu jardín visualmente.', detailEn: 'Board: connect ideas and organize your garden visually.' },
  { id: 'activity', title: gardenName('closeDay', 'es'), titleEn: gardenName('closeDay', 'en'), detail: 'Resumen y cierre: labores, minutos de atención, riegos y reflexión.', detailEn: 'Summary and closure: tasks, focused minutes, watering and reflection.' },
] as const;

export type DashboardModuleId = typeof DASHBOARD_MODULES[number]['id'];
export const DASHBOARD_MODULES_KEY = 'seed-dashboard-modules-v4';
export const DASHBOARD_ORDER_KEY = 'seed-dashboard-order-v1';
export const DEFAULT_DASHBOARD_MODULES: DashboardModuleId[] = DASHBOARD_MODULES.map(module => module.id);
const validIds = new Set<string>(DEFAULT_DASHBOARD_MODULES);

export function readDashboardOrder(raw: string | null): DashboardModuleId[] {
  try {
    const parsed: unknown = JSON.parse(raw || 'null');
    if (Array.isArray(parsed)) {
      const saved = parsed.filter((id): id is DashboardModuleId => typeof id === 'string' && validIds.has(id));
      return [...new Set([...saved, ...DEFAULT_DASHBOARD_MODULES])];
    }
  } catch { /* Recover the standard order without changing visibility. */ }
  return [...DEFAULT_DASHBOARD_MODULES];
}

export function moveDashboardModule(order: DashboardModuleId[], id: DashboardModuleId, direction: -1 | 1): DashboardModuleId[] {
  const index = order.indexOf(id);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= order.length) return order;
  const next = [...order];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export function reorderDashboardModules(order: DashboardModuleId[], activeId: string, overId: string | null): DashboardModuleId[] {
  const from = order.findIndex(id => id === activeId);
  const to = order.findIndex(id => id === overId);
  if (from < 0 || to < 0 || from === to) return order;
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function readDashboardModules(raw: string | null, legacy: string | null = null, previous: string | null = null, addition: DashboardModuleId = 'journal'): DashboardModuleId[] {
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return [...new Set(parsed.filter((id): id is DashboardModuleId => typeof id === 'string' && validIds.has(id)))];
    } catch { /* Fall back to defaults or earlier preferences. */ }
  }
  if (previous !== null) {
    try {
      const parsed: unknown = JSON.parse(previous);
      if (Array.isArray(parsed)) {
        const saved = [...new Set(parsed.filter((id): id is DashboardModuleId => typeof id === 'string' && validIds.has(id)))];
        return saved.length ? [...new Set([...saved, addition])] : [];
      }
    } catch { /* Recover older preferences below. */ }
  }
  if (legacy !== null) {
    try {
      const parsed: unknown = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        // These modules were always visible before customization was connected.
        const modules: DashboardModuleId[] = ['capture', 'focus', 'upcoming', 'projects', 'activity'];
        for (const id of ['summary', 'watering', 'learning'] as const) if (parsed.includes(id)) modules.push(id);
        return modules;
      }
    } catch { /* A damaged preference should not hide the whole dashboard. */ }
  }
  return [...DEFAULT_DASHBOARD_MODULES];
}
