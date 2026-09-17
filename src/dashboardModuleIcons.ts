import { Pencil, Sun, Calendar, LayoutGrid, Droplets, Box, Archive, BookOpen, Moon, PanelsTopLeft, type LucideIcon } from 'lucide-react';
import type { DashboardModuleId } from './dashboardModules';

// Every module must have a renderable icon, including newly added modules.
export const DASHBOARD_MODULE_ICONS: Record<DashboardModuleId, LucideIcon> = {
  capture: Pencil,
  focus: Sun,
  upcoming: Calendar,
  summary: LayoutGrid,
  watering: Droplets,
  projects: Box,
  learning: Archive,
  journal: BookOpen,
  board: PanelsTopLeft,
  activity: Moon,
};
