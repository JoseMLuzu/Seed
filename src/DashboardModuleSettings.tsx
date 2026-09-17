import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReducedMotion } from 'motion/react';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { DASHBOARD_MODULES, moveDashboardModule, reorderDashboardModules, type DashboardModuleId } from './dashboardModules';
import { DASHBOARD_MODULE_ICONS } from './dashboardModuleIcons';

type Props = {
  order: DashboardModuleId[];
  language: 'es' | 'en';
  onOrderChange: (order: DashboardModuleId[]) => void;
  renderSwitch: (id: DashboardModuleId, title: string) => ReactNode;
};

function ModuleContent({ id, index, total, language, handle, toggle, onMove }: {
  id: DashboardModuleId; index: number; total: number; language: Props['language'];
  handle: ReactNode; toggle: ReactNode; onMove?: (direction: -1 | 1) => void;
}) {
  const module = DASHBOARD_MODULES.find(item => item.id === id)!;
  const en = language === 'en';
  const title = en ? module.titleEn : module.title;
  const Icon = DASHBOARD_MODULE_ICONS[id];
  return <>
    <div className="flex min-h-14 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]"><Icon size={16} /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--earth)]">{title}</p><p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-muted)]">{en ? module.detailEn : module.detail}</p></div>
      {toggle}
    </div>
    <div className="mt-2 flex items-center justify-between gap-1 rounded-xl bg-[var(--bg-app)]">
      <div className="flex min-w-0 items-center gap-1">{handle}<span className="text-[11px] font-medium text-[var(--text-muted)]">{en ? `Position ${index + 1} of ${total}` : `Posición ${index + 1} de ${total}`}</span></div>
      <div className="flex shrink-0 gap-1">
        <button type="button" disabled={!onMove || index === 0} onClick={() => onMove?.(-1)} aria-label={en ? `Move ${title} up` : `Subir ${title}`} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--sage)] hover:bg-[var(--tone-sprout-bg)] focus-visible:outline-2 focus-visible:outline-[var(--sage)] disabled:opacity-25"><ArrowUp size={17} /></button>
        <button type="button" disabled={!onMove || index === total - 1} onClick={() => onMove?.(1)} aria-label={en ? `Move ${title} down` : `Bajar ${title}`} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--sage)] hover:bg-[var(--tone-sprout-bg)] focus-visible:outline-2 focus-visible:outline-[var(--sage)] disabled:opacity-25"><ArrowDown size={17} /></button>
      </div>
    </div>
  </>;
}

function SortableModule({ id, index, order, language, onOrderChange, renderSwitch }: Props & { id: DashboardModuleId; index: number }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  const reduceMotion = useReducedMotion();
  const module = DASHBOARD_MODULES.find(item => item.id === id)!;
  const title = language === 'en' ? module.titleEn : module.title;
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform ? { ...transform, x: 0, scaleX: 1, scaleY: 1 } : null), transition: reduceMotion ? 'none' : transition, opacity: isDragging ? .3 : 1 }} className="relative border-b border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 last:border-b-0">
    <ModuleContent id={id} index={index} total={order.length} language={language} toggle={renderSwitch(id, title)} onMove={direction => onOrderChange(moveDashboardModule(order, id, direction))} handle={
      <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={language === 'en' ? `Drag to reorder ${title}` : `Arrastrar para ordenar ${title}`} style={{ touchAction: 'none', WebkitTouchCallout: 'none' }} className="grid h-11 w-11 shrink-0 cursor-grab select-none place-items-center rounded-xl text-[var(--sage)] hover:bg-[var(--tone-sprout-bg)] focus-visible:outline-2 focus-visible:outline-[var(--sage)] active:cursor-grabbing"><GripVertical size={20} /></button>
    } />
  </div>;
}

export function DashboardModuleSettings(props: Props) {
  const [activeId, setActiveId] = useState<DashboardModuleId | null>(null);
  const reduceMotion = useReducedMotion();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const en = props.language === 'en';
  const titleFor = (id: string | number) => {
    const module = DASHBOARD_MODULES.find(item => item.id === id);
    return module ? en ? module.titleEn : module.title : String(id);
  };
  return <DndContext sensors={sensors} collisionDetection={closestCenter}
    accessibility={{
      screenReaderInstructions: { draggable: en ? 'Press Space to pick up a module, use arrow keys to move it, Space to drop or Escape to cancel.' : 'Pulsa Espacio para tomar un módulo, usa las flechas para moverlo, Espacio para soltar o Escape para cancelar.' },
      announcements: {
        onDragStart: ({ active }) => en ? `Picked up ${titleFor(active.id)}.` : `Has tomado ${titleFor(active.id)}.`,
        onDragOver: ({ active, over }) => over ? en ? `${titleFor(active.id)}, position ${props.order.indexOf(over.id as DashboardModuleId) + 1} of ${props.order.length}.` : `${titleFor(active.id)}, posición ${props.order.indexOf(over.id as DashboardModuleId) + 1} de ${props.order.length}.` : undefined,
        onDragEnd: ({ active, over }) => over ? en ? `${titleFor(active.id)} placed at position ${props.order.indexOf(over.id as DashboardModuleId) + 1}.` : `${titleFor(active.id)} colocado en la posición ${props.order.indexOf(over.id as DashboardModuleId) + 1}.` : en ? 'Order unchanged.' : 'Orden sin cambios.',
        onDragCancel: () => en ? 'Reordering cancelled. Order unchanged.' : 'Ordenación cancelada. Orden sin cambios.',
      },
    }}
    onDragStart={({ active }) => setActiveId(active.id as DashboardModuleId)}
    onDragCancel={() => setActiveId(null)}
    onDragEnd={({ active, over }) => { setActiveId(null); props.onOrderChange(reorderDashboardModules(props.order, String(active.id), over ? String(over.id) : null)); }}>
    <SortableContext items={props.order} strategy={verticalListSortingStrategy}>
      {props.order.map((id, index) => <SortableModule key={id} {...props} id={id} index={index} />)}
    </SortableContext>
    {createPortal(<DragOverlay dropAnimation={reduceMotion ? null : undefined} zIndex={120}>
      {activeId && <div aria-hidden="true" className="pointer-events-none rounded-2xl border border-[var(--sage)] bg-[var(--surface-strong)] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <ModuleContent id={activeId} index={props.order.indexOf(activeId)} total={props.order.length} language={props.language} toggle={null} handle={<span className="grid h-11 w-11 shrink-0 place-items-center text-[var(--sage)]"><GripVertical size={20} /></span>} />
      </div>}
    </DragOverlay>, document.body)}
  </DndContext>;
}
