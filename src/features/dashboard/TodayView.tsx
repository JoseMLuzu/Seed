/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Fragment,
  useState,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import { appDateLocale, appLanguage, t } from "../../app/i18n";
import { formatShortDate } from "../../app/dates";
import { UpcomingPanel } from "../../UpcomingPanel";
import { NoteCareStatus } from "../../NoteCareStatus";
import { GardenerJournal, type JournalDraft } from "../../GardenerJournal";
import { GardenBoardPreview } from "../../GardenBoard";
import { GardenMotif } from "../../GardenMotif";
import { gardenName } from "../../gardenVocabulary";
import { DailyFocusCard } from "../../DailyFocusCard";
import { getDailyFocusOutcome, getDailyFocusState } from "../../dailyFocus";
import {
  getGroupCareState,
  getGardenMovement,
  getDailyHarvest,
  getContinuationProject,
} from "../../dashboardInsights";
import { getUpcomingItems } from "../../upcoming";
import type { DashboardModuleId as TodayWidgetId } from "../../dashboardModules";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import {
  Plus,
  Clock,
  Leaf,
  Sprout,
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowUp,
  Lightbulb,
  BookOpen,
  Sun,
  Moon,
  X,
  Calendar as CalendarIcon,
  ChevronRight,
  LayoutGrid,
  Box,
  Settings,
  Droplets,
  Archive,
  Target,
  Sparkles,
} from "lucide-react";
import type {
  SeedNote,
  DailyIntentionOutcome,
  DailyNextStep,
} from "../../types";
import {
  getDailyActivitySnapshot,
  isDailyClosureForDate,
  isDailyEntryNote,
  wateringDue,
} from "../../seedLogic";
import type { AppView, CreateMode } from "../../app/types";
import { formatReviewAge, priorityWeight } from "../notes/notePresentation";

export function TodayView({
  accountName,
  notes,
  quickNote,
  setQuickNote,
  onQuickCapture,
  onUndoCapture,
  onOpenWatering,
  onSkipWatering,
  onSelectNote,
  onToggleTask,
  onFocusNote,
  onStartPlanting,
  onCloseDay,
  onSaveDailyFocus,
  onStartDailyFocus,
  onToggleDailyFocus,
  onContinuePrevious,
  onDismissPrevious,
  onNavigate,
  onShowWateringQueue,
  onCustomize,
  onDevelopNote,
  onSaveLater,
  onUpdateNote,
  onReuseHarvest,
  onSaveJournal,
  boardRaw,
  reviewSnoozes,
  onSnoozeReview,
  featuredProjectId,
  onFeatureProject,
  todayWidgets,
  dashboardOrder,
  wateredToday,
  wateringStreak,
  getProgress,
  dailyIntention,
  dailyIntentionNoteId,
  currentDailyEntry,
  previousDailyEntry,
}: {
  accountName: string;
  notes: SeedNote[];
  quickNote: string;
  setQuickNote: (value: string) => void;
  onQuickCapture: () => string | undefined;
  onUndoCapture: (id: string) => void;
  onOpenWatering: (id: string) => void;
  onSkipWatering: (id: string) => void;
  onSelectNote: (id: string) => void;
  onToggleTask: (noteId: string, taskId: string) => void;
  onFocusNote: (id: string) => void;
  onStartPlanting: (
    mode?: CreateMode,
    seedType?: NonNullable<SeedNote["seedType"]>,
  ) => void;
  onCloseDay: (
    reflection: string,
    intention: string,
    intentionOutcome?: DailyIntentionOutcome,
    nextStep?: DailyNextStep,
  ) => void;
  onSaveDailyFocus: (
    intention: string,
    linkedNoteId?: string,
    linkedTaskId?: string,
  ) => void;
  onStartDailyFocus: () => void;
  onToggleDailyFocus: () => void;
  onContinuePrevious: (entry: SeedNote) => void;
  onDismissPrevious: (entryId: string) => void;
  onNavigate: (view: AppView) => void;
  onShowWateringQueue: () => void;
  onCustomize: () => void;
  onDevelopNote: (id: string) => void;
  onSaveLater: (id: string) => void;
  onUpdateNote: (id: string, updates: Partial<SeedNote>) => void;
  onReuseHarvest: (id: string) => string | undefined;
  onSaveJournal: (draft: JournalDraft) => void;
  boardRaw: string | null;
  reviewSnoozes: Record<string, number>;
  onSnoozeReview: (id: string) => void;
  featuredProjectId: string;
  onFeatureProject: (id: string) => void;
  todayWidgets: TodayWidgetId[];
  dashboardOrder: TodayWidgetId[];
  wateredToday: boolean;
  wateringStreak: number;
  getProgress: (note: SeedNote) => number;
  dailyIntention: string;
  dailyIntentionNoteId: string;
  currentDailyEntry?: SeedNote;
  previousDailyEntry?: SeedNote;
}) {
  const en = appLanguage === "en";
  const copy = (esText: string, enText: string) => (en ? enText : esText);
  const [showDaySummary, setShowDaySummary] = useState(false);
  const [dayReflection, setDayReflection] = useState("");
  const [intentionOutcome, setIntentionOutcome] =
    useState<DailyIntentionOutcome>("");
  const [nextDayChoice, setNextDayChoice] = useState<DailyNextStep>("");
  const [now, setNow] = useState(Date.now);
  const [capturedId, setCapturedId] = useState<string | null>(null);
  const [reusedHarvestId, setReusedHarvestId] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const liveNotes = notes.filter((note) => !isDailyEntryNote(note));
  const activeNotes = liveNotes.filter(
    (note) =>
      !note.paused &&
      note.growthStage !== "bloom" &&
      note.growthStage !== "withered",
  );
  const inboxNotes = activeNotes
    .filter((note) => note.inbox)
    .sort((a, b) => b.createdAt - a.createdAt);
  const projects = activeNotes
    .filter((note) => !note.inbox && note.isGrowth)
    .sort(
      (a, b) =>
        priorityWeight(b) - priorityWeight(a) ||
        (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
    );
  const harvests = liveNotes
    .filter((note) => !note.inbox && note.growthStage === "bloom")
    .sort(
      (a, b) =>
        (b.harvestedAt || b.updatedAt || b.createdAt) -
        (a.harvestedAt || a.updatedAt || a.createdAt),
    );
  const thirstyNotes = activeNotes
    .filter((note) => wateringDue(note, now))
    .sort(
      (a, b) =>
        priorityWeight(b) - priorityWeight(a) ||
        (a.lastWateredAt || a.createdAt) - (b.lastWateredAt || b.createdAt),
    );
  const learningMemory = getDailyHarvest(harvests, now);
  const movement = getGardenMovement(liveNotes, now);
  const capturedNote = notes.find((note) => note.id === capturedId);
  const captureIdea = () => {
    const id = onQuickCapture();
    if (id) {
      setCapturedId(id);
      setNow(Date.now());
    }
  };
  const savedIntention = dailyIntention.trim();
  const linkedIntentionNote = liveNotes.find(
    (note) => note.id === dailyIntentionNoteId,
  );
  const dailyFocus = getDailyFocusState(currentDailyEntry, notes);
  const linkedIntentionProgress = dailyFocus.complete ? 100 : 0;
  const dayAlreadyClosed = Boolean(
    currentDailyEntry && isDailyClosureForDate(currentDailyEntry),
  );
  const today = new Date(now);
  const greeting =
    today.getHours() < 12
      ? t("goodMorning")
      : today.getHours() < 19
        ? t("goodAfternoon")
        : t("goodEvening");
  const firstName =
    accountName.trim().split(/\s+/)[0] || copy("jardinero", "there");
  const {
    planted: plantedToday,
    watered: wateredTodayCount,
    steps: stepsToday,
    harvests: completedToday,
    focusMinutes: focusMinutesToday,
  } = getDailyActivitySnapshot(notes);
  const activityHeadline =
    plantedToday ||
    wateredTodayCount ||
    stepsToday ||
    completedToday ||
    focusMinutesToday
      ? copy(
          plantedToday +
            " ideas plantadas · " +
            stepsToday +
            " pasos · " +
            focusMinutesToday +
            " min de enfoque",
          plantedToday +
            " ideas planted · " +
            stepsToday +
            " steps · " +
            focusMinutesToday +
            " focused min",
        )
      : copy(
          "Un día tranquilo también cuenta. Mañana puedes continuar.",
          "A quiet day counts too. You can continue tomorrow.",
        );
  const closeDaySummary = () => {
    setShowDaySummary(false);
    setIntentionOutcome("");
    setNextDayChoice("");
  };
  const handleCloseDayClick = () => {
    setDayReflection(currentDailyEntry?.dailyEntry?.reflection || "");
    const outcome = dayAlreadyClosed
      ? currentDailyEntry?.dailyEntry?.outcome || ""
      : getDailyFocusOutcome(currentDailyEntry, notes);
    setIntentionOutcome(outcome);
    setNextDayChoice(
      dayAlreadyClosed
        ? currentDailyEntry?.dailyEntry?.nextStep || ""
        : outcome === "some" || outcome === "no"
          ? "garden"
          : "",
    );
    setShowDaySummary(true);
  };

  const spaces = [
    {
      label: gardenName("idea", en ? "en" : "es"),
      count: inboxNotes.length,
      detail: movement.newIdeas
        ? copy(
            `${movement.newIdeas} nuevas esta semana`,
            `${movement.newIdeas} new this week`,
          )
        : copy("Un lugar para explorar", "Room to explore"),
      icon: Lightbulb,
      tone: "seed",
      care: getGroupCareState(inboxNotes, now),
      view: "inbox" as AppView,
    },
    {
      label: copy("Brotes", "Sprouts"),
      count: projects.length,
      detail: movement.projectsWithNextStep
        ? copy(
            `${movement.projectsWithNextStep} con siguiente paso`,
            `${movement.projectsWithNextStep} with a next step`,
          )
        : copy("Define un pequeño paso", "Choose a small step"),
      icon: Box,
      tone: "sprout",
      care: getGroupCareState(projects, now),
      view: "projects" as AppView,
    },
    {
      label: copy("Cosechas", "Harvests"),
      count: harvests.length,
      detail: movement.recentHarvests
        ? copy(
            `${movement.recentHarvests} logros esta semana`,
            `${movement.recentHarvests} wins this week`,
          )
        : copy("Lo que ya construiste", "What you have built"),
      icon: Archive,
      tone: "harvest",
      care: null,
      view: "harvest" as AppView,
    },
  ];
  const enabled = (id: TodayWidgetId) => todayWidgets.includes(id);
  const upcomingIds = new Set(
    enabled("upcoming")
      ? getUpcomingItems(notes)
          .slice(0, 3)
          .map((item) => item.note.id)
      : [],
  );
  if (enabled("focus")) upcomingIds.add(dailyIntentionNoteId);
  const continuationProject = getContinuationProject(
    projects,
    featuredProjectId,
    upcomingIds,
  );
  const reviewCandidates = thirstyNotes.filter(
    (note) => (reviewSnoozes[note.id] || 0) <= now,
  );
  const reviewNote = reviewCandidates[0];
  const moduleCards: Record<TodayWidgetId, ReactNode> = {
    capture: (
      <section
        className="dashboard-capture"
        aria-label={copy("Plantar · captura rápida", "Plant · quick capture")}
      >
        <div className="dashboard-capture-title">
          <span className="dashboard-eyebrow">
            {copy("PLANTA ALGO", "PLANT SOMETHING")}
          </span>
          <span>
            {copy(
              "No necesitas tenerlo todo claro.",
              "It doesn’t have to be fully formed.",
            )}
          </span>
        </div>
        <form
          className="dashboard-capture-form"
          onSubmit={(event) => {
            event.preventDefault();
            captureIdea();
          }}
        >
          <span className="dashboard-capture-mark">
            <Leaf size={23} strokeWidth={1.6} />
          </span>
          <label>
            <span className="sr-only">
              {copy("¿Qué tienes en mente?", "What is on your mind?")}
            </span>
            <input
              value={quickNote}
              onChange={(event) => setQuickNote(event.target.value)}
              placeholder={copy(
                "¿Qué tienes en mente?",
                "What is on your mind?",
              )}
            />
          </label>
          <button
            type="submit"
            disabled={!quickNote.trim()}
            className="dashboard-capture-submit"
            aria-label={copy("Guardar idea rápida", "Save quick idea")}
          >
            <ArrowUp size={23} />
          </button>
        </form>
        <div className="dashboard-create-options">
          <span className="dashboard-capture-hint">
            {copy("O empieza con", "Or start with")}
          </span>
          {[
            {
              label: gardenName("idea", en ? "en" : "es", true),
              icon: Lightbulb,
              mode: "seed" as CreateMode,
              type: "idea" as const,
            },
            {
              label: copy("Brote", "Sprout"),
              icon: Box,
              mode: "sprout" as CreateMode,
              type: "project" as const,
            },
            {
              label: copy("Fruto deseado", "Desired fruit"),
              icon: Target,
              mode: "seed" as CreateMode,
              type: "goal" as const,
            },
            {
              label: gardenName("learning", en ? "en" : "es", true),
              icon: BookOpen,
              mode: "journal" as CreateMode,
              type: "learning" as const,
            },
          ].map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => onStartPlanting(item.mode, item.type)}
            >
              <item.icon size={16} strokeWidth={1.7} />
              {item.label}
            </button>
          ))}
        </div>
        {capturedNote && (
          <div className="dashboard-capture-feedback" role="status">
            <Sprout size={17} aria-hidden="true" />
            <span>
              {copy(
                "Idea guardada. Una nueva semilla.",
                "Idea saved. A new seed planted.",
              )}
            </span>
            <button
              type="button"
              className="dashboard-text-button"
              onClick={() => onDevelopNote(capturedNote.id)}
            >
              {copy("Desarrollar", "Develop")}
            </button>
            {capturedNote.inbox && !capturedNote.isGrowth && (
              <button
                type="button"
                className="dashboard-text-button"
                onClick={() => {
                  onUndoCapture(capturedNote.id);
                  setCapturedId(null);
                }}
              >
                {copy("Deshacer", "Undo")}
              </button>
            )}
          </div>
        )}
      </section>
    ),
    focus: (
      <DailyFocusCard
        key={currentDailyEntry?.id || "new-focus"}
        entry={currentDailyEntry}
        intention={dailyIntention}
        notes={liveNotes}
        previousEntry={previousDailyEntry}
        language={en ? "en" : "es"}
        onSave={onSaveDailyFocus}
        onStart={onStartDailyFocus}
        onToggleComplete={onToggleDailyFocus}
        onContinuePrevious={onContinuePrevious}
        onDismissPrevious={onDismissPrevious}
      />
    ),
    upcoming: (
      <UpcomingPanel
        notes={notes}
        language={en ? "en" : "es"}
        onSelectNote={onSelectNote}
        onOpenCalendar={() => onNavigate("calendar")}
        onUpdateNote={onUpdateNote}
      />
    ),
    summary: (
      <nav
        className="dashboard-spaces"
        aria-label={copy("Explorar tu jardín", "Explore your garden")}
      >
        {spaces.map((space) => (
          <button
            key={space.view}
            type="button"
            className={"dashboard-space dashboard-tone-" + space.tone}
            onClick={() => onNavigate(space.view)}
          >
            <span className="dashboard-space-top">
              <span className="dashboard-icon">
                <space.icon size={21} strokeWidth={1.6} />
              </span>
              <NoteCareStatus
                state={space.care}
                language={en ? "en" : "es"}
                compact
              />
              <ChevronRight size={16} />
            </span>
            <span className="dashboard-space-title">
              <strong>{space.count}</strong>
              <span>{space.label}</span>
            </span>
            <span className="dashboard-space-detail">{space.detail}</span>
          </button>
        ))}
      </nav>
    ),
    watering: (
      <article className="dashboard-recommendation">
        <div className="dashboard-card-heading">
          <span className="dashboard-icon">
            {!reviewNote && !thirstyNotes.length ? (
              <Sun
                size={21}
                strokeWidth={1.6}
                className="dashboard-calm-sun"
                aria-hidden="true"
              />
            ) : (
              <Sprout size={21} strokeWidth={1.6} aria-hidden="true" />
            )}
          </span>
          {reviewNote ? (
            <NoteCareStatus
              note={reviewNote}
              language={en ? "en" : "es"}
              now={now}
            />
          ) : (
            <span className="dashboard-eyebrow">
              {copy("SIN PRISA", "NO RUSH")}
            </span>
          )}
        </div>
        <p className="dashboard-eyebrow">
          {copy("¿SEGUIMOS CULTIVANDO ESTO?", "KEEP GROWING THIS?")}
        </p>
        <h3>
          {reviewNote
            ? reviewNote.title
            : thirstyNotes.length
              ? copy(
                  "Un poco de espacio para mañana.",
                  "A little room for tomorrow.",
                )
              : copy("Tu jardín está al día.", "Your garden is up to date.")}
        </h3>
        <p className="dashboard-card-description">
          {reviewNote
            ? formatReviewAge(reviewNote) +
              ". " +
              copy(
                "Un momento para decidir, no una obligación.",
                "A moment to decide, not an obligation.",
              )
            : thirstyNotes.length
              ? copy(
                  "Has dejado estas revisiones para mañana. Siguen disponibles en tu jardín.",
                  "You left these reviews for tomorrow. They are still in your garden.",
                )
              : copy(
                  "Nada necesita riego ahora. Puedes explorar lo que ya guardaste.",
                  "Nothing needs watering right now. Explore what you have saved.",
                )}
        </p>
        {reviewNote &&
          reviewNote.content.trim() &&
          reviewNote.content.trim() !== reviewNote.title.trim() && (
            <p className="dashboard-review-excerpt">{reviewNote.content}</p>
          )}
        <div className="dashboard-review-actions">
          <button
            type="button"
            className="dashboard-primary-button"
            onClick={() =>
              reviewNote ? onOpenWatering(reviewNote.id) : onNavigate("inbox")
            }
          >
            {reviewNote
              ? copy("Regar y decidir", "Water and decide")
              : copy("Explorar ideas", "Explore ideas")}
            <ArrowRight size={16} />
          </button>
          {reviewNote && (
            <>
              <button
                type="button"
                className="dashboard-text-button"
                onClick={() =>
                  reviewNote.isGrowth
                    ? onFocusNote(reviewNote.id)
                    : onDevelopNote(reviewNote.id)
                }
              >
                {copy("Desarrollar", "Develop")}
              </button>
              <button
                type="button"
                className="dashboard-text-button"
                onClick={() => onSnoozeReview(reviewNote.id)}
              >
                {copy("Mañana", "Tomorrow")}
              </button>
              <button
                type="button"
                className="dashboard-text-button"
                onClick={() => onSaveLater(reviewNote.id)}
              >
                <Archive size={14} />
                {copy("El cobertizo", "The shed")}
              </button>
            </>
          )}
          {thirstyNotes.length > 1 && (
            <button
              type="button"
              className="dashboard-text-button"
              onClick={onShowWateringQueue}
            >
              {copy("Ver todas", "View all")}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </article>
    ),
    projects: (
      <section className="dashboard-projects">
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-eyebrow">
              {copy("RETOMA EL HILO", "PICK UP THE THREAD")}
            </p>
            <h2>{copy("Retomar un brote", "Pick up a sprout")}</h2>
          </div>
          <button
            type="button"
            className="dashboard-text-button"
            onClick={() => onNavigate("projects")}
          >
            {copy("Ver todos", "View all")}
            <ChevronRight size={15} />
          </button>
        </div>
        {projects.length > 0 && (
          <label className="dashboard-project-picker">
            <span>{copy("Brote destacado", "Featured sprout")}</span>
            <select
              value={
                featuredProjectId &&
                projects.some((note) => note.id === featuredProjectId)
                  ? featuredProjectId
                  : ""
              }
              onChange={(event) => onFeatureProject(event.target.value)}
            >
              <option value="">
                {copy(
                  "Automático · donde lo dejaste",
                  "Automatic · where you left off",
                )}
              </option>
              {projects.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {continuationProject ? (
          <div className="dashboard-project-list">
            {[continuationProject].map((note) => {
              const progress = getProgress(note);
              const task = note.tasks.find((item) => !item.completed);
              const lastStep = note.tasks
                .filter((item) => item.completed && item.completedAt)
                .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
              return (
                <article key={note.id} className="dashboard-project">
                  <button
                    type="button"
                    className="dashboard-project-open"
                    onClick={() => onSelectNote(note.id)}
                  >
                    <span
                      className="dashboard-project-ring"
                      style={{ "--progress": progress + "%" } as CSSProperties}
                    >
                      <Box size={18} strokeWidth={1.5} />
                    </span>
                    <span className="dashboard-project-title">
                      <strong>{note.title}</strong>
                      <span>
                        {note.tasks.filter((item) => item.completed).length}/
                        {note.tasks.length}{" "}
                        {copy("labores completadas", "garden tasks complete")}
                      </span>
                    </span>
                    <NoteCareStatus
                      note={note}
                      language={en ? "en" : "es"}
                      now={now}
                      compact
                    />
                    <span className="dashboard-project-percent">
                      {progress}%
                    </span>
                  </button>
                  {lastStep && (
                    <p className="dashboard-project-last-step">
                      {copy("Último avance: ", "Last step: ")}
                      {lastStep.text}
                    </p>
                  )}
                  {task ? (
                    <div className="dashboard-project-task">
                      <button
                        type="button"
                        className="dashboard-task-check"
                        onClick={() => onToggleTask(note.id, task.id)}
                        aria-label={
                          copy("Completar: ", "Complete: ") + task.text
                        }
                      >
                        <Circle size={19} />
                      </button>
                      <button
                        type="button"
                        className="dashboard-task-title"
                        onClick={() => onFocusNote(note.id)}
                      >
                        {task.text}
                      </button>
                      <button
                        type="button"
                        className="dashboard-icon-button"
                        onClick={() => onFocusNote(note.id)}
                        aria-label={
                          copy("Enfocarme en ", "Focus on ") + note.title
                        }
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="dashboard-text-button dashboard-add-step"
                      onClick={() => onSelectNote(note.id)}
                    >
                      <Plus size={15} />
                      {copy("Define el siguiente paso", "Define the next step")}
                    </button>
                  )}
                  <div className="dashboard-project-actions">
                    {task && (
                      <button
                        type="button"
                        className="dashboard-text-button"
                        onClick={() => onFocusNote(note.id)}
                      >
                        <Target size={15} />
                        {gardenName("focus", en ? "en" : "es")}
                      </button>
                    )}
                    {wateringDue(note, now) && (
                      <button
                        type="button"
                        className="dashboard-text-button"
                        onClick={() => onOpenWatering(note.id)}
                      >
                        <Droplets size={15} />
                        {copy("Dar un riego", "Give it some water")}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-project-empty">
            <span className="dashboard-empty-art">
              <Sprout size={33} strokeWidth={1.3} />
            </span>
            <h3>
              {projects.length
                ? copy(
                    "Tus proyectos ya están destacados.",
                    "Your projects are already highlighted.",
                  )
                : copy(
                    "De idea a algo real.",
                    "From an idea to something real.",
                  )}
            </h3>
            <p>
              {projects.length
                ? copy(
                    "Los encontrarás en Mi labor de hoy o en Próximas labores. Puedes ver todos desde aquí.",
                    "Find them in My task today or Upcoming garden tasks. Browse all of them from here.",
                  )
                : copy(
                    "Crea un proyecto y divídelo en pequeños pasos. Tu progreso aparecerá aquí.",
                    "Create a project and break it into small steps. Your progress will appear here.",
                  )}
            </p>
            <button
              type="button"
              className="dashboard-text-button"
              onClick={() =>
                projects.length
                  ? onNavigate("projects")
                  : onStartPlanting("sprout", "project")
              }
            >
              {projects.length ? <ArrowRight size={16} /> : <Plus size={16} />}
              {projects.length
                ? copy("Ver brotes", "View sprouts")
                : copy("Crear mi primer brote", "Create my first sprout")}
            </button>
          </div>
        )}
      </section>
    ),
    learning: (
      <aside className="dashboard-harvest">
        <GardenMotif stage="bloom" className="dashboard-harvest-motif" />
        <div className="dashboard-card-heading">
          <span className="dashboard-icon">
            <BookOpen size={21} strokeWidth={1.6} />
          </span>
          <span className="dashboard-eyebrow">
            {copy("LO QUE DIO FRUTO", "WHAT BORE FRUIT")}
          </span>
        </div>
        <h3>{gardenName("learning", en ? "en" : "es")}</h3>
        <p className="dashboard-harvest-quote">
          {learningMemory
            ? learningMemory.takeaway?.trim() ||
              learningMemory.reflection?.trim() ||
              copy(
                "Este proyecto está terminado. Puedes guardar lo que aprendiste al abrirlo.",
                "This project is complete. Open it to save what you learned.",
              )
            : copy(
                "Aquí viven tus proyectos terminados y las lecciones que vale la pena guardar.",
                "Your completed projects and lessons worth keeping live here.",
              )}
        </p>
        {learningMemory && (
          <p className="dashboard-harvest-source">
            {learningMemory.title}
            {learningMemory.harvestedAt && (
              <span> · {formatShortDate(learningMemory.harvestedAt)}</span>
            )}
          </p>
        )}
        <div className="dashboard-harvest-actions">
          <button
            type="button"
            className="dashboard-text-button"
            onClick={() =>
              learningMemory
                ? onSelectNote(learningMemory.id)
                : onNavigate("harvest")
            }
          >
            {copy("Abrir cosecha", "Open harvest")}
            <ArrowRight size={16} />
          </button>
          {learningMemory &&
            (learningMemory.takeaway?.trim() ||
              learningMemory.reflection?.trim()) && (
              <button
                type="button"
                className="dashboard-text-button"
                onClick={() => {
                  const id = onReuseHarvest(learningMemory.id);
                  if (id) setReusedHarvestId(id);
                }}
                disabled={Boolean(
                  reusedHarvestId &&
                  notes.some((note) => note.id === reusedHarvestId),
                )}
              >
                <Plus size={15} />
                {copy("Nueva idea desde aquí", "Start an idea from this")}
              </button>
            )}
        </div>
        {reusedHarvestId &&
          notes.some((note) => note.id === reusedHarvestId) && (
            <p className="dashboard-harvest-feedback" role="status">
              {copy(
                "Aprendizaje convertido en una nueva idea.",
                "Learning saved as a new idea.",
              )}{" "}
              <button
                type="button"
                className="dashboard-text-button"
                onClick={() => onSelectNote(reusedHarvestId)}
              >
                {copy("Abrir idea", "Open idea")}
                <ArrowRight size={14} />
              </button>
            </p>
          )}
      </aside>
    ),
    journal: (
      <GardenerJournal
        notes={notes}
        language={en ? "en" : "es"}
        onSave={onSaveJournal}
        onSelectNote={onSelectNote}
      />
    ),
    board: (
      <GardenBoardPreview
        raw={boardRaw}
        notes={liveNotes}
        language={en ? "en" : "es"}
        onOpen={() => onNavigate("board")}
      />
    ),
    activity: (
      <section
        aria-label={copy("Tu día en Seeds", "Your day in Seeds")}
        className={
          "dashboard-day-footer" +
          (today.getHours() >= 17 && !dayAlreadyClosed
            ? " dashboard-evening"
            : "")
        }
      >
        <div className="dashboard-activity">
          <span className="dashboard-eyebrow">
            {copy("POR HOY, ESTÁ BIEN", "ENOUGH FOR TODAY")}
          </span>
          <h3>
            {dayAlreadyClosed
              ? copy("Tu día ya tiene su cierre.", "Your day is wrapped up.")
              : copy("Los pequeños avances cuentan.", "Small steps count.")}
          </h3>
          {plantedToday ||
          stepsToday ||
          focusMinutesToday ||
          wateredTodayCount ||
          completedToday ? (
            <div className="dashboard-day-metrics">
              {plantedToday > 0 && (
                <span>
                  <Leaf size={15} />
                  <strong>{plantedToday}</strong>{" "}
                  {copy("ideas guardadas", "ideas saved")}
                </span>
              )}
              {stepsToday > 0 && (
                <span>
                  <CheckCircle2 size={15} />
                  <strong>{stepsToday}</strong>{" "}
                  {copy("labores", "garden tasks")}
                </span>
              )}
              {focusMinutesToday > 0 && (
                <span>
                  <Clock size={15} />
                  <strong>{focusMinutesToday}</strong>{" "}
                  {copy("min de foco", "focus min")}
                </span>
              )}
              {wateredTodayCount > 0 && (
                <span>
                  <Droplets size={15} />
                  <strong>{wateredTodayCount}</strong>{" "}
                  {copy("riegos", "watered")}
                </span>
              )}
              {completedToday > 0 && (
                <span>
                  <Archive size={15} />
                  <strong>{completedToday}</strong>{" "}
                  {copy("cosechas", "harvests")}
                </span>
              )}
            </div>
          ) : (
            <p className="dashboard-day-quiet">
              {copy(
                "Un día tranquilo también cuenta. Puedes cerrar sin añadir tareas.",
                "A quiet day counts too. You can wrap up without adding tasks.",
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          className="dashboard-close-day"
          onClick={handleCloseDayClick}
        >
          {dayAlreadyClosed ? <CheckCircle2 size={16} /> : <Moon size={16} />}
          {dayAlreadyClosed
            ? copy("Ver mi cierre", "View my reflection")
            : copy("Dejar descansar el jardín", "Let the garden rest")}
          <ChevronRight size={15} />
        </button>
      </section>
    ),
  };

  return (
    <motion.div
      key="today-view"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="seed-dashboard"
    >
      <header
        className="dashboard-welcome"
        data-garden-time={
          today.getHours() < 12
            ? "morning"
            : today.getHours() < 19
              ? "day"
              : "evening"
        }
      >
        <div className="dashboard-date-row">
          <p className="dashboard-eyebrow">
            {format(today, en ? "EEEE, MMMM d" : "EEEE, d 'de' MMMM", {
              locale: appDateLocale,
            })}
          </p>
          <button
            type="button"
            className="dashboard-calendar"
            onClick={() => onNavigate("calendar")}
            aria-label={copy("Abrir calendario", "Open calendar")}
          >
            <CalendarIcon size={19} />
          </button>
        </div>
        <h1>
          {greeting}, <span>{firstName}.</span>
        </h1>
        <p className="dashboard-garden-greeting">
          <span aria-hidden="true">
            {today.getHours() >= 19 ? <Moon size={14} /> : <Leaf size={14} />}
          </span>
          {dayAlreadyClosed
            ? copy(
                "Tu día ya tiene su cierre. El jardín sigue aquí.",
                "Your day is wrapped up. Your garden is still here.",
              )
            : today.getHours() < 12
              ? copy(
                  "Un nuevo día para cultivar lo importante.",
                  "A new day to grow what matters.",
                )
              : today.getHours() < 19
                ? copy(
                    "Hay espacio para crecer a tu ritmo.",
                    "There’s room to grow at your own pace.",
                  )
                : copy(
                    "Un momento de calma para tu jardín.",
                    "A quiet moment for your garden.",
                  )}
        </p>
      </header>

      <div className="dashboard-modules">
        {dashboardOrder.filter(enabled).map((id) => (
          <Fragment key={id}>{moduleCards[id]}</Fragment>
        ))}
      </div>
      {todayWidgets.length === 0 && (
        <div className="dashboard-project-empty">
          <span className="dashboard-empty-art">
            <LayoutGrid size={28} strokeWidth={1.5} />
          </span>
          <h3>{copy("Hoy, a tu manera.", "Today, your way.")}</h3>
          <p>
            {copy(
              "Has ocultado todos los módulos. Tus notas y proyectos siguen disponibles en el menú.",
              "You have hidden every module. Your notes and projects are still available in the menu.",
            )}
          </p>
        </div>
      )}
      <div className="dashboard-customize">
        <button
          type="button"
          className="dashboard-text-button"
          onClick={onCustomize}
        >
          <Settings size={15} />
          {copy("Organizar mi paseo", "Arrange my walk")}
        </button>
      </div>

      <AnimatePresence>
        {showDaySummary && (
          <motion.div
            className="mobile-modal-overlay fixed inset-0 z-[75] flex items-end justify-center bg-black/20 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:backdrop-blur-md sm:items-center sm:pb-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDaySummary}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 40 }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.24)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {appLanguage === "en" ? "Day summary" : "Resumen del día"}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--earth)]">
                    {appLanguage === "en"
                      ? "What moved today?"
                      : "¿Qué se movió hoy?"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeDaySummary}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--text-muted)]"
                  aria-label={
                    appLanguage === "en"
                      ? "Close day summary"
                      : "Cerrar resumen del día"
                  }
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--tone-harvest-bg)] px-4 py-3 text-[var(--tone-harvest)] ring-1 ring-[var(--tone-harvest-border)]">
                <Sparkles size={15} className="mt-0.5 shrink-0" />
                <p className="text-xs font-semibold leading-relaxed">
                  {activityHeadline}
                </p>
              </div>

              {dailyIntention.trim() && (
                <div className="mt-4 rounded-2xl bg-[var(--bg-app)] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {appLanguage === "en" ? "Intention" : "Intención"}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[var(--earth)]">
                    {dailyIntention}
                  </p>
                  {linkedIntentionNote && (
                    <p className="mt-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      {linkedIntentionNote.isGrowth &&
                      linkedIntentionNote.tasks.length > 0
                        ? appLanguage === "en"
                          ? `${linkedIntentionProgress}% of today’s goal complete`
                          : `${linkedIntentionProgress}% del objetivo de hoy completado`
                        : appLanguage === "en"
                          ? "Connected to your garden activity"
                          : "Conectado con la actividad de tu jardín"}
                    </p>
                  )}
                </div>
              )}

              {savedIntention && (
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-3">
                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                    {appLanguage === "en"
                      ? "How did your focus go?"
                      : "¿Cómo fue con tu foco?"}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { id: "yes", label: appLanguage === "en" ? "Yes" : "Sí" },
                      {
                        id: "some",
                        label: appLanguage === "en" ? "A little" : "Un poco",
                      },
                      {
                        id: "no",
                        label: appLanguage === "en" ? "Not today" : "No hoy",
                      },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={dayAlreadyClosed}
                        onClick={() => {
                          const outcome = option.id as Exclude<
                            DailyIntentionOutcome,
                            ""
                          >;
                          setIntentionOutcome(outcome);
                          setNextDayChoice(outcome === "yes" ? "" : "garden");
                        }}
                        className={`h-10 rounded-full px-2 text-xs font-semibold transition ${
                          intentionOutcome === option.id
                            ? "bg-[var(--sage)] text-[var(--on-sage)] shadow-sm"
                            : "bg-[var(--surface-strong)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {savedIntention &&
                (intentionOutcome === "some" || intentionOutcome === "no") && (
                  <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-3">
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                      {appLanguage === "en"
                        ? "What should happen next?"
                        : "¿Qué hacemos con este foco?"}
                    </p>
                    <div
                      className={`mt-2 grid gap-2 ${linkedIntentionNote ? "grid-cols-3" : "grid-cols-2"}`}
                    >
                      {[
                        {
                          id: "tomorrow",
                          icon: CalendarIcon,
                          label: appLanguage === "en" ? "Tomorrow" : "Mañana",
                        },
                        {
                          id: "garden",
                          icon: Leaf,
                          label: appLanguage === "en" ? "Garden" : "Jardín",
                        },
                        ...(linkedIntentionNote
                          ? [
                              {
                                id: "shed",
                                icon: Archive,
                                label:
                                  appLanguage === "en"
                                    ? "The shed"
                                    : "El cobertizo",
                              },
                            ]
                          : []),
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          disabled={dayAlreadyClosed}
                          onClick={() =>
                            setNextDayChoice(option.id as DailyNextStep)
                          }
                          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-semibold transition ${
                            nextDayChoice === option.id
                              ? "bg-[var(--sage)] text-[var(--on-sage)] shadow-sm"
                              : "bg-[var(--surface-strong)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                          }`}
                        >
                          <option.icon size={14} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] font-medium leading-relaxed text-[var(--text-muted)]">
                      {appLanguage === "en"
                        ? "No streaks are lost. This only helps Seeds prepare tomorrow."
                        : "No pierdes ninguna racha. Esto solo ayuda a Seeds a preparar mañana."}
                    </p>
                  </div>
                )}

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[
                  {
                    label: appLanguage === "en" ? "Planted" : "Plantadas",
                    value: plantedToday,
                    icon: Leaf,
                  },
                  {
                    label: appLanguage === "en" ? "Watered" : "Riegos",
                    value: wateredTodayCount,
                    icon: Droplets,
                  },
                  {
                    label: appLanguage === "en" ? "Moved" : "Avances",
                    value: stepsToday,
                    icon: Target,
                  },
                  {
                    label: appLanguage === "en" ? "Harvests" : "Cosechas",
                    value: completedToday,
                    icon: Archive,
                  },
                  {
                    label: appLanguage === "en" ? "Focus min" : "Min foco",
                    value: focusMinutesToday,
                    icon: Clock,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-[var(--bg-app)] p-3 text-center"
                  >
                    <item.icon
                      size={16}
                      className="mx-auto text-[var(--sage)]"
                    />
                    <p className="mt-1 text-xl font-semibold leading-none text-[var(--earth)]">
                      {item.value}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-[var(--text-muted)]">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  {dailyIntention.trim()
                    ? appLanguage === "en"
                      ? "What moved today, and what will you pick up tomorrow?"
                      : "¿Qué avanzó hoy y qué quieres retomar mañana?"
                    : appLanguage === "en"
                      ? "What do you want to take from today?"
                      : "¿Qué te llevas de hoy?"}
                </span>
                <textarea
                  value={dayReflection}
                  onChange={(event) => setDayReflection(event.target.value)}
                  readOnly={dayAlreadyClosed}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3 text-sm font-medium leading-relaxed text-[var(--earth)] outline-none focus:border-[var(--border)]"
                  placeholder={
                    appLanguage === "en"
                      ? "Today I… Tomorrow I would like to… (optional)"
                      : "Hoy… Mañana me gustaría… (opcional)"
                  }
                />
              </label>

              {dayAlreadyClosed ? (
                <button
                  type="button"
                  onClick={closeDaySummary}
                  className="mt-4 h-11 w-full rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] shadow-sm"
                >
                  {appLanguage === "en" ? "Done" : "Listo"}
                </button>
              ) : (
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    disabled={Boolean(
                      savedIntention &&
                      (!intentionOutcome ||
                        ((intentionOutcome === "some" ||
                          intentionOutcome === "no") &&
                          !nextDayChoice)),
                    )}
                    onClick={() => {
                      onCloseDay(
                        dayReflection,
                        dailyIntention,
                        intentionOutcome,
                        nextDayChoice,
                      );
                      setDayReflection("");
                      closeDaySummary();
                    }}
                    className="h-11 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {appLanguage === "en" ? "Let it rest" : "Dejar descansar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDayReflection("");
                      closeDaySummary();
                    }}
                    className="h-11 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                  >
                    {appLanguage === "en" ? "Not now" : "Ahora no"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
