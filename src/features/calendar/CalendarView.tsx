/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  Leaf,
  Sparkles,
  Sprout,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SeedNote } from "../../types";
import { appDateLocale, appLanguage } from "../../app/i18n";
import { formatDayMonth, formatMonthYear } from "../../app/dates";
import { DAY_MS } from "../../seedLogic";
import {
  buildCalendarEvents,
  calendarEventsForDay,
  groupCalendarEventsByDay,
  isRecordedCalendarEvent,
  type CalendarEvent,
  type CalendarEventKind,
} from "../../calendarLogic";

export function CalendarView({
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
  const copy =
    appLanguage === "en"
      ? {
          activity: "Recorded activity",
          plan: "Planned",
          reflection: "Reflection",
          noActivity: "No recorded activity",
          quiet: "A quiet day. Rest also belongs in your path.",
          focus: "Hands in the soil session",
          task: "Garden task completed",
          planted: "Idea planted",
          watered: "Idea watered",
          harvested: "Harvest completed",
          closed: "Day closed",
          due: "Target date",
          activeDays: "active days",
          streak: "day streak",
          events: "records",
          minute: "min",
          steps: "Garden tasks",
          focusMinutes: "Focus",
          harvests: "Harvests",
          today: "Today",
          done: "Done",
          previous: "Previous month",
          next: "Next month",
          planCount: "planned",
          day: "Day",
        }
      : {
          activity: "Actividad registrada",
          plan: "Planificado",
          reflection: "Reflexión",
          noActivity: "Sin actividad registrada",
          quiet:
            "Un día tranquilo. El descanso también forma parte de tu camino.",
          focus: "Sesión de Manos a la tierra",
          task: "Labor completada",
          planted: "Idea plantada",
          watered: "Idea regada",
          harvested: "Cosecha lograda",
          closed: "Cierre del día",
          due: "Fecha objetivo",
          activeDays: "días activos",
          streak: "días de racha",
          events: "registros",
          minute: "min",
          steps: "Labores",
          focusMinutes: "Atención",
          harvests: "Cosechas",
          today: "Hoy",
          done: "Listo",
          previous: "Mes anterior",
          next: "Mes siguiente",
          planCount: "planificados",
          day: "Día",
        };
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const mobileTodayRef = useRef<HTMLDivElement | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => {
    const now = new Date();
    return isSameMonth(now, monthStart) ? now : monthStart;
  });
  const allEvents = useMemo(() => buildCalendarEvents(notes), [notes]);
  const eventsByDay = useMemo(
    () => groupCalendarEventsByDay(allEvents),
    [allEvents],
  );
  const selectedEvents = calendarEventsForDay(eventsByDay, selectedDay);
  const selectedRecorded = selectedEvents.filter(isRecordedCalendarEvent);
  const selectedPlans = selectedEvents.filter(
    (event) => event.category === "plan",
  );

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

  const monthEvents = allEvents.filter((event) =>
    isSameMonth(new Date(event.at), monthStart),
  );
  const monthRecorded = monthEvents.filter(isRecordedCalendarEvent);
  const activeDayKeys = new Set(
    monthRecorded.map((event) => format(event.at, "yyyy-MM-dd")),
  );
  const monthSummary = {
    activeDays: activeDayKeys.size,
    steps: monthRecorded.filter((event) => event.kind === "task-completed")
      .length,
    focusMinutes: monthRecorded
      .filter((event) => event.kind === "focus")
      .reduce((total, event) => total + (event.minutes || 0), 0),
    harvests: monthRecorded.filter((event) => event.kind === "harvested")
      .length,
  };
  const activeStreak = (() => {
    let cursor = new Date();
    if (!isSameMonth(cursor, monthStart)) return 0;
    let streak = 0;
    while (
      isSameMonth(cursor, monthStart) &&
      activeDayKeys.has(format(cursor, "yyyy-MM-dd"))
    ) {
      streak += 1;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
    return streak;
  })();
  const selectedFocusMinutes = selectedRecorded
    .filter((event) => event.kind === "focus")
    .reduce((total, event) => total + (event.minutes || 0), 0);
  const selectedSteps = selectedRecorded.filter(
    (event) => event.kind === "task-completed",
  ).length;

  const eventMeta = (
    kind: CalendarEventKind,
  ): { label: string; icon: LucideIcon; tone: string; iconTone: string } => {
    switch (kind) {
      case "planted":
        return {
          label: copy.planted,
          icon: Sprout,
          tone: "border-[var(--tone-seed-border)] bg-[var(--tone-seed-bg)]",
          iconTone: "text-[var(--tone-seed)]",
        };
      case "watered":
        return {
          label: copy.watered,
          icon: Droplets,
          tone: "border-[var(--tone-water-border)] bg-[var(--tone-water-bg)]",
          iconTone: "text-[var(--tone-water)]",
        };
      case "task-completed":
        return {
          label: copy.task,
          icon: CheckCircle2,
          tone: "border-[var(--tone-sprout-border)] bg-[var(--tone-sprout-bg)]",
          iconTone: "text-[var(--tone-sprout)]",
        };
      case "focus":
        return {
          label: copy.focus,
          icon: Clock,
          tone: "border-[var(--border)] bg-[var(--surface-soft)]",
          iconTone: "text-[var(--sage)]",
        };
      case "harvested":
        return {
          label: copy.harvested,
          icon: Sparkles,
          tone: "border-[var(--tone-harvest-border)] bg-[var(--tone-harvest-bg)]",
          iconTone: "text-[var(--tone-harvest)]",
        };
      case "daily-closed":
        return {
          label: copy.closed,
          icon: Leaf,
          tone: "border-[var(--border)] bg-[var(--surface-soft)]",
          iconTone: "text-[var(--sage)]",
        };
      case "due":
        return {
          label: copy.due,
          icon: Target,
          tone: "border-dashed border-[var(--seed-accent)]/45 bg-[var(--surface-strong)]",
          iconTone: "text-[var(--seed-accent)]",
        };
    }
  };
  const strongestKind = (
    events: CalendarEvent[],
  ): CalendarEventKind | undefined => {
    const recorded = events.filter(isRecordedCalendarEvent);
    return (
      [
        "harvested",
        "daily-closed",
        "task-completed",
        "focus",
        "watered",
        "planted",
      ] as CalendarEventKind[]
    ).find((kind) => recorded.some((event) => event.kind === kind));
  };
  const eventDetail = (event: CalendarEvent) => {
    if (event.kind === "focus")
      return `${event.minutes || 0} ${copy.minute} · ${event.noteTitle}`;
    if (event.kind === "daily-closed") {
      const outcome =
        event.detail === "yes"
          ? appLanguage === "en"
            ? "Intention completed"
            : "Intención completada"
          : event.detail === "some"
            ? appLanguage === "en"
              ? "Some progress"
              : "Hubo algo de avance"
            : event.detail === "no"
              ? appLanguage === "en"
                ? "Not today"
                : "No fue hoy"
              : undefined;
      return outcome;
    }
    return event.detail;
  };
  const renderEvent = (event: CalendarEvent) => {
    const meta = eventMeta(event.kind);
    const EventIcon = meta.icon;
    const detail = eventDetail(event);
    const canOpen = event.kind !== "daily-closed";
    return (
      <button
        key={event.id}
        type="button"
        disabled={!canOpen}
        onClick={() => {
          if (!canOpen) return;
          onSelectNote(event.noteId);
          onExit();
        }}
        className={`group/event flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${meta.tone} ${canOpen ? "hover:border-[var(--sage)]" : "cursor-default"}`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)] ${meta.iconTone}`}
        >
          <EventIcon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {meta.label}
            </span>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">
              {event.category === "plan"
                ? copy.plan
                : format(event.at, "HH:mm")}
            </span>
          </span>
          <span className="mt-0.5 block text-sm font-semibold leading-snug text-[var(--earth)]">
            {event.title}
          </span>
          {detail && (
            <span className="mt-1 block text-xs font-medium leading-relaxed text-[var(--text-muted)]">
              {detail}
            </span>
          )}
        </span>
        {canOpen && (
          <ChevronRight
            size={15}
            className="mt-3 shrink-0 text-[var(--text-muted)] transition-transform group-hover/event:translate-x-0.5"
          />
        )}
      </button>
    );
  };
  const renderTimeline = (events: CalendarEvent[]) => {
    const activity = events.filter((event) => event.category === "activity");
    const reflections = events.filter(
      (event) => event.category === "reflection",
    );
    const plans = events.filter((event) => event.category === "plan");
    if (events.length === 0) {
      return (
        <div className="rounded-2xl bg-[var(--bg-app)] p-5 text-center">
          <Leaf className="mx-auto text-[var(--sage)] opacity-45" size={22} />
          <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
            {copy.quiet}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {activity.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {copy.activity}
            </p>
            <div className="space-y-2">{activity.map(renderEvent)}</div>
          </section>
        )}
        {reflections.length > 0 && (
          <section>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sage)]">
              <Leaf size={13} /> {copy.reflection}
            </p>
            <div className="space-y-2">{reflections.map(renderEvent)}</div>
          </section>
        )}
        {plans.length > 0 && (
          <section>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--seed-accent)]">
              <Target size={13} /> {copy.plan}
            </p>
            <div className="space-y-2">{plans.map(renderEvent)}</div>
          </section>
        )}
      </div>
    );
  };

  const weekLabels =
    appLanguage === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const monthStartOffset = (monthStart.getDay() + 6) % 7;
  const calendarDays = [
    ...Array.from({ length: monthStartOffset }, () => null),
    ...monthDays,
  ];
  const calendarCells = [
    ...calendarDays,
    ...Array.from(
      { length: Math.ceil(calendarDays.length / 7) * 7 - calendarDays.length },
      () => null,
    ),
  ];
  const calendarRows = Math.max(5, calendarCells.length / 7);

  useEffect(() => {
    const now = new Date();
    if (!isSameMonth(now, monthStart)) return;
    const frame = window.requestAnimationFrame(() =>
      mobileTodayRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      }),
    );
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => goToMonth(subMonths(currentMonth, 1))}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)] transition-colors hover:bg-[var(--surface-hover)]"
            aria-label={copy.previous}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h3 className="truncate text-xl font-semibold capitalize tracking-tight text-[var(--earth)] sm:text-3xl">
              {formatMonthYear(currentMonth)}
            </h3>
            <div className="mt-1 flex items-center justify-center gap-2 text-xs font-medium text-[var(--text-muted)]">
              <span>
                {monthSummary.activeDays} {copy.activeDays}
              </span>
              <span>·</span>
              <span>
                {activeStreak} {copy.streak}
              </span>
              <button
                onClick={goToToday}
                className="rounded-full bg-[var(--bg-app)] px-2 py-1 font-semibold text-[var(--sage)]"
              >
                {copy.today}
              </button>
            </div>
          </div>
          <button
            onClick={() => goToMonth(addMonths(currentMonth, 1))}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)] transition-colors hover:bg-[var(--surface-hover)]"
            aria-label={copy.next}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={onExit}
            className="hidden h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-app)] px-3.5 text-sm font-semibold text-[var(--sage)] transition-colors hover:bg-[var(--surface-soft)] sm:inline-flex"
            aria-label={copy.done}
          >
            <X size={16} />
            <span className="hidden lg:inline">{copy.done}</span>
          </button>
        </div>
        <div className="mt-3 hidden items-center justify-center gap-2 sm:flex">
          {[
            {
              label: copy.activeDays,
              value: monthSummary.activeDays,
              icon: CalendarIcon,
              tone: "text-[var(--sage)]",
            },
            {
              label: copy.steps,
              value: monthSummary.steps,
              icon: CheckCircle2,
              tone: "text-[var(--tone-sprout)]",
            },
            {
              label: copy.focusMinutes,
              value: `${monthSummary.focusMinutes}m`,
              icon: Clock,
              tone: "text-[var(--sage)]",
            },
            {
              label: copy.harvests,
              value: monthSummary.harvests,
              icon: Sparkles,
              tone: "text-[var(--tone-harvest)]",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex h-9 items-center gap-2 rounded-full bg-[var(--bg-app)] px-3"
            >
              <item.icon size={14} className={item.tone} />
              <span className="text-base font-semibold text-[var(--earth)]">
                {item.value}
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 sm:grid sm:grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_24rem] xl:grid-rows-1">
        <div className="h-full overflow-y-auto px-4 py-3 app-scrollbar sm:hidden">
          <div className="space-y-2 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
            {monthDays.map((day) => {
              const events = calendarEventsForDay(eventsByDay, day);
              const recorded = events.filter(isRecordedCalendarEvent);
              const plans = events.filter((event) => event.category === "plan");
              const kind = strongestKind(events);
              const meta = kind ? eventMeta(kind) : null;
              const DayIcon = meta?.icon || Leaf;
              const isSelected = isSameDay(day, selectedDay);
              const isTodayDay = isToday(day);
              return (
                <motion.div
                  key={format(day, "yyyy-MM-dd")}
                  ref={isTodayDay ? mobileTodayRef : undefined}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`overflow-hidden rounded-[1.35rem] border bg-[var(--surface-strong)] shadow-sm ${isSelected ? "border-[var(--sage)] ring-2 ring-[var(--sage)]/12" : "border-[var(--border)]"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span className="w-12 shrink-0 text-center">
                      <span className="block text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                        {format(day, "EEE", { locale: appDateLocale })}
                      </span>
                      <span
                        className={`mt-1 block text-2xl font-semibold leading-none ${isTodayDay ? "text-[var(--sage)]" : "text-[var(--earth)]"}`}
                      >
                        {format(day, "d")}
                      </span>
                    </span>
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${meta?.tone || "bg-[var(--bg-app)]"} ${meta?.iconTone || "text-[var(--text-muted)]"}`}
                    >
                      <DayIcon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold capitalize text-[var(--earth)]">
                        {formatDayMonth(day)}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                        <span>
                          {recorded.length > 0
                            ? `${recorded.length} ${copy.events}`
                            : copy.noActivity}
                        </span>
                        {plans.length > 0 && (
                          <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[var(--seed-accent)]">
                            {plans.length} {copy.planCount}
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-[var(--text-muted)] transition-transform ${isSelected ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-[var(--border)] px-3 pb-3 pt-3">
                          {renderTimeline(events)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="relative hidden min-h-0 overflow-hidden p-3 sm:flex sm:p-4">
          <div className="mx-auto flex h-full w-full max-w-7xl min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-2 sm:p-4">
            <div className="grid shrink-0 grid-cols-7 gap-1 sm:gap-2">
              {weekLabels.map((label) => (
                <div
                  key={label}
                  className="px-1 py-2 text-center text-[11px] font-semibold text-[var(--text-muted)]"
                >
                  {label}
                </div>
              ))}
            </div>
            <div
              className="mt-1 grid min-h-0 flex-1 grid-cols-7 gap-1 sm:gap-2"
              style={{
                gridTemplateRows: `repeat(${calendarRows}, minmax(0, 1fr))`,
              }}
            >
              {calendarCells.map((day, index) => {
                if (!day)
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-0 rounded-xl bg-[var(--bg-app)]/45 sm:rounded-2xl"
                    />
                  );
                const events = calendarEventsForDay(eventsByDay, day);
                const recorded = events.filter(isRecordedCalendarEvent);
                const plans = events.filter(
                  (event) => event.category === "plan",
                );
                const kind = strongestKind(events);
                const meta = kind ? eventMeta(kind) : null;
                const DayIcon = meta?.icon || Leaf;
                const isSelected = isSameDay(day, selectedDay);
                const isTodayDay = isToday(day);
                return (
                  <button
                    key={format(day, "yyyy-MM-dd")}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    aria-label={`${copy.day} ${format(day, "d")}`}
                    className={`group relative flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-xl border p-1 text-center transition-colors sm:rounded-2xl sm:p-2 ${isSelected ? "border-[var(--sage)] bg-[var(--bg-app)] ring-2 ring-[var(--sage)]/18" : isTodayDay ? "border-[var(--earth)]/20 bg-[var(--bg-app)]" : recorded.length > 0 ? "border-[var(--border)] bg-[var(--surface-strong)]/70" : "border-transparent hover:bg-[var(--bg-app)]"}`}
                  >
                    <span className="absolute left-2 top-2 text-xs font-semibold text-[var(--text-muted)]">
                      {format(day, "d")}
                    </span>
                    {isTodayDay && (
                      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--earth)]" />
                    )}
                    <span
                      className={`relative grid h-[clamp(1.8rem,4.5vh,3.25rem)] w-[clamp(1.8rem,4.5vh,3.25rem)] place-items-center rounded-full ${isSelected ? "bg-[var(--sage)] text-[var(--on-sage)]" : recorded.length > 0 ? `${meta?.tone || "bg-[var(--surface-soft)]"} ${meta?.iconTone || "text-[var(--sage)]"}` : "bg-[var(--bg-app)] text-[var(--text-muted)]"}`}
                    >
                      <DayIcon size={17} />
                      {plans.length > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-strong)] bg-[var(--seed-accent)]" />
                      )}
                    </span>
                    <span className="mt-2 hidden max-w-full truncate rounded-full bg-[var(--surface-soft)] px-2 py-1 text-[9px] font-semibold text-[var(--text-muted)] min-[720px]:inline-flex">
                      {recorded.length > 0
                        ? `${recorded.length} ${copy.events}`
                        : plans.length > 0
                          ? `${plans.length} ${copy.planCount}`
                          : appLanguage === "en"
                            ? "Open"
                            : "Libre"}
                    </span>
                    <span className="mt-1 flex h-2 items-center justify-center gap-1">
                      {events.some(
                        (event) => event.kind === "task-completed",
                      ) && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--tone-sprout)]" />
                      )}
                      {events.some((event) => event.kind === "focus") && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--sage)]" />
                      )}
                      {events.some((event) => event.kind === "harvested") && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--tone-harvest)]" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="hidden max-h-[34vh] min-h-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-strong)] p-5 app-scrollbar sm:block xl:max-h-none xl:border-l xl:border-t-0">
          <h4 className="text-2xl font-semibold capitalize tracking-tight text-[var(--earth)]">
            {formatDayMonth(selectedDay)}
          </h4>
          <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
            {selectedRecorded.length > 0
              ? `${selectedRecorded.length} ${copy.events} · ${selectedPlans.length} ${copy.planCount}`
              : selectedPlans.length > 0
                ? `${selectedPlans.length} ${copy.planCount} · ${copy.noActivity.toLowerCase()}`
                : copy.quiet}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              {
                label: copy.events,
                value: selectedRecorded.length,
                tone: "text-[var(--sage)]",
              },
              {
                label: copy.steps,
                value: selectedSteps,
                tone: "text-[var(--tone-sprout)]",
              },
              {
                label: copy.focusMinutes,
                value: `${selectedFocusMinutes}m`,
                tone: "text-[var(--earth)]",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-[var(--bg-app)] px-2 py-2.5"
              >
                <p className={`text-base font-semibold ${item.tone}`}>
                  {item.value}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5">{renderTimeline(selectedEvents)}</div>
        </aside>
      </div>
      <button
        onClick={onExit}
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm font-semibold text-[var(--sage)] shadow-lg backdrop-blur-xl sm:hidden"
      >
        <X size={16} /> {copy.done}
      </button>
    </motion.div>
  );
}
