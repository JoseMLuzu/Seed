/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  lazy,
  Suspense,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { appLanguage, t, type AppLanguage } from "./app/i18n";
import { MobileAppHeader } from "./app/components/MobileAppHeader";
import { navigationLabel } from "./app/navigationLabels";
import {
  dateInputToEndOfDay,
  formatShortDate,
  timestampToDateInput,
} from "./app/dates";
import {
  IDEA_CARD_SURFACE,
  IDEA_CARD_WRAPPER,
  IDEA_ICON_TILE,
} from "./features/notes/noteCardStyles";
import { STAGE_META } from "./features/notes/stageMeta";
import { noteUpdatedAt } from "./features/notes/noteMetadata";
import { ProgressiveListMoreButton } from "./components/ui/ProgressiveListMoreButton";
import { GestureNoteSurface } from "./components/notes/GestureNoteSurface";
import { InboxView } from "./features/notes/InboxView";
import { HarvestView } from "./features/harvest/HarvestView";
import { ShedView } from "./features/shed/ShedView";
import { ProjectsView } from "./features/projects/ProjectsView";
import { CalendarView } from "./features/calendar/CalendarView";
import { TodayView } from "./features/dashboard/TodayView";
import { FocusView } from "./features/focus/FocusView";
import type { AppView, CreateMode } from "./app/types";
import {
  formatReviewAge,
  getIdeaGuidance,
  priorityDetail,
  priorityLabel,
  priorityWeight,
} from "./features/notes/notePresentation";
import type { AccountProfile } from "./features/account/types";
import type { SupabaseRealtimePayload } from "./features/sync/types";
import type { DraftTodo } from "./features/notes/composerTypes";
import type { SettingsPage } from "./features/settings/types";
import {
  DEFAULT_PLANET_ID,
  DEFAULT_PLANETS,
  LEGACY_DEFAULT_PLANET_IDS,
  THEMES,
  THEME_IDS,
} from "./features/garden/gardenConfig";
import { normalizePlanets } from "./features/garden/normalizePlanets";
import {
  shouldAcceptSyncedEntity,
  touchNote,
  touchPlanet,
} from "./features/sync/entityRevision";
import { PRIORITY_OPTIONS, SEED_TYPES } from "./features/notes/noteConfig";
import { ONBOARDING_STEPS } from "./features/onboarding/onboardingConfig";
import { PROFILE_PURPOSE_OPTIONS } from "./features/account/profileConfig";
import {
  THEME_SELECT_OPTIONS,
  WATERING_INTERVAL_OPTIONS,
} from "./features/settings/settingsOptions";
import {
  getAccountInitials,
  resizeProfilePhoto,
} from "./features/account/profileHelpers";
import { formatAuthError } from "./features/account/authMessages";
import { useIsMobileViewport } from "./hooks/useIsMobileViewport";
import { useProgressiveList } from "./hooks/useProgressiveList";
import { AppSwitch } from "./components/ui/AppSwitch";
import { AppSelect } from "./components/ui/AppSelect";
import { EmptyStatePanel } from "./components/ui/EmptyStatePanel";
import { AccountAvatar } from "./features/account/components/AccountAvatar";
import { PlantIllustration } from "./components/garden/PlantIllustration";
import { createPortal } from "react-dom";
import { composerContent } from "./noteComposer";
import { DashboardModuleSettings } from "./DashboardModuleSettings";
import { NoteCareStatus } from "./NoteCareStatus";
import type { JournalDraft } from "./GardenerJournal";
import { GardenBoard } from "./GardenBoard";
import { GardenerGlossary } from "./GardenerGlossary";
import "./styles/gardenerGlossary.css";
import {
  gardenName,
  gardenStageName,
  gardenTypeName,
} from "./gardenVocabulary";
import { DailyFocusSession } from "./DailyFocusSession";
import {
  logDailyFocusSession,
  saveDailyFocusEntry,
  toggleDailyFocusCompletion,
} from "./dailyFocus";
import {
  gardenBoardKey,
  readGardenBoard,
  type GardenBoardData,
} from "./boardLogic";
import { saveJournalEntry } from "./journalLogic";
import { readReviewSnoozes } from "./dashboardInsights";
import {
  DASHBOARD_MODULES,
  DASHBOARD_MODULES_KEY,
  DASHBOARD_ORDER_KEY,
  DEFAULT_DASHBOARD_MODULES,
  readDashboardModules,
  readDashboardOrder,
  type DashboardModuleId as TodayWidgetId,
} from "./dashboardModules";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import {
  clearSeedNotifications,
  requestSeedNotificationPermission,
  scheduleSeedReminders,
} from "./native/notifications";
import { updateSeedWidget } from "./native/widget";
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
  Lightbulb,
  BookOpen,
  Sun,
  Pencil,
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
  type LucideIcon,
} from "lucide-react";
import {
  Theme,
  SeedNote,
  Planet,
  type DailyIntentionOutcome,
  type DailyNextStep,
  type SyncSnapshot,
} from "./types";
import {
  addFocusMinutes,
  createDailyClosureNote,
  createDailyEntryNote,
  dailyEntryId,
  DAY_MS,
  daysSince,
  getDailyEntryForDate,
  isDailyClosureForDate,
  isDailyEntryNote,
  isSameLocalDay,
  toggleTaskForNote,
  updateDailyEntryFocus,
  wateringDue,
  waterNote as waterSeedNote,
} from "./seedLogic";
import {
  deleteNotesFromDb,
  loadLegacyNotes,
  loadNotesFromDb,
  saveNotesToDb,
} from "./storage";
import { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";
import {
  deleteOwnAccountFromSupabase,
  flushSyncQueue,
  syncGardenIncrementally,
} from "./supabaseSync";
import {
  applySyncTombstones,
  diffSyncSnapshots,
  enqueueSyncMutations,
  loadSyncQueue,
  mergeSyncSnapshots,
} from "./syncQueue";
import { normalizeNote, normalizeNotes } from "./normalize";
import {
  playSeedSound,
  preloadSeedSounds,
  unlockSeedAudio,
  type SeedSoundKind,
} from "./sound";
import {
  clearAccountStorage,
  createAccountStorage,
  getStoredItem as getDeviceItem,
  removeStoredItem as removeDeviceItem,
} from "./appStorage";
import { AccountLease } from "./accountScope";
import AccountBoundary, {
  type AccountAuthFlow,
} from "./components/AccountBoundary";
import {
  assertLegacyRecoveryOwner,
  reserveLegacyRecovery,
  mergeLegacyGarden,
} from "./legacyRecovery";
import {
  migrateFocusNotesIntoSeeds,
  normalizeFocusNoteMap,
} from "./focusNotes";
import LandingPage, { type AuthRoute } from "./components/LandingPage";
import { passwordPolicyError } from "./authValidation";
import { getAuthRedirectUrl, isAuthCallbackUrl } from "./authFlow";
import { ProjectTodoDraftRow } from "./features/projects/ProjectTodoDraftRow";

const Garden3D = lazy(() => import("./components/Garden3D"));

export default function App() {
  return (
    <AccountBoundary>
      {(session, lease, authFlow) => (
        <AccountWorkspace
          key={lease.id}
          session={session}
          lease={lease}
          authFlow={authFlow}
        />
      )}
    </AccountBoundary>
  );
}

function AccountWorkspace({
  session,
  lease,
  authFlow,
}: {
  session: Session | null;
  lease: AccountLease;
  authFlow: AccountAuthFlow;
}) {
  const {
    getStoredItem,
    setStoredItem,
    removeStoredItem,
    getStoredBoolean,
    getStoredNumber,
  } = useMemo(() => createAccountStorage(lease.scope), [lease]);
  const [notes, setNotes] = useState<SeedNote[]>([]);
  const [, setBoardRevision] = useState(0);
  const gardenNotes = useMemo(
    () => notes.filter((note) => !isDailyEntryNote(note)),
    [notes],
  );
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [recoveringLegacy, setRecoveringLegacy] = useState(false);
  const latestNotes = useRef({ notes, notesLoaded });
  useLayoutEffect(() => {
    latestNotes.current = { notes, notesLoaded };
  }, [notes, notesLoaded]);
  useLayoutEffect(
    () => () => {
      if (latestNotes.current.notesLoaded) {
        void saveNotesToDb(lease.scope, latestNotes.current.notes).catch(
          (error) =>
            console.warn(
              "No se pudo guardar el jardín al cambiar de cuenta.",
              error,
            ),
        );
      }
    },
    [lease],
  );
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const legacyDailyFocusRef = useRef({
    intention: getStoredItem(`seed-daily-intention-${todayKey}`) || "",
    linkedNoteId: getStoredItem(`seed-daily-intention-note-${todayKey}`) || "",
  });
  const [dailyIntention, setDailyIntention] = useState(
    legacyDailyFocusRef.current.intention,
  );
  const [dailyIntentionNoteId, setDailyIntentionNoteId] = useState(
    legacyDailyFocusRef.current.linkedNoteId,
  );
  const [showLanding, setShowLanding] = useState(
    () =>
      authFlow.passwordRecovery ||
      (!session && getStoredItem("seed-welcome-v2-seen") !== "true"),
  );
  const [landingRoute, setLandingRoute] = useState<AuthRoute>(() =>
    authFlow.passwordRecovery ? "reset" : "landing",
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const [planets, setPlanets] = useState<Planet[]>(() => {
    try {
      const parsed = JSON.parse(getStoredItem("seed-planets") || "[]");
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : DEFAULT_PLANETS;
    } catch {
      return DEFAULT_PLANETS;
    }
  });
  const [activePlanetId, setActivePlanetId] = useState(
    () => getStoredItem("seed-active-planet") || DEFAULT_PLANET_ID,
  );
  const [isAddingPlanet, setIsAddingPlanet] = useState(false);
  const [newPlanetName, setNewPlanetName] = useState("");
  const [showPlanetSettings, setShowPlanetSettings] = useState(false);
  const [editingPlanetName, setEditingPlanetName] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(0);

  const [theme, setTheme] = useState<Theme>(() => {
    return (getStoredItem("seed-theme") as Theme) || "earth";
  });

  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<
    SeedNote["growthStage"] | "all"
  >("all");
  const [view, setView] = useState<AppView>("today");
  const [showGardenFullscreen, setShowGardenFullscreen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("seed");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [quickActionsNoteId, setQuickActionsNoteId] = useState<string | null>(
    null,
  );
  const [recentlyCreatedNoteId, setRecentlyCreatedNoteId] = useState<
    string | null
  >(null);
  const [newNote, setNewNote] = useState<{
    title: string;
    content: string;
    dueDate: string;
    seedType: NonNullable<SeedNote["seedType"]>;
    priority: NonNullable<SeedNote["priority"]>;
    planetId: string;
  }>({
    title: "",
    content: "",
    dueDate: "",
    seedType: "idea",
    priority: "normal",
    planetId: DEFAULT_PLANET_ID,
  });
  const [showQuickEntryDetails, setShowQuickEntryDetails] = useState(false);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const [showProjectTodos, setShowProjectTodos] = useState(false);
  const [projectTodos, setProjectTodos] = useState<DraftTodo[]>([]);
  const projectTodoSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );
  const [quickNote, setQuickNote] = useState("");
  const quickCaptureUndoRef = useRef<{ id: string; updatedAt?: number } | null>(
    null,
  );
  const [isLinking, setIsLinking] = useState(false);
  const [wateringNoteId, setWateringNoteId] = useState<string | null>(null);
  const [wateringNote, setWateringNote] = useState("");
  const [sproutPromptNoteId, setSproutPromptNoteId] = useState<string | null>(
    null,
  );
  const [sproutPromptTodos, setSproutPromptTodos] = useState<DraftTodo[]>([]);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [dailyFocusEntryId, setDailyFocusEntryId] = useState<string | null>(
    null,
  );
  const [celebration, setCelebration] = useState<string | null>(null);
  const [flowerReward, setFlowerReward] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => getStoredItem("seed-onboarded") !== "true",
  );
  const [hapticsEnabled, setHapticsEnabled] = useState(() =>
    getStoredBoolean("seed-haptics", true),
  );
  const [soundsEnabled, setSoundsEnabled] = useState(() =>
    getStoredBoolean("seed-sounds", false),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("root");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showGardenSwitcher, setShowGardenSwitcher] = useState(false);
  const [quickEntryViewport, setQuickEntryViewport] = useState<{
    height: number | null;
    offsetTop: number;
    keyboardInset: number;
    keyboardOpen: boolean;
  }>({
    height: null,
    keyboardInset: 0,
    offsetTop: 0,
    keyboardOpen: false,
  });
  const [authEmail, setAuthEmail] = useState(session?.user.email || "");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [accountAction, setAccountAction] = useState<
    "signout" | "delete" | null
  >(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => {
    if (!session?.user) return 0;
    try {
      return loadSyncQueue(lease.scope).length;
    } catch {
      return 0;
    }
  });
  const [syncRetryAt, setSyncRetryAt] = useState(0);
  const [syncQueueRevision, setSyncQueueRevision] = useState(0);
  const remoteSyncReadyRef = useRef(false);
  const syncSnapshotRef = useRef<SyncSnapshot | null>(null);
  const autoSyncTimerRef = useRef<number | null>(null);
  const mobileGardenFullscreenOpenedRef = useRef(false);
  const mobileMenuRef = useRef<HTMLElement | null>(null);
  const quickEntryOverlayRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuGestureRef = useRef({
    tracking: false,
    startX: 0,
    startY: 0,
    opened: false,
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => getStoredItem("seed-notifications") === "true",
  );
  const [defaultWateringInterval, setDefaultWateringInterval] = useState(() =>
    getStoredNumber("seed-default-watering", 1, 1, 30),
  );
  const [reminderHour, setReminderHour] = useState(() =>
    getStoredNumber("seed-reminder-hour", 9, 0, 23),
  );
  const [todayWidgets, setTodayWidgets] = useState<TodayWidgetId[]>(() =>
    readDashboardModules(
      getStoredItem(DASHBOARD_MODULES_KEY),
      getStoredItem("seed-today-widgets"),
      getStoredItem("seed-dashboard-modules-v3") ??
        getStoredItem("seed-dashboard-modules-v2"),
      "board",
    ),
  );
  const [dashboardOrder, setDashboardOrder] = useState<TodayWidgetId[]>(() =>
    readDashboardOrder(getStoredItem(DASHBOARD_ORDER_KEY)),
  );
  const [featuredProjectId, setFeaturedProjectId] = useState(
    () => getStoredItem("seed-dashboard-project") || "",
  );
  const [reviewSnoozes, setReviewSnoozes] = useState(() =>
    readReviewSnoozes(getStoredItem("seed-dashboard-review-snoozes")),
  );
  const [account, setAccount] = useState<AccountProfile>(() => {
    const fallback = {
      name:
        typeof session?.user.user_metadata?.name === "string"
          ? session.user.user_metadata.name
          : session
            ? "Mi cuenta"
            : "Modo invitado",
      email: session?.user.email || "",
      role: "Cuidador de ideas",
    };
    try {
      const saved = JSON.parse(getStoredItem("seed-account") || "null");
      return saved && typeof saved.name === "string"
        ? {
            ...fallback,
            ...saved,
            email: session?.user.email || saved.email || "",
          }
        : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    if (authFlow.passwordRecovery) {
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthStatus(
        authFlow.callbackError
          ? "El enlace ya no es válido o expiró. Solicita uno nuevo."
          : "Enlace verificado. Elige una nueva contraseña.",
      );
      setLandingRoute("reset");
      setShowLanding(true);
      return;
    }
    if (authFlow.callbackError) {
      setAuthStatus(
        "No pudimos confirmar ese enlace. Solicita uno nuevo o inicia sesión.",
      );
      setLandingRoute("login");
      setShowLanding(true);
    }
  }, [authFlow.passwordRecovery, authFlow.callbackError]);
  const [harvestNoteId, setHarvestNoteId] = useState<string | null>(null);
  const [recentlyWateredId, setRecentlyWateredId] = useState<string | null>(
    null,
  );
  const [wateringRitual, setWateringRitual] = useState<{
    lastDate: string;
    streak: number;
  }>(() => {
    try {
      return JSON.parse(
        getStoredItem("seed-watering-ritual") || '{"lastDate":"","streak":0}',
      );
    } catch {
      return { lastDate: "", streak: 0 };
    }
  });
  const wateredToday = wateringRitual.lastDate === todayKey;
  const accountInitials = getAccountInitials(account.name, account.email);
  const handleProfilePhotoChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const photo = await resizeProfilePhoto(file);
      setAccount((current) => ({ ...current, photo }));
      setSyncStatus("Foto de perfil actualizada.");
    } catch {
      setSyncStatus(
        "No se pudo usar esa imagen. Prueba con una foto JPG o PNG.",
      );
    }
  };
  const profileStats = useMemo(() => {
    const stats = gardenNotes.reduce(
      (total, note) => {
        total.totalFocus += note.focusedMinutes || 0;
        if (note.inbox) total.seeds += 1;
        if (!note.inbox && note.growthStage === "bloom") total.harvests += 1;
        if (
          !note.inbox &&
          note.isGrowth &&
          note.growthStage !== "bloom" &&
          !note.paused
        )
          total.active += 1;
        if (
          !note.inbox &&
          !note.paused &&
          note.growthStage !== "bloom" &&
          wateringDue(note)
        )
          total.needsWater += 1;
        return total;
      },
      { totalFocus: 0, seeds: 0, harvests: 0, active: 0, needsWater: 0 },
    );
    stats.totalFocus += notes
      .filter(isDailyEntryNote)
      .reduce((sum, note) => sum + (note.focusedMinutes || 0), 0);
    const { totalFocus, seeds, harvests, active, needsWater } = stats;
    const season =
      harvests >= 5
        ? "Temporada de cosecha"
        : active >= 4
          ? "Temporada de crecimiento"
          : needsWater > 0
            ? "Temporada de riego"
            : "Temporada de siembra";
    return { totalFocus, seeds, harvests, active, needsWater, season };
  }, [gardenNotes, notes]);
  const profileAchievements = useMemo(
    () => [
      { label: "Primera semilla", active: gardenNotes.length > 0 },
      { label: "Primera cosecha", active: profileStats.harvests > 0 },
      { label: "Racha de 3 días", active: wateringRitual.streak >= 3 },
      { label: "60 min de enfoque", active: profileStats.totalFocus >= 60 },
    ],
    [
      gardenNotes.length,
      profileStats.harvests,
      profileStats.totalFocus,
      wateringRitual.streak,
    ],
  );
  useEffect(() => {
    if (!notesLoaded) return;
    const activeNotes = gardenNotes.filter(
      (note) =>
        note.growthStage !== "bloom" &&
        note.growthStage !== "withered" &&
        !note.paused,
    );
    const thirstyNotes = activeNotes
      .filter((note) => wateringDue(note))
      .sort((a, b) => {
        const aAge = daysSince(a.lastWateredAt || a.createdAt);
        const bAge = daysSince(b.lastWateredAt || b.createdAt);
        return (
          priorityWeight(b) +
          bAge +
          (b.inbox ? 2 : 0) -
          (priorityWeight(a) + aAge + (a.inbox ? 2 : 0))
        );
      });
    const nextStepNote = gardenNotes
      .filter(
        (note) =>
          !note.inbox &&
          note.isGrowth &&
          !note.paused &&
          note.growthStage !== "bloom" &&
          !wateringDue(note),
      )
      .map((note) => ({
        note,
        task: note.tasks.find((task) => !task.completed),
      }))
      .filter(
        (
          item,
        ): item is { note: SeedNote; task: NonNullable<typeof item.task> } =>
          Boolean(item.task),
      )
      .sort((a, b) => priorityWeight(b.note) - priorityWeight(a.note))[0];
    const firstSeed = gardenNotes
      .filter((note) => note.inbox)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const widgetTitle =
      thirstyNotes[0]?.title ||
      nextStepNote?.note.title ||
      firstSeed?.title ||
      "Planta una semilla";
    const widgetSubtitle = thirstyNotes[0]
      ? thirstyNotes[0].inbox
        ? "Decide si sigue viva"
        : formatReviewAge(thirstyNotes[0])
      : nextStepNote
        ? nextStepNote.task.text
        : firstSeed
          ? "Una idea espera decisión"
          : dailyIntention.trim() || "Una cosa clara para hoy";
    const widgetAction = thirstyNotes[0]
      ? "Regar"
      : nextStepNote
        ? "Cultivar"
        : firstSeed
          ? "Decidir"
          : "Plantar";
    void updateSeedWidget({
      title: widgetTitle,
      subtitle: widgetSubtitle,
      action: widgetAction,
      metric:
        thirstyNotes.length > 0
          ? String(thirstyNotes.length)
          : profileStats.active > 0
            ? String(profileStats.active)
            : String(profileStats.seeds),
      seeds: profileStats.seeds,
      sprouts: profileStats.active,
      harvests: profileStats.harvests,
      watering: thirstyNotes.length,
      streak: wateringRitual.streak,
      updatedAt: Date.now(),
    });
  }, [
    dailyIntention,
    gardenNotes,
    notesLoaded,
    profileStats.active,
    profileStats.harvests,
    profileStats.seeds,
    wateringRitual.streak,
  ]);
  const authDisabledReason = !isSupabaseConfigured
    ? "El acceso con cuenta aún no está disponible en esta versión. Puedes explorar tu jardín sin cuenta."
    : !authEmail.trim()
      ? "Escribe tu correo para continuar."
      : authPassword.length < 6
        ? "La contraseña debe tener al menos 6 caracteres."
        : "";

  // Persistence
  useEffect(() => {
    let cancelled = false;
    loadNotesFromDb(lease.scope)
      .then((loadedNotes) => {
        if (!cancelled && lease.isActive()) {
          let rawLegacyFocusNotes: unknown = {};
          try {
            rawLegacyFocusNotes = JSON.parse(
              getStoredItem("seed-focus-notes") || "{}",
            );
          } catch {
            rawLegacyFocusNotes = {};
          }
          const legacyFocusNotes = normalizeFocusNoteMap(rawLegacyFocusNotes);
          const migratedNotes = migrateFocusNotesIntoSeeds(
            loadedNotes,
            legacyFocusNotes,
          );
          setNotes(migratedNotes);
          setNotesLoaded(true);
          if (migratedNotes !== loadedNotes)
            removeStoredItem("seed-focus-notes");
        }
      })
      .catch(() => {
        if (!cancelled && lease.isActive())
          setStorageError(
            "No se pudo abrir el jardín de esta cuenta. Tus datos no se han reemplazado.",
          );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notesLoaded) return;
    let cancelled = false;
    let flushed = false;
    const browserWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const persist = () => {
      if (cancelled || flushed) return;
      flushed = true;
      void saveNotesToDb(lease.scope, notes).catch(() => {
        if (lease.isActive())
          setStorageError(
            "No se pudo guardar el jardín. Libera espacio y vuelve a intentarlo.",
          );
      });
    };
    const idleId = browserWindow.requestIdleCallback
      ? browserWindow.requestIdleCallback(persist, { timeout: 900 })
      : window.setTimeout(persist, 240);
    const flushIfHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };

    document.addEventListener("visibilitychange", flushIfHidden);
    window.addEventListener("pagehide", persist);

    return () => {
      cancelled = true;
      if (
        browserWindow.cancelIdleCallback &&
        browserWindow.requestIdleCallback
      ) {
        browserWindow.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      document.removeEventListener("visibilitychange", flushIfHidden);
      window.removeEventListener("pagehide", persist);
    };
  }, [notes, notesLoaded]);

  const blurQuickEntryFocus = () => {
    if (typeof document === "undefined") return;
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      quickEntryOverlayRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
  };

  useEffect(() => {
    if (!isAdding) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const keyboardInset = Math.max(
        0,
        window.innerHeight - height - offsetTop,
      );
      setQuickEntryViewport({
        height,
        offsetTop,
        keyboardInset,
        keyboardOpen: keyboardInset > 120,
      });
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [isAdding]);

  useEffect(() => {
    if (!import.meta.env.DEV || !notesLoaded || session?.user) return;

    const demoNote: SeedNote = {
      id: "demo-watering-note",
      planetId: activePlanetId,
      title: "Idea de prueba por regar",
      content:
        "Esta semilla esta atrasada a proposito para probar como se ve el filtro Por regar.",
      createdAt: Date.now() - 5 * DAY_MS,
      tags: [],
      isGrowth: true,
      tasks: [
        {
          id: "demo-watering-task",
          text: "Revisar si esta idea sigue viva",
          completed: false,
        },
      ],
      growthStage: "sprout",
      lastWateredAt: Date.now() - 4 * DAY_MS,
      wateringIntervalDays: 1,
      inbox: false,
      seedType: "idea",
    };

    setNotes((current) => {
      const existing = current.find((note) => note.id === demoNote.id);
      if (!existing) return [demoNote, ...current];
      if (
        (existing.planetId || DEFAULT_PLANET_ID) === activePlanetId &&
        wateringDue(existing)
      )
        return current;
      return current.map((note) => (note.id === demoNote.id ? demoNote : note));
    });
  }, [activePlanetId, notesLoaded]);

  useEffect(() => {
    if (!showMobileMenu) return;

    const frame = window.requestAnimationFrame(() => {
      mobileMenuRef.current?.scrollTo({ top: 0, behavior: "instant" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showMobileMenu]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const edgeWidth = 26;
    const openDistance = 58;
    const gesturesDisabled =
      showMobileMenu ||
      isAdding ||
      showSettings ||
      showOnboarding ||
      showGardenFullscreen ||
      view === "focus" ||
      view === "board" ||
      view === "calendar";

    const resetGesture = () => {
      mobileMenuGestureRef.current = {
        tracking: false,
        startX: 0,
        startY: 0,
        opened: false,
      };
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

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", resetGesture, { passive: true });
    window.addEventListener("touchcancel", resetGesture, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", resetGesture);
      window.removeEventListener("touchcancel", resetGesture);
    };
  }, [
    isAdding,
    showGardenFullscreen,
    showMobileMenu,
    showOnboarding,
    showSettings,
    view,
  ]);

  useEffect(() => {
    if (!showMobileMenu || typeof window === "undefined") return;

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

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", reset, { passive: true });
    window.addEventListener("touchcancel", reset, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", reset);
      window.removeEventListener("touchcancel", reset);
    };
  }, [showMobileMenu]);

  useEffect(() => {
    if (
      showCreateMenu &&
      (isAdding ||
        showMobileMenu ||
        showSettings ||
        showGardenFullscreen ||
        view === "focus" ||
        view === "calendar" ||
        view === "board")
    ) {
      setShowCreateMenu(false);
    }
  }, [
    isAdding,
    showCreateMenu,
    showGardenFullscreen,
    showMobileMenu,
    showSettings,
    view,
  ]);

  useEffect(() => {
    setStoredItem("seed-planets", JSON.stringify(planets));
  }, [planets]);

  useEffect(() => {
    if (!notesLoaded) return;
    const usedPlanetIds = new Set(
      notes.map((note) => note.planetId || DEFAULT_PLANET_ID),
    );
    setPlanets((current) => {
      const cleaned = current.filter((planet) => {
        const isLegacyDefault =
          LEGACY_DEFAULT_PLANET_IDS.has(planet.id) && planet.createdAt === 0;
        return !isLegacyDefault || usedPlanetIds.has(planet.id);
      });
      if (cleaned.length === current.length) return current;
      return cleaned.length > 0 ? cleaned : DEFAULT_PLANETS;
    });
  }, [notes, notesLoaded]);

  useEffect(() => {
    if (!planets.some((planet) => planet.id === activePlanetId)) {
      setActivePlanetId(planets[0]?.id || DEFAULT_PLANET_ID);
    }
  }, [activePlanetId, planets]);

  useEffect(() => {
    setStoredItem("seed-active-planet", activePlanetId);
  }, [activePlanetId]);

  useEffect(() => {
    if (view !== "3D") {
      mobileGardenFullscreenOpenedRef.current = false;
      setShowGardenFullscreen(false);
      return;
    }

    if (
      mobileGardenFullscreenOpenedRef.current ||
      typeof window === "undefined"
    )
      return;
    const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobileViewport) return;

    mobileGardenFullscreenOpenedRef.current = true;
    const timer = window.setTimeout(() => setShowGardenFullscreen(true), 180);
    return () => window.clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    setStoredItem("seed-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    setStoredItem("seed-default-watering", String(defaultWateringInterval));
  }, [defaultWateringInterval]);

  useEffect(() => {
    setStoredItem(
      "seed-notifications",
      notificationsEnabled ? "true" : "false",
    );
  }, [notificationsEnabled]);

  useEffect(() => {
    setStoredItem("seed-reminder-hour", String(reminderHour));
  }, [reminderHour]);

  useEffect(() => {
    setStoredItem(DASHBOARD_MODULES_KEY, JSON.stringify(todayWidgets));
  }, [todayWidgets]);
  useEffect(() => {
    setStoredItem(DASHBOARD_ORDER_KEY, JSON.stringify(dashboardOrder));
  }, [dashboardOrder]);
  useEffect(() => {
    setStoredItem("seed-dashboard-project", featuredProjectId);
  }, [featuredProjectId]);
  useEffect(() => {
    setStoredItem(
      "seed-dashboard-review-snoozes",
      JSON.stringify(reviewSnoozes),
    );
  }, [reviewSnoozes]);

  useEffect(() => {
    setStoredItem("seed-account", JSON.stringify(account));
  }, [account]);

  useEffect(() => {
    setStoredItem("seed-watering-ritual", JSON.stringify(wateringRitual));
  }, [wateringRitual]);

  useEffect(() => {
    setStoredItem("seed-haptics", hapticsEnabled ? "true" : "false");
  }, [hapticsEnabled]);

  useEffect(() => {
    setStoredItem("seed-sounds", soundsEnabled ? "true" : "false");
  }, [soundsEnabled]);

  useEffect(() => {
    preloadSeedSounds();
  }, []);

  const playMicroSound = (kind: SeedSoundKind, force = false) => {
    playSeedSound(kind, soundsEnabled, force);
  };

  const feel = (kind: "open" | SeedSoundKind, force = false) => {
    if (
      (force || hapticsEnabled) &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      const pattern =
        kind === "harvest"
          ? [10, 28, 14, 36, 18]
          : kind === "sprout"
            ? [10, 18, 12]
            : kind === "plant"
              ? [8, 20, 10]
              : kind === "water"
                ? [6, 14, 6]
                : kind === "step"
                  ? 8
                  : 6;
      navigator.vibrate(pattern);
    }
    if (kind !== "open") playMicroSound(kind, force);
  };

  const flushQueuedChanges = useCallback(
    async (force = false) => {
      if (!session?.user || !lease.isActive()) return;
      setIsSyncing(true);
      try {
        const result = await flushSyncQueue(
          lease.scope,
          lease.syncAccess(),
          undefined,
          { force },
        );
        if (!lease.isActive()) return;
        const currentQueue = loadSyncQueue(lease.scope);
        setPendingSyncCount(currentQueue.length);
        setSyncRetryAt(currentQueue[0]?.nextAttemptAt || result.nextRetryAt);
        if (currentQueue.length === 0) {
          setSyncStatus(
            result.conflicts > 0
              ? `${result.conflicts} ${result.conflicts === 1 ? "conflicto fue protegido" : "conflictos fueron protegidos"} en el historial de sincronización.`
              : result.processed > 0
                ? "Todos los cambios están guardados en la nube."
                : "Sin cambios pendientes.",
          );
        } else {
          setSyncStatus(
            `Guardado localmente · ${currentQueue.length} ${currentQueue.length === 1 ? "cambio pendiente" : "cambios pendientes"}. Reintentaremos automáticamente.`,
          );
        }
      } catch (error) {
        if (lease.isActive())
          setSyncStatus(
            error instanceof Error
              ? error.message
              : "No se pudieron enviar los cambios pendientes.",
          );
      } finally {
        if (lease.isActive()) setIsSyncing(false);
      }
    },
    [lease, session?.user?.id],
  );

  useEffect(() => {
    if (!session?.user || !notesLoaded || !lease.isActive()) {
      remoteSyncReadyRef.current = false;
      syncSnapshotRef.current = notesLoaded ? { planets, notes } : null;
      return;
    }

    let cancelled = false;
    remoteSyncReadyRef.current = true;
    syncSnapshotRef.current = { planets, notes };
    setIsSyncing(true);
    setSyncStatus("Preparando sync entre dispositivos...");

    syncGardenIncrementally(
      lease.scope,
      { ownerId: lease.scope.userId!, planets, notes },
      lease.syncAccess(),
    )
      .then((synced) => {
        if (cancelled || !lease.isActive()) return;
        const reconciled = applySyncTombstones(
          mergeSyncSnapshots(
            syncSnapshotRef.current || { planets, notes },
            synced,
          ),
          synced.tombstones,
        );
        syncSnapshotRef.current = reconciled;
        if (reconciled.planets.length > 0) setPlanets(reconciled.planets);
        setNotes(reconciled.notes);
        const currentQueue = loadSyncQueue(lease.scope);
        setPendingSyncCount(currentQueue.length);
        setSyncRetryAt(currentQueue[0]?.nextAttemptAt || 0);
        setSyncStatus(
          synced.conflicts > 0
            ? `${synced.conflicts} ${synced.conflicts === 1 ? "conflicto fue protegido" : "conflictos fueron protegidos"} durante la sincronización.`
            : currentQueue.length > 0
              ? `Sync activo · ${currentQueue.length} ${currentQueue.length === 1 ? "cambio pendiente" : "cambios pendientes"}.`
              : `Sync activo: ${reconciled.notes.filter((note) => !isDailyEntryNote(note)).length} ideas en la nube.`,
        );
      })
      .catch((error) => {
        if (!cancelled) {
          try {
            setPendingSyncCount(loadSyncQueue(lease.scope).length);
          } catch {
            /* The original error is more useful. */
          }
          setSyncStatus(
            error instanceof Error
              ? error.message
              : "No se pudo preparar el sync. Tus cambios siguen guardados localmente.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsSyncing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, notesLoaded]);

  useEffect(() => {
    if (!supabase || !session?.user || !lease.isActive()) return;
    const userId = session.user.id;

    const handleNotePayload = (payload: SupabaseRealtimePayload) => {
      if (!lease.isActive()) return;
      const owner =
        payload.eventType === "DELETE"
          ? payload.old?.user_id
          : payload.new?.user_id;
      if (owner !== lease.scope.userId) return;
      if (payload.eventType === "DELETE") {
        const deletedId =
          typeof payload.old?.id === "string" ? payload.old.id : undefined;
        if (deletedId)
          setNotes((current) => {
            const next = current.filter((note) => note.id !== deletedId);
            if (syncSnapshotRef.current)
              syncSnapshotRef.current = {
                ...syncSnapshotRef.current,
                notes: next,
              };
            return next;
          });
        return;
      }

      const row = payload.new;
      const rowData =
        row?.data && typeof row.data === "object"
          ? (row.data as Record<string, unknown>)
          : null;
      if (!rowData?.id) {
        return;
      }

      const incoming = normalizeNote({
        ...rowData,
        id: rowData.id || row?.id,
        planetId: rowData.planetId || row?.planet_id || DEFAULT_PLANET_ID,
        syncVersion:
          typeof row?.server_revision === "number"
            ? row.server_revision
            : rowData.syncVersion,
      });

      if (!incoming) {
        return;
      }

      setNotes((current) => {
        const existing = current.find((note) => note.id === incoming.id);
        if (existing && !shouldAcceptSyncedEntity(existing, incoming))
          return current;
        const next = existing
          ? current.map((note) => (note.id === incoming.id ? incoming : note))
          : [incoming, ...current];
        if (syncSnapshotRef.current)
          syncSnapshotRef.current = { ...syncSnapshotRef.current, notes: next };
        return next;
      });
    };

    const handlePlanetPayload = (payload: SupabaseRealtimePayload) => {
      if (!lease.isActive()) return;
      const owner =
        payload.eventType === "DELETE"
          ? payload.old?.user_id
          : payload.new?.user_id;
      if (owner !== lease.scope.userId) return;
      if (payload.eventType === "DELETE") {
        const deletedId =
          typeof payload.old?.id === "string" ? payload.old.id : undefined;
        if (deletedId)
          setPlanets((current) => {
            const next = current.filter((planet) => planet.id !== deletedId);
            if (syncSnapshotRef.current)
              syncSnapshotRef.current = {
                ...syncSnapshotRef.current,
                planets: next,
              };
            return next;
          });
        return;
      }

      const row = payload.new;
      if (typeof row?.id !== "string" || typeof row.name !== "string") {
        return;
      }

      const incoming: Planet = {
        id: row.id,
        name: row.name,
        description: typeof row.description === "string" ? row.description : "",
        theme: THEME_IDS.has(row.theme as Theme)
          ? (row.theme as Theme)
          : "earth",
        createdAt:
          typeof row.created_at_ms === "number"
            ? row.created_at_ms
            : Date.now(),
        updatedAt:
          typeof row.updated_at === "string"
            ? Date.parse(row.updated_at)
            : undefined,
      };

      setPlanets((current) => {
        const existing = current.find((planet) => planet.id === incoming.id);
        if (existing && !shouldAcceptSyncedEntity(existing, incoming))
          return current;
        const next = existing
          ? current.map((planet) =>
              planet.id === incoming.id ? { ...planet, ...incoming } : planet,
            )
          : [...current, incoming];
        if (syncSnapshotRef.current)
          syncSnapshotRef.current = {
            ...syncSnapshotRef.current,
            planets: next,
          };
        return next;
      });
    };

    const notesChannel = supabase
      .channel(`seed-notes-${userId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "seed_notes",
          filter: `user_id=eq.${userId}`,
        } as never,
        handleNotePayload,
      )
      .subscribe();

    const planetsChannel = supabase
      .channel(`seed-planets-${userId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "seed_planets",
          filter: `user_id=eq.${userId}`,
        } as never,
        handlePlanetPayload,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notesChannel);
      supabase.removeChannel(planetsChannel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!notesLoaded) return;
    const current: SyncSnapshot = { planets, notes };
    const previous = syncSnapshotRef.current;
    syncSnapshotRef.current = current;
    if (!session?.user || !remoteSyncReadyRef.current || !previous) return;

    const mutations = diffSyncSnapshots(previous, current);
    if (mutations.length === 0) return;
    try {
      const queue = enqueueSyncMutations(lease.scope, mutations);
      setPendingSyncCount(queue.length);
      setSyncRetryAt(0);
      setSyncQueueRevision((value) => value + 1);
      setSyncStatus(
        `Guardado localmente · ${queue.length} ${queue.length === 1 ? "cambio pendiente" : "cambios pendientes"}.`,
      );
    } catch (error) {
      setSyncStatus(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la sincronización local.",
      );
    }
  }, [planets, notes, notesLoaded, session?.user?.id]);

  useEffect(() => {
    if (!session?.user || !notesLoaded || pendingSyncCount === 0 || isSyncing)
      return;
    if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current);
    const delay = Math.max(900, syncRetryAt > 0 ? syncRetryAt - Date.now() : 0);
    autoSyncTimerRef.current = window.setTimeout(() => {
      void flushQueuedChanges(false);
    }, delay);
    const flushWhenOnline = () => {
      void flushQueuedChanges(true);
    };
    window.addEventListener("online", flushWhenOnline);

    return () => {
      if (autoSyncTimerRef.current)
        window.clearTimeout(autoSyncTimerRef.current);
      window.removeEventListener("online", flushWhenOnline);
    };
  }, [
    flushQueuedChanges,
    isSyncing,
    notesLoaded,
    pendingSyncCount,
    session?.user?.id,
    syncQueueRevision,
    syncRetryAt,
  ]);

  useEffect(() => {
    if (!notesLoaded) return;
    if (!notificationsEnabled) {
      clearSeedNotifications();
      return;
    }

    scheduleSeedReminders({
      notes: gardenNotes,
      reminderHour,
      language: appLanguage,
    }).catch((error) => {
      console.warn("Seed native reminders could not be scheduled.", error);
    });

    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    const dueNotes = gardenNotes.filter(
      (note) =>
        !note.inbox &&
        !note.paused &&
        note.growthStage !== "bloom" &&
        wateringDue(note),
    );
    if (dueNotes.length === 0) return;

    const todayKey = format(Date.now(), "yyyy-MM-dd");
    if (getStoredItem("seed-last-notification-day") === todayKey) return;

    const delay = Math.max(
      5000,
      new Date().getHours() >= reminderHour
        ? 5000
        : (reminderHour - new Date().getHours()) * 60 * 60 * 1000,
    );
    const timeout = window.setTimeout(() => {
      setStoredItem("seed-last-notification-day", todayKey);
      showSeedNotification(
        dueNotes.length === 1
          ? `"${dueNotes[0].title}" vale un riego rápido.`
          : `${dueNotes.length} ideas valen un riego rápido. Hoy basta con una.`,
      );
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [
    appLanguage,
    gardenNotes,
    notesLoaded,
    notificationsEnabled,
    reminderHour,
  ]);

  // Check for withered seeds periodically
  useEffect(() => {
    const checkWithered = () => {
      const now = Date.now();
      let changed = false;
      const updatedNotes = notes.map((note) => {
        if (
          !note.paused &&
          note.dueDate &&
          note.dueDate < now &&
          note.growthStage !== "bloom" &&
          note.growthStage !== "withered"
        ) {
          changed = true;
          return touchNote({ ...note, growthStage: "withered" as const });
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
    const isSprout = createMode === "sprout";
    const isJournal = createMode === "journal";
    const title = newNote.title.trim();
    const activeProjectTodos =
      isSprout && showProjectTodos
        ? projectTodos
            .map((todo) => ({ ...todo, text: todo.text.trim() }))
            .filter((todo) => todo.text)
        : [];
    const content = composerContent(
      newNote.content,
      isSprout && showProjectTodos ? activeProjectTodos : undefined,
    );
    if (!title && !content) return;
    const fallbackContent = content || title;
    const contentLines = fallbackContent
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const inferredTitle = contentLines[0] || fallbackContent;
    const firstStep =
      title ||
      content ||
      (appLanguage === "en"
        ? "Take the first five-minute step"
        : "Dar el primer paso de 5 minutos");
    const parsedTasks = contentLines
      .map((line) =>
        line
          .replace(/^[-*•]\s+/, "")
          .replace(/^\d+[.)]\s+/, "")
          .replace(/^\[[ xX]\]\s+/, "")
          .trim(),
      )
      .filter(Boolean);
    const sproutTasks =
      parsedTasks.length > 0
        ? activeProjectTodos.length > 0
          ? activeProjectTodos.map((todo) => ({
              id: crypto.randomUUID(),
              text: todo.text,
              completed: todo.completed,
              completedAt: todo.completed ? Date.now() : undefined,
            }))
          : parsedTasks.map((text) => ({
              id: crypto.randomUUID(),
              text,
              completed: false,
            }))
        : [{ id: crypto.randomUUID(), text: firstStep, completed: false }];
    const now = Date.now();
    const targetPlanetId = planets.some(
      (planet) => planet.id === newNote.planetId,
    )
      ? newNote.planetId
      : activePlanetId;
    const noteTitle =
      title ||
      (inferredTitle.length > 42
        ? `${inferredTitle.slice(0, 42)}...`
        : inferredTitle) ||
      (isSprout
        ? "Nuevo brote"
        : isJournal
          ? "Nueva reflexión"
          : "Nueva Semilla");
    const noteContent =
      !title && contentLines.length > 1
        ? contentLines.slice(1).join("\n")
        : fallbackContent;

    const note: SeedNote = {
      id: crypto.randomUUID(),
      title: noteTitle,
      content: noteContent,
      createdAt: now,
      tags: [],
      isGrowth: isSprout,
      tasks: isSprout ? sproutTasks : [],
      growthStage: isJournal ? "bloom" : isSprout ? "sprout" : "seed",
      dueDate: newNote.dueDate
        ? dateInputToEndOfDay(newNote.dueDate)
        : undefined,
      lastWateredAt: now,
      wateringIntervalDays: defaultWateringInterval,
      inbox: !isSprout && !isJournal,
      seedType: isJournal
        ? "learning"
        : isSprout
          ? "project"
          : newNote.seedType,
      priority: newNote.priority,
      reflection: isJournal ? fallbackContent : undefined,
      harvestedAt: isJournal ? now : undefined,
      planetId: targetPlanetId,
    };

    const isFirstUserSeed = gardenNotes.length === 0 && !isSprout && !isJournal;
    setNotes([touchNote(note), ...notes]);
    setActivePlanetId(targetPlanetId);
    setNewNote({
      title: "",
      content: "",
      dueDate: "",
      seedType: "idea",
      priority: "normal",
      planetId: targetPlanetId,
    });
    setCreateMode("seed");
    setShowQuickEntryDetails(false);
    setShowProjectTodos(false);
    setProjectTodos([]);
    blurQuickEntryFocus();
    setQuickEntryViewport({
      height: null,
      keyboardInset: 0,
      offsetTop: 0,
      keyboardOpen: false,
    });
    setIsAdding(false);
    setSelectedNoteId(null);
    setRecentlyCreatedNoteId(note.id);
    feel(isJournal ? "harvest" : "plant");
    setCelebration(
      isJournal
        ? "Reflexión guardada"
        : isSprout
          ? "Brote creado"
          : isFirstUserSeed
            ? "Tu primera semilla apareció en el jardín"
            : "Semilla plantada",
    );
    window.setTimeout(
      () =>
        setRecentlyCreatedNoteId((current) =>
          current === note.id ? null : current,
        ),
      1800,
    );
    window.setTimeout(() => setCelebration(null), 1500);
    setView(
      isJournal
        ? "harvest"
        : isSprout
          ? "projects"
          : isFirstUserSeed
            ? "3D"
            : "inbox",
    );
  };

  const captureQuickSeed = (value: string, keepCurrentView = false) => {
    const content = value.trim();
    if (!content) return;

    const note: SeedNote = {
      id: crypto.randomUUID(),
      title: content.length > 42 ? `${content.slice(0, 42)}...` : content,
      content,
      createdAt: Date.now(),
      tags: [],
      isGrowth: false,
      tasks: [],
      growthStage: "seed",
      lastWateredAt: Date.now(),
      wateringIntervalDays: defaultWateringInterval,
      inbox: true,
      seedType: "idea",
      priority: "normal",
      planetId: activePlanetId,
    };

    const isFirstUserSeed = gardenNotes.length === 0;
    const savedNote = touchNote(note);
    quickCaptureUndoRef.current = {
      id: savedNote.id,
      updatedAt: savedNote.updatedAt,
    };
    setNotes((current) => [savedNote, ...current]);
    feel("plant");
    setCelebration(
      isFirstUserSeed
        ? "Tu primera semilla apareció en el jardín"
        : "Semilla plantada",
    );
    window.setTimeout(() => setCelebration(null), 1500);
    if (!keepCurrentView && view !== "today")
      setView(isFirstUserSeed ? "3D" : "inbox");
    return note.id;
  };

  const addQuickNote = () => {
    const id = captureQuickSeed(quickNote);
    if (id) setQuickNote("");
    return id;
  };

  const undoQuickCapture = (id: string) => {
    const captured = quickCaptureUndoRef.current;
    if (!captured || captured.id !== id) return;
    // Never discard a note that has been edited or developed since capture.
    setNotes((current) =>
      current.filter(
        (note) =>
          !(
            note.id === id &&
            note.updatedAt === captured.updatedAt &&
            note.inbox &&
            !note.isGrowth
          ),
      ),
    );
    quickCaptureUndoRef.current = null;
  };

  const snoozeDashboardReview = (id: string) => {
    setReviewSnoozes((current) => ({
      ...readReviewSnoozes(JSON.stringify(current)),
      [id]: Date.now() + DAY_MS,
    }));
  };

  const reuseHarvestLearning = (id: string) => {
    const source = notes.find(
      (note) => note.id === id && note.growthStage === "bloom",
    );
    const lesson = source?.takeaway?.trim() || source?.reflection?.trim();
    if (!source || !lesson) return;
    const now = Date.now();
    const idea: SeedNote = touchNote({
      id: crypto.randomUUID(),
      planetId: source.planetId || activePlanetId,
      title:
        appLanguage === "en"
          ? `From: ${source.title}`
          : `A partir de: ${source.title}`,
      content: lesson,
      connections: [source.id],
      createdAt: now,
      tags: [],
      isGrowth: false,
      tasks: [],
      growthStage: "seed",
      inbox: true,
      seedType: "idea",
      priority: "normal",
      lastWateredAt: now,
      wateringIntervalDays: defaultWateringInterval,
    });
    setNotes((current) => [idea, ...current]);
    feel("plant");
    return idea.id;
  };

  const deleteNote = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (
      !window.confirm(
        `Eliminar "${note?.title || "esta semilla"}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setNotes((current) => current.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  const updateNote = (id: string, updates: Partial<SeedNote>) => {
    setNotes((current) =>
      current.map((n) => (n.id === id ? touchNote({ ...n, ...updates }) : n)),
    );
  };

  const updateFocusMemo = (id: string, focusNote: string) => {
    setNotes((current) =>
      current.map((n) => (n.id === id ? touchNote({ ...n, focusNote }) : n)),
    );
  };

  const recordWateringRitual = () => {
    const currentDay = format(Date.now(), "yyyy-MM-dd");
    const yesterday = format(Date.now() - DAY_MS, "yyyy-MM-dd");
    setWateringRitual((current) => {
      if (current.lastDate === currentDay) return current;
      return {
        lastDate: currentDay,
        streak: current.lastDate === yesterday ? current.streak + 1 : 1,
      };
    });
  };

  const markRecentlyWatered = (id: string) => {
    setRecentlyWateredId(id);
    window.setTimeout(
      () =>
        setRecentlyWateredId((current) => (current === id ? null : current)),
      5000,
    );
  };

  const growNote = (id: string, firstStep?: string) => {
    setNotes((current) =>
      current.map((n) => {
        if (n.id === id && !n.isGrowth) {
          const seedType =
            SEED_TYPES.find((type) => type.id === (n.seedType || "idea")) ||
            SEED_TYPES[0];
          const taskText = firstStep?.trim() || seedType.task;
          return touchNote({
            ...n,
            isGrowth: true,
            growthStage: "sprout",
            paused: false,
            inbox: false,
            lastWateredAt: Date.now(),
            tasks: [
              { id: crypto.randomUUID(), text: taskText, completed: false },
            ],
          });
        }
        return n;
      }),
    );
  };

  const openSproutPrompt = (id: string) => {
    const firstTodo = createDraftTodo();
    setSproutPromptNoteId(id);
    setSproutPromptTodos([firstTodo]);
    focusProjectTodoInput(firstTodo.id);
  };

  const confirmSproutPrompt = () => {
    if (!sproutPromptNoteId) return;
    const note = notes.find((n) => n.id === sproutPromptNoteId);
    const cleanTodos = sproutPromptTodos
      .map((todo) => ({ ...todo, text: todo.text.trim() }))
      .filter((todo) => todo.text);
    const fallbackStep = "Dar el primer paso de 5 minutos";
    const tasksToAdd =
      cleanTodos.length > 0
        ? cleanTodos.map((todo) => ({
            id: crypto.randomUUID(),
            text: todo.text,
            completed: todo.completed,
            completedAt: todo.completed ? Date.now() : undefined,
          }))
        : [{ id: crypto.randomUUID(), text: fallbackStep, completed: false }];
    if (note?.isGrowth) {
      setNotes((current) =>
        current.map((n) =>
          n.id === sproutPromptNoteId
            ? touchNote({
                ...n,
                inbox: false,
                paused: false,
                isGrowth: true,
                growthStage:
                  n.growthStage === "seed" ? "sprout" : n.growthStage,
                lastWateredAt: Date.now(),
                lastWateringNote: `Próximos pasos: ${tasksToAdd.map((task) => task.text).join(", ")}`,
                tasks: [...n.tasks, ...tasksToAdd],
              })
            : n,
        ),
      );
      recordWateringRitual();
      markRecentlyWatered(sproutPromptNoteId);
      feel("step");
      setCelebration(
        tasksToAdd.length > 1 ? "Pasos agregados" : "Paso agregado",
      );
      window.setTimeout(() => setCelebration(null), 1500);
      openFocusMode(sproutPromptNoteId);
    } else {
      setNotes((current) =>
        current.map((n) =>
          n.id === sproutPromptNoteId
            ? touchNote({
                ...n,
                inbox: false,
                paused: false,
                isGrowth: true,
                growthStage: "sprout",
                lastWateredAt: Date.now(),
                tasks: tasksToAdd,
              })
            : n,
        ),
      );
      feel("sprout");
      setCelebration("Semilla convertida en brote");
      window.setTimeout(() => setCelebration(null), 1500);
      setSelectedNoteId(null);
      setFilterStage("all");
      setSearch("");
      setView("projects");
    }
    setSproutPromptNoteId(null);
    setSproutPromptTodos([]);
  };

  const waterNote = (id: string, note = "Riego rápido: sigue viva") => {
    setNotes((current) =>
      current.map((n) => (n.id === id ? touchNote(waterSeedNote(n, note)) : n)),
    );
    recordWateringRitual();
    markRecentlyWatered(id);
    feel("water");
    setCelebration("Idea regada");
    window.setTimeout(() => setCelebration(null), 1500);
    setWateringNoteId(null);
    setWateringNote("");
  };

  const saveWateringObservation = (id: string, fallback: string) => {
    const cleanNote = wateringNote.trim();
    setNotes((current) =>
      current.map((n) =>
        n.id === id
          ? touchNote({
              ...n,
              lastWateredAt: Date.now(),
              lastWateringNote: cleanNote || fallback,
            })
          : n,
      ),
    );
    recordWateringRitual();
    markRecentlyWatered(id);
  };

  const skipWateringToday = (id: string) => {
    setNotes((current) =>
      current.map((n) =>
        n.id === id
          ? touchNote({
              ...n,
              lastWateredAt: Date.now(),
              lastWateringNote:
                appLanguage === "en"
                  ? "Later today: still worth keeping."
                  : "Más tarde: sigue valiendo la pena.",
            })
          : n,
      ),
    );
    setCelebration(
      appLanguage === "en" ? "Saved for later" : "La dejamos para después",
    );
    window.setTimeout(() => setCelebration(null), 1500);
  };

  const moveNoteToShed = (id: string, observation?: string) => {
    const cleanObservation = observation?.trim();
    setNotes((current) =>
      current.map((n) =>
        n.id === id
          ? touchNote({
              ...n,
              paused: true,
              inbox: false,
              lastWateredAt: Date.now(),
              lastWateringNote:
                cleanObservation ||
                (appLanguage === "en"
                  ? "Saved in the shed for later."
                  : "Guardada en el cobertizo para después."),
            })
          : n,
      ),
    );
    recordWateringRitual();
    markRecentlyWatered(id);
    setWateringNoteId(null);
    setCelebration(
      appLanguage === "en" ? "Saved in the shed" : "Guardada en el cobertizo",
    );
    window.setTimeout(() => setCelebration(null), 1500);
  };

  const restoreFromShed = (id: string) => {
    setNotes((current) =>
      current.map((n) =>
        n.id === id
          ? touchNote({
              ...n,
              paused: false,
              lastWateredAt: Date.now(),
              lastWateringNote:
                appLanguage === "en"
                  ? "Returned to the garden."
                  : "Vuelta al jardín.",
            })
          : n,
      ),
    );
    setCelebration(
      appLanguage === "en" ? "Back in the garden" : "Vuelta al jardín",
    );
    window.setTimeout(() => setCelebration(null), 1500);
  };

  const saveGardenerJournal = (draft: JournalDraft) => {
    const now = Date.now();
    const planetId = activePlanetId;
    setNotes((current) => {
      const existing = draft.entryId
        ? current.find(
            (note) =>
              note.id === draft.entryId &&
              note.planetId === planetId &&
              isDailyEntryNote(note),
          )
        : getDailyEntryForDate(current, now, planetId);
      // Never recreate a deleted historical entry with today's date.
      if (draft.entryId && !existing) return current;
      const note = touchNote(
        saveJournalEntry({
          existing,
          planetId,
          reflection: draft.reflection,
          mood: draft.mood,
          linkedNoteId: draft.linkedNoteId,
          language: appLanguage,
          now,
        }),
        now,
      );
      return existing
        ? current.map((entry) => (entry.id === existing.id ? note : entry))
        : [note, ...current];
    });
  };

  const closeDayWithReflection = (
    reflection: string,
    intention: string,
    intentionOutcome: DailyIntentionOutcome = "",
    nextStep: DailyNextStep = "",
  ) => {
    const alreadyClosedEntry = getDailyEntryForDate(
      notes,
      Date.now(),
      activePlanetId,
    );
    if (alreadyClosedEntry && isDailyClosureForDate(alreadyClosedEntry)) {
      setCelebration(
        appLanguage === "en" ? "Day already closed" : "El día ya está cerrado",
      );
      window.setTimeout(() => setCelebration(null), 1500);
      return;
    }

    const now = Date.now();
    const existingEntry = getDailyEntryForDate(notes, now, activePlanetId);
    const note = createDailyClosureNote({
      id: existingEntry?.id || dailyEntryId(activePlanetId, now),
      notes,
      reflection,
      intention,
      intentionOutcome,
      linkedNoteId:
        dailyIntentionNoteId || existingEntry?.dailyEntry?.linkedNoteId,
      nextStep,
      existingEntry,
      defaultWateringInterval,
      planetId: activePlanetId,
      language: appLanguage,
      now,
    });

    setNotes((current) => {
      const currentDayEntry = getDailyEntryForDate(
        current,
        now,
        activePlanetId,
      );
      if (currentDayEntry && isDailyClosureForDate(currentDayEntry, now))
        return current;
      const linkedNoteId = note.dailyEntry?.linkedNoteId;
      const next = current.map((existing) => {
        if (existing.id === note.id) return touchNote(note, now);
        if (
          nextStep === "shed" &&
          linkedNoteId &&
          existing.id === linkedNoteId
        ) {
          return touchNote(
            {
              ...existing,
              paused: true,
              inbox: false,
              lastWateringNote:
                appLanguage === "en"
                  ? "Moved to the shed while closing the day."
                  : "Movida al cobertizo al cerrar el día.",
            },
            now,
          );
        }
        if (
          nextStep === "garden" &&
          linkedNoteId &&
          existing.id === linkedNoteId &&
          existing.paused
        ) {
          return touchNote(
            {
              ...existing,
              paused: false,
              inbox: false,
              lastWateringNote:
                appLanguage === "en"
                  ? "Returned to the garden while closing the day."
                  : "Devuelta al jardín al cerrar el día.",
            },
            now,
          );
        }
        return existing;
      });
      return existingEntry ? next : [touchNote(note, now), ...next];
    });
    setCelebration(appLanguage === "en" ? "Day closed" : "Día cerrado");
    window.setTimeout(() => setCelebration(null), 1500);
  };

  const harvestFromWatering = (id: string) => {
    const completedNote = notes.find((n) => n.id === id);
    const cleanObservation = wateringNote.trim();
    setNotes((current) =>
      current.map((n) =>
        n.id === id
          ? touchNote({
              ...n,
              inbox: false,
              paused: false,
              growthStage: "bloom",
              harvestedAt: n.harvestedAt || Date.now(),
              lastWateredAt: Date.now(),
              lastWateringNote: cleanObservation || n.lastWateringNote,
            })
          : n,
      ),
    );
    recordWateringRitual();
    markRecentlyWatered(id);
    setWateringNoteId(null);
    setWateringNote("");
    feel("harvest");
    if (completedNote) setFlowerReward({ id, title: completedNote.title });
  };

  const openWatering = (id: string) => {
    setWateringNoteId(id);
    setWateringNote("");
  };

  const cultivateInboxNote = (id: string) => {
    openSproutPrompt(id);
  };

  const completeQuickSeed = (id: string) => {
    const completedNote = notes.find((n) => n.id === id);
    setNotes((current) =>
      current.map((n) =>
        n.id === id
          ? touchNote({
              ...n,
              inbox: false,
              paused: false,
              isGrowth: false,
              growthStage: "bloom",
              harvestedAt: n.harvestedAt || Date.now(),
              lastWateredAt: Date.now(),
            })
          : n,
      ),
    );
    setSelectedNoteId(null);
    if (completedNote) {
      feel("harvest");
      setFlowerReward({ id, title: completedNote.title });
    }
  };

  const saveInboxForLater = (id: string) => {
    setNotes((current) =>
      current.map((n) =>
        n.id === id
          ? touchNote({
              ...n,
              inbox: false,
              paused: true,
              lastWateredAt: Date.now(),
              lastWateringNote:
                appLanguage === "en"
                  ? "Saved in the shed for later."
                  : "Guardada en el cobertizo para después.",
            })
          : n,
      ),
    );
    setCelebration(
      appLanguage === "en" ? "Saved in the shed" : "Guardada en el cobertizo",
    );
    window.setTimeout(() => setCelebration(null), 1500);
  };

  const addTinyStep = (id: string, text?: string) => {
    const taskText =
      (text || wateringNote).trim() ||
      "Dedicar 2 minutos a destrabar esta idea";
    const previousNote = notes.find((note) => note.id === id);
    setNotes((current) =>
      current.map((n) => {
        if (n.id !== id) return n;
        return touchNote({
          ...n,
          isGrowth: true,
          growthStage: n.growthStage === "seed" ? "sprout" : n.growthStage,
          paused: false,
          inbox: false,
          lastWateredAt: Date.now(),
          lastWateringNote: `Próximo micro-paso: ${taskText}`,
          tasks: [
            ...n.tasks,
            { id: crypto.randomUUID(), text: taskText, completed: false },
          ],
        });
      }),
    );
    recordWateringRitual();
    markRecentlyWatered(id);
    feel(
      previousNote?.growthStage === "seed" || !previousNote?.isGrowth
        ? "sprout"
        : "step",
    );
    setCelebration("Brote con siguiente paso");
    window.setTimeout(() => setCelebration(null), 1500);
    openFocusMode(id);
    setWateringNoteId(null);
    setWateringNote("");
  };

  const togglePauseNote = (id: string) => {
    setNotes((current) =>
      current.map((n) =>
        n.id === id ? touchNote({ ...n, paused: !n.paused }) : n,
      ),
    );
  };

  const logFocusMinutes = (id: string, minutes: number) => {
    setNotes((current) =>
      current.map((n) =>
        n.id === id ? touchNote(addFocusMinutes(n, minutes)) : n,
      ),
    );
  };

  const showSeedNotification = async (body: string) => {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Seeds", {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "seed-daily-review",
      });
      return;
    }
    new Notification("Seeds", {
      body,
      icon: "/icon-192.png",
      tag: "seed-daily-review",
    });
  };

  const enableNotifications = async () => {
    const nativePermission = await requestSeedNotificationPermission();
    if (nativePermission === "granted") {
      setNotificationsEnabled(true);
      setCelebration(
        appLanguage === "en" ? "Reminders enabled" : "Recordatorios activados",
      );
      window.setTimeout(() => setCelebration(null), 1500);
      await scheduleSeedReminders({
        notes: gardenNotes,
        reminderHour,
        language: appLanguage,
      });
      return;
    }

    if (nativePermission === "denied") {
      setNotificationsEnabled(false);
      setCelebration(
        appLanguage === "en"
          ? "Enable notifications in Settings"
          : "Activa notificaciones en Ajustes",
      );
      window.setTimeout(() => setCelebration(null), 1800);
      return;
    }

    if (!("Notification" in window)) return;
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    const enabled = permission === "granted";
    setNotificationsEnabled(enabled);
    if (enabled) {
      await showSeedNotification(
        "Listo. Te avisaré cuando alguna idea valga un riego rápido.",
      );
    }
  };

  const addTask = (noteId: string) => {
    setNotes((current) =>
      current.map((n) => {
        if (n.id === noteId) {
          return touchNote({
            ...n,
            tasks: [
              ...n.tasks,
              { id: crypto.randomUUID(), text: "", completed: false },
            ],
          });
        }
        return n;
      }),
    );
  };

  const updateTask = (noteId: string, taskId: string, text: string) => {
    setNotes((current) =>
      current.map((n) => {
        if (n.id === noteId) {
          return touchNote({
            ...n,
            tasks: n.tasks.map((t) => (t.id === taskId ? { ...t, text } : t)),
          });
        }
        return n;
      }),
    );
  };

  const deleteTask = (noteId: string, taskId: string) => {
    setNotes((current) =>
      current.map((n) => {
        if (n.id !== noteId) return n;

        const tasks = n.tasks.filter((task) => task.id !== taskId);
        const hasOpenTasks = tasks.some((task) => !task.completed);
        const shouldReopenHarvest = n.growthStage === "bloom" && hasOpenTasks;
        const growthStage = shouldReopenHarvest
          ? "sprout"
          : n.growthStage === "bloom" || n.growthStage === "withered"
            ? n.growthStage
            : n.isGrowth
              ? "sprout"
              : "seed";

        return touchNote({
          ...n,
          tasks,
          growthStage,
          harvestedAt: growthStage === "bloom" ? n.harvestedAt : undefined,
        });
      }),
    );
  };

  const toggleTask = (noteId: string, taskId: string) => {
    const noteBeforeToggle = notes.find((note) => note.id === noteId);
    const taskBeforeToggle = noteBeforeToggle?.tasks.find(
      (task) => task.id === taskId,
    );
    const toggledPreview = noteBeforeToggle
      ? toggleTaskForNote(noteBeforeToggle, taskId)
      : null;
    const completedStep = Boolean(
      taskBeforeToggle && !taskBeforeToggle.completed,
    );
    const harvestedNoteId =
      noteBeforeToggle?.growthStage !== "bloom" &&
      toggledPreview?.growthStage === "bloom"
        ? toggledPreview.id
        : null;
    setNotes((current) =>
      current.map((n) => {
        if (n.id === noteId) {
          return touchNote(toggleTaskForNote(n, taskId));
        }
        return n;
      }),
    );
    if (harvestedNoteId) {
      feel("harvest");
      window.setTimeout(() => setHarvestNoteId(harvestedNoteId), 500);
      return;
    }
    if (completedStep) {
      feel("step");
      setCelebration("Labor completada");
      window.setTimeout(() => setCelebration(null), 1500);
    }
  };

  const toggleConnection = (fromId: string, toId: string) => {
    setNotes((current) =>
      current.map((n) => {
        if (n.id === fromId) {
          const connections = n.connections || [];
          const exists = connections.includes(toId);
          return touchNote({
            ...n,
            connections: exists
              ? connections.filter((id) => id !== toId)
              : [...connections, toId],
          });
        }
        return n;
      }),
    );
  };

  const activePlanet = useMemo(() => {
    return (
      planets.find((planet) => planet.id === activePlanetId) ||
      planets[0] ||
      DEFAULT_PLANETS[0]
    );
  }, [activePlanetId, planets]);

  const currentDailyEntry = useMemo(
    () => getDailyEntryForDate(notes, Date.now(), activePlanet.id),
    [activePlanet.id, notes],
  );
  const previousDailyEntry = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return getDailyEntryForDate(notes, yesterday.getTime(), activePlanet.id);
  }, [activePlanet.id, notes]);

  const saveDailyFocus = (
    intention: string,
    linkedNoteId?: string,
    linkedTaskId?: string,
  ) => {
    if (currentDailyEntry?.dailyEntry?.closedAt) return;
    const cleanedIntention = intention.trim();
    const now = Date.now();
    setDailyIntention(cleanedIntention);
    setDailyIntentionNoteId(linkedNoteId || "");
    setNotes((current) =>
      saveDailyFocusEntry(current, {
        intention: cleanedIntention,
        linkedNoteId,
        linkedTaskId,
        planetId: activePlanet.id,
        language: appLanguage,
        now,
      }),
    );
  };

  const toggleTodayFocus = () => {
    if (!currentDailyEntry || !lease.isActive()) return;
    setNotes((current) =>
      toggleDailyFocusCompletion(current, currentDailyEntry.id),
    );
  };

  const continuePreviousDailyEntry = (entry: SeedNote) => {
    const entryData = entry.dailyEntry;
    if (!entryData?.intention) return;
    const linkedNoteId =
      entryData.linkedNoteId &&
      gardenNotes.some((note) => note.id === entryData.linkedNoteId)
        ? entryData.linkedNoteId
        : undefined;
    const now = Date.now();
    setDailyIntention(entryData.intention);
    setDailyIntentionNoteId(linkedNoteId || "");
    setNotes((current) => {
      const existingToday = getDailyEntryForDate(current, now, activePlanet.id);
      const todayEntry = existingToday
        ? updateDailyEntryFocus(
            existingToday,
            entryData.intention,
            linkedNoteId,
            now,
            linkedNoteId ? entryData.linkedTaskId : undefined,
          )
        : createDailyEntryNote({
            id: dailyEntryId(activePlanet.id, now),
            intention: entryData.intention,
            linkedNoteId,
            planetId: activePlanet.id,
            language: appLanguage,
            now,
          });
      if (existingToday?.dailyEntry?.closedAt) return current;
      if (!existingToday && todayEntry.dailyEntry)
        todayEntry.dailyEntry.linkedTaskId = linkedNoteId
          ? entryData.linkedTaskId
          : undefined;
      const updated = current.map((note) => {
        if (note.id === entry.id) {
          return touchNote(
            {
              ...note,
              dailyEntry: note.dailyEntry
                ? { ...note.dailyEntry, continuedAt: now }
                : note.dailyEntry,
            },
            now,
          );
        }
        if (linkedNoteId && note.id === linkedNoteId && note.paused) {
          return touchNote(
            {
              ...note,
              paused: false,
              inbox: false,
              lastWateringNote:
                appLanguage === "en"
                  ? "Returned to the garden to continue today."
                  : "Devuelta al jardín para continuar hoy.",
            },
            now,
          );
        }
        return existingToday && note.id === existingToday.id
          ? todayEntry
          : note;
      });
      return existingToday ? updated : [todayEntry, ...updated];
    });
  };

  const dismissPreviousDailyEntry = (entryId: string) => {
    const now = Date.now();
    setNotes((current) =>
      current.map((note) =>
        note.id === entryId && note.dailyEntry
          ? touchNote(
              { ...note, dailyEntry: { ...note.dailyEntry, dismissedAt: now } },
              now,
            )
          : note,
      ),
    );
  };

  useEffect(() => {
    if (!notesLoaded) return;
    if (currentDailyEntry?.dailyEntry) {
      setDailyIntention(currentDailyEntry.dailyEntry.intention);
      setDailyIntentionNoteId(currentDailyEntry.dailyEntry.linkedNoteId || "");
      legacyDailyFocusRef.current = { intention: "", linkedNoteId: "" };
      removeStoredItem(`seed-daily-intention-${todayKey}`);
      removeStoredItem(`seed-daily-intention-note-${todayKey}`);
      return;
    }

    const legacyFocus = legacyDailyFocusRef.current;
    if (legacyFocus.intention.trim()) {
      const linkedNoteId =
        legacyFocus.linkedNoteId &&
        gardenNotes.some((note) => note.id === legacyFocus.linkedNoteId)
          ? legacyFocus.linkedNoteId
          : undefined;
      legacyDailyFocusRef.current = { intention: "", linkedNoteId: "" };
      setNotes((current) =>
        getDailyEntryForDate(current, Date.now(), activePlanet.id)
          ? current
          : [
              createDailyEntryNote({
                id: dailyEntryId(activePlanet.id),
                intention: legacyFocus.intention,
                linkedNoteId,
                planetId: activePlanet.id,
                language: appLanguage,
              }),
              ...current,
            ],
      );
      removeStoredItem(`seed-daily-intention-${todayKey}`);
      removeStoredItem(`seed-daily-intention-note-${todayKey}`);
      return;
    }

    setDailyIntention("");
    setDailyIntentionNoteId("");
  }, [
    activePlanet.id,
    currentDailyEntry?.id,
    currentDailyEntry?.updatedAt,
    notesLoaded,
  ]);

  const planetNotes = useMemo(() => {
    return gardenNotes.filter(
      (note) => (note.planetId || DEFAULT_PLANET_ID) === activePlanet.id,
    );
  }, [activePlanet.id, gardenNotes]);
  const planetEntries = useMemo(
    () =>
      notes.filter(
        (note) => (note.planetId || DEFAULT_PLANET_ID) === activePlanet.id,
      ),
    [notes, activePlanet.id],
  );
  const boardRaw = getStoredItem(gardenBoardKey(activePlanet.id));
  const saveGardenBoard = (board: GardenBoardData) => {
    if (!lease.isActive()) return false;
    const saved = setStoredItem(
      gardenBoardKey(activePlanet.id),
      JSON.stringify(board),
    );
    if (saved) setBoardRevision((revision) => revision + 1);
    return saved;
  };
  const filteredNotes = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    return planetNotes.filter((n) => {
      if (n.inbox) return false;
      const matchesSpecialSearch =
        normalizedSearch === "pausadas" || normalizedSearch === "cobertizo"
          ? Boolean(n.paused)
          : normalizedSearch === "riego"
            ? !n.paused && n.growthStage !== "bloom" && wateringDue(n)
            : normalizedSearch === "activas"
              ? !n.paused && n.growthStage !== "bloom"
              : false;
      const matchesSearch =
        !normalizedSearch ||
        matchesSpecialSearch ||
        n.title.toLowerCase().includes(normalizedSearch) ||
        n.content.toLowerCase().includes(normalizedSearch) ||
        (n.seedType || "").includes(normalizedSearch);
      const matchesStage =
        filterStage === "all" || n.growthStage === filterStage;
      return matchesSearch && matchesStage;
    });
  }, [planetNotes, search, filterStage]);

  const projectNotes = useMemo(() => {
    return planetNotes
      .filter(
        (note) =>
          !note.inbox &&
          !note.paused &&
          note.isGrowth &&
          note.growthStage !== "bloom",
      )
      .sort((a, b) => noteUpdatedAt(b) - noteUpdatedAt(a));
  }, [planetNotes]);

  const shedNotes = useMemo(() => {
    return planetNotes
      .filter(
        (note) => !note.inbox && note.paused && note.growthStage !== "bloom",
      )
      .sort((a, b) => noteUpdatedAt(b) - noteUpdatedAt(a));
  }, [planetNotes]);

  const visibleGardenNotes = view === "projects" ? projectNotes : filteredNotes;
  const gardenList = useProgressiveList(
    visibleGardenNotes,
    `${activePlanet.id}-${view}-${search}-${filterStage}-${visibleGardenNotes.length}-${visibleGardenNotes[0]?.id || "empty"}`,
  );

  const selectedNote = useMemo(
    () => planetNotes.find((n) => n.id === selectedNoteId),
    [planetNotes, selectedNoteId],
  );
  const selectedIsDone = selectedNote?.growthStage === "bloom";
  const selectedIsQuickSeed = Boolean(
    selectedNote && !selectedNote.isGrowth && !selectedIsDone,
  );
  const selectedIsProject = Boolean(selectedNote?.isGrowth && !selectedIsDone);

  const growingNotes = useMemo(
    () =>
      planetNotes.filter(
        (n) => n.isGrowth && !n.inbox && !n.paused && n.growthStage !== "bloom",
      ),
    [planetNotes],
  );

  const gardenStats = useMemo(() => {
    return planetNotes.reduce(
      (stats, note) => {
        if (note.inbox) {
          stats.seeds += 1;
          return stats;
        }
        stats.total += 1;
        if (note.growthStage === "bloom") {
          stats.completed += 1;
          if (note.isGrowth) stats.trees += 1;
          else stats.flowers += 1;
        }
        if (note.isGrowth && !note.paused && note.growthStage !== "bloom")
          stats.active += 1;
        if (note.paused && note.growthStage !== "bloom") stats.shed += 1;
        if (note.growthStage === "seed") stats.plantedSeeds += 1;
        if (note.growthStage === "sprout") stats.visualSprouts += 1;
        if (!note.paused && note.growthStage !== "bloom" && wateringDue(note))
          stats.watering += 1;
        return stats;
      },
      {
        total: 0,
        completed: 0,
        active: 0,
        seeds: 0,
        shed: 0,
        plantedSeeds: 0,
        visualSprouts: 0,
        watering: 0,
        flowers: 0,
        trees: 0,
      },
    );
  }, [planetNotes]);

  const planetNoteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of gardenNotes) {
      const id = note.planetId || DEFAULT_PLANET_ID;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }, [gardenNotes]);

  const getProgress = useCallback((note: SeedNote) => {
    if (!note.tasks.length) return 0;
    const completed = note.tasks.filter((t) => t.completed).length;
    return Math.round((completed / note.tasks.length) * 100);
  }, []);
  const selectedProgress = selectedNote ? getProgress(selectedNote) : 0;
  const selectedCompletedSteps =
    selectedNote?.tasks.filter((task) => task.completed).length || 0;
  const selectedReviewDays = selectedNote
    ? daysSince(selectedNote.lastWateredAt || selectedNote.createdAt)
    : 0;
  const selectedGuidance = selectedNote ? getIdeaGuidance(selectedNote) : null;
  const selectedSeedType = selectedNote
    ? SEED_TYPES.find(
        (type) => type.id === (selectedNote.seedType || "idea"),
      ) || SEED_TYPES[0]
    : SEED_TYPES[0];
  const selectedPriority = selectedNote
    ? PRIORITY_OPTIONS.find(
        (option) => option.id === (selectedNote.priority || "normal"),
      ) || PRIORITY_OPTIONS[1]
    : PRIORITY_OPTIONS[1];
  const selectedNextTask = selectedNote?.tasks.find((task) => !task.completed);

  const exportGarden = () => {
    const markdown = planetNotes
      .map((note) => {
        const status = note.inbox
          ? "Semillero"
          : note.paused
            ? "El cobertizo"
            : STAGE_META[note.growthStage].label;
        const tasks = note.tasks.length
          ? `\n\n${note.tasks.map((task) => `- [${task.completed ? "x" : " "}] ${task.text}`).join("\n")}`
          : "";
        const reflection = note.reflection
          ? `\n\nReflexión: ${note.reflection}`
          : "";
        const takeaway = note.takeaway ? `\n\nMe dejó: ${note.takeaway}` : "";
        const focusNote = note.focusNote
          ? `\n\nNota de enfoque: ${note.focusNote}`
          : "";
        return `# ${note.title}\n\nEstado: ${status}\nTipo: ${note.seedType || "idea"}\n\n${note.content}${tasks}${reflection}${takeaway}${focusNote}`;
      })
      .join("\n\n---\n\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `seed-${activePlanet.name.toLowerCase().replace(/\s+/g, "-")}-${format(Date.now(), "yyyy-MM-dd")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBackup = () => {
    const gardenBoards = Object.fromEntries(
      planets.map((planet) => [
        planet.id,
        getStoredItem(gardenBoardKey(planet.id)),
      ]),
    );
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 2,
            exportedAt: Date.now(),
            activePlanetId,
            planets,
            notes,
            gardenBoards,
          },
          null,
          2,
        ),
      ],
      { type: "application/json;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `seed-backup-${format(Date.now(), "yyyy-MM-dd")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const recoverLegacyGarden = async () => {
    if (!lease.isActive() || isSyncing) return;
    setRecoveringLegacy(true);
    try {
      assertLegacyRecoveryOwner(lease.scope);
      const legacyNotes = await loadLegacyNotes();
      const legacyPlanets = normalizePlanets(
        JSON.parse(getDeviceItem("seed-planets") || "[]"),
      );
      if (!lease.isActive()) return;
      if (!legacyNotes.length && !legacyPlanets.length) {
        setSyncStatus(
          "No se encontraron notas ni jardines de la versión anterior.",
        );
        return;
      }
      const destination =
        session?.user.email || "el modo invitado de este dispositivo";
      if (
        !window.confirm(
          `Los datos anteriores no tienen una cuenta identificada. ¿Confirmas que son tuyos y quieres recuperar ${legacyNotes.length} ideas en ${destination}?${session ? " Se podrán sincronizar con esta cuenta." : ""} No se reemplazarán ideas existentes ni se copiará el perfil anterior.`,
        )
      )
        return;
      reserveLegacyRecovery(lease.scope);
      const focusNotes = normalizeFocusNoteMap(
        JSON.parse(getDeviceItem("seed-focus-notes") || "{}"),
      );
      const recovered = mergeLegacyGarden(
        { notes: latestNotes.current.notes, planets },
        {
          notes: migrateFocusNotesIntoSeeds(legacyNotes, focusNotes),
          planets: legacyPlanets,
        },
      );
      await saveNotesToDb(lease.scope, recovered.notes);
      if (!setStoredItem("seed-planets", JSON.stringify(recovered.planets)))
        throw new Error(
          "No se pudieron guardar los jardines recuperados. Los originales siguen intactos.",
        );
      if (!lease.isActive()) return;
      setPlanets(recovered.planets);
      setNotes(recovered.notes);
      setSyncStatus(
        "Datos recuperados en este espacio. La copia anterior permanece intacta.",
      );
    } catch (error) {
      if (lease.isActive())
        setSyncStatus(
          error instanceof Error
            ? error.message
            : "No se pudieron recuperar los datos anteriores.",
        );
    } finally {
      if (lease.isActive()) setRecoveringLegacy(false);
    }
  };

  const importBackup = async (file: File) => {
    let parsed: unknown;
    try {
      const text = await file.text();
      if (!lease.isActive()) return;
      parsed = JSON.parse(text);
    } catch {
      window.alert(
        "No se pudo leer este backup. Revisa que sea un archivo JSON valido.",
      );
      return;
    }
    const parsedRecord =
      parsed && typeof parsed === "object"
        ? (parsed as {
            notes?: unknown;
            planets?: unknown;
            activePlanetId?: unknown;
            gardenBoards?: unknown;
          })
        : null;
    const rawNotes = Array.isArray(parsed) ? parsed : parsedRecord?.notes;
    if (!Array.isArray(rawNotes)) {
      window.alert("El archivo no parece ser un backup de Seeds.");
      return;
    }
    const importedNotes = normalizeNotes(rawNotes);
    if (rawNotes.length > 0 && importedNotes.length === 0) {
      window.alert("No se encontraron ideas validas en este backup.");
      return;
    }
    const importedPlanets = normalizePlanets(parsedRecord?.planets);
    const nextPlanets = importedPlanets.length > 0 ? importedPlanets : planets;
    const importedBoards: [string, string | null][] = [];
    if (parsedRecord?.gardenBoards !== undefined) {
      try {
        if (
          !parsedRecord.gardenBoards ||
          typeof parsedRecord.gardenBoards !== "object" ||
          Array.isArray(parsedRecord.gardenBoards)
        )
          throw new Error("Invalid boards");
        for (const planet of nextPlanets) {
          const raw = (parsedRecord.gardenBoards as Record<string, unknown>)[
            planet.id
          ];
          if (raw === undefined) continue;
          if (raw !== null && typeof raw !== "string")
            throw new Error("Invalid board");
          readGardenBoard(raw as string | null);
          importedBoards.push([planet.id, raw as string | null]);
        }
      } catch {
        window.alert(
          "No se pudieron leer las pizarras del backup. Tu jardín actual no se ha modificado.",
        );
        return;
      }
    }
    if (
      !window.confirm(
        `Importar ${importedNotes.length} ideas? Esto reemplazará tu jardín actual${importedBoards.length ? " y las pizarras incluidas" : ""}.`,
      )
    )
      return;
    const nextActivePlanetId =
      typeof parsedRecord?.activePlanetId === "string" &&
      nextPlanets.some((planet) => planet.id === parsedRecord.activePlanetId)
        ? parsedRecord.activePlanetId
        : nextPlanets[0]?.id || activePlanetId;
    const importedPlanetIds = new Set(nextPlanets.map((planet) => planet.id));
    for (const [id, raw] of importedBoards) {
      const saved =
        raw === null
          ? removeStoredItem(gardenBoardKey(id))
          : setStoredItem(gardenBoardKey(id), raw);
      if (!saved) {
        window.alert(
          "No se pudo guardar una pizarra importada. Revisa el espacio disponible antes de continuar.",
        );
        return;
      }
    }

    setPlanets(nextPlanets);
    setActivePlanetId(nextActivePlanetId);
    setNotes(
      importedNotes.map((note) =>
        importedPlanetIds.has(note.planetId || DEFAULT_PLANET_ID)
          ? note
          : { ...note, planetId: nextActivePlanetId },
      ),
    );
    setSelectedNoteId(null);
    setShowSettings(false);
  };

  const clearGardenData = () => {
    if (
      !window.confirm(
        "Borrar todo tu jardín? Esta acción no se puede deshacer.",
      )
    )
      return;
    if (
      !window.confirm(
        "Confirmación final: se eliminarán todas las ideas, cosechas, pizarras y rachas locales.",
      )
    )
      return;
    for (const planet of planets) removeStoredItem(gardenBoardKey(planet.id));
    setBoardRevision((revision) => revision + 1);
    setView("today");
    setNotes([]);
    setSelectedNoteId(null);
    setWateringRitual({ lastDate: "", streak: 0 });
    removeStoredItem("seed-last-notification-day");
    setShowSettings(false);
  };

  const finishOnboarding = () => {
    setStoredItem("seed-onboarded", "true");
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const startPlanting = (
    mode: CreateMode = "seed",
    seedType?: NonNullable<SeedNote["seedType"]>,
  ) => {
    const initialSeedType =
      seedType ||
      (mode === "sprout"
        ? "project"
        : mode === "journal"
          ? "learning"
          : "idea");
    setShowCreateMenu(false);
    setCreateMode(mode);
    setShowQuickEntryDetails(false);
    unlockSeedAudio();
    setShowDiscardConfirmation(false);
    setShowProjectTodos(mode === "sprout");
    setProjectTodos(mode === "sprout" ? [createDraftTodo()] : []);
    feel("open");
    playMicroSound("pop", true);
    setSelectedNoteId(null);
    setFilterStage("all");
    setSearch("");
    setNewNote({
      title: "",
      content: "",
      dueDate: "",
      seedType: initialSeedType,
      priority: "normal",
      planetId: activePlanetId,
    });
    setQuickEntryViewport({
      height: null,
      keyboardInset: 0,
      offsetTop: 0,
      keyboardOpen: false,
    });
    setIsAdding(true);
  };

  useEffect(() => {
    const openSharedSeed = (sharedText = "") => {
      removeDeviceItem("seed-pending-action");
      startPlanting();
      if (sharedText.trim()) {
        window.requestAnimationFrame(() => {
          setNewNote((current) => ({ ...current, content: sharedText.trim() }));
        });
      }
    };
    const openToday = () => {
      removeDeviceItem("seed-pending-action");
      setSelectedNoteId(null);
      setView("today");
    };
    const handleSeedUrl = (rawUrl = "") => {
      if (isAuthCallbackUrl(rawUrl)) return;
      const normalizedUrl = rawUrl.toLowerCase();
      if (normalizedUrl.includes("today")) {
        openToday();
        return;
      }
      openSharedSeed();
    };

    const pendingAction = getDeviceItem("seed-pending-action");
    if (pendingAction === "new-seed") {
      window.requestAnimationFrame(() => openSharedSeed());
    } else if (pendingAction === "today") {
      window.requestAnimationFrame(openToday);
    }

    const params = new URLSearchParams(window.location.search);
    const sharedTitle = params.get("title") || "";
    const sharedText = params.get("text") || "";
    const sharedUrl = params.get("url") || "";
    const sharedPayload = [sharedTitle, sharedText, sharedUrl]
      .filter(Boolean)
      .join("\n");
    if (sharedPayload.trim()) {
      window.requestAnimationFrame(() => {
        openSharedSeed(sharedPayload);
        window.history.replaceState(null, "", window.location.pathname);
      });
    }

    const handleNativeUrl = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      handleSeedUrl(detail?.url || "");
    };

    window.addEventListener("seed:native-url", handleNativeUrl);
    return () => window.removeEventListener("seed:native-url", handleNativeUrl);
  }, []);

  const showWateringQueue = () => {
    setSelectedNoteId(null);
    setFilterStage("all");
    setSearch("riego");
    setView("garden");
  };

  const switchPlanet = (id: string) => {
    setActivePlanetId(id);
    setSelectedNoteId(null);
    setFocusNoteId(null);
    setSearch("");
    setFilterStage("all");
    setView("today");
    setShowGardenSwitcher(false);
  };

  const addPlanet = () => {
    const name = newPlanetName.trim();
    if (!name) return;
    const planet: Planet = touchPlanet({
      id: crypto.randomUUID(),
      name,
      description: "Nuevo jardín para cultivar ideas.",
      theme,
      createdAt: Date.now(),
    });
    setPlanets([...planets, planet]);
    setNewPlanetName("");
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
    setPlanets((current) =>
      current.map((planet) =>
        planet.id === activePlanet.id
          ? touchPlanet({ ...planet, name })
          : planet,
      ),
    );
    setShowPlanetSettings(false);
  };

  const deleteActivePlanet = () => {
    if (planets.length <= 1) {
      window.alert("Necesitas al menos un jardín para guardar tus ideas.");
      return;
    }

    const ideasInPlanet = gardenNotes.filter(
      (note) => (note.planetId || DEFAULT_PLANET_ID) === activePlanet.id,
    ).length;
    if (
      !window.confirm(
        `Borrar el jardín "${activePlanet.name}"? Se eliminarán ${ideasInPlanet} ideas de este espacio. Esta acción no se puede deshacer.`,
      )
    )
      return;
    if (
      !window.confirm(
        "Confirmación final: borrar este jardín, su pizarra y sus ideas permanentemente?",
      )
    )
      return;
    removeStoredItem(gardenBoardKey(activePlanet.id));

    const nextPlanet =
      planets.find((planet) => planet.id !== activePlanet.id) ||
      DEFAULT_PLANETS[0];
    setNotes((current) =>
      current.filter(
        (note) => (note.planetId || DEFAULT_PLANET_ID) !== activePlanet.id,
      ),
    );
    setPlanets((current) =>
      current.filter((planet) => planet.id !== activePlanet.id),
    );
    setShowPlanetSettings(false);
    switchPlanet(nextPlanet.id);
  };

  const signUpWithEmail = async () => {
    if (!supabase) {
      setAuthStatus("Supabase no está configurado.");
      return;
    }
    const passwordIssue = passwordPolicyError(authPassword);
    if (passwordIssue) {
      setAuthStatus(passwordIssue);
      return;
    }
    if (!authConfirmPassword) {
      setAuthStatus("Confirma tu contraseña para crear tu jardín.");
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthStatus("Las contraseñas no coinciden.");
      return;
    }

    try {
      await saveNotesToDb(lease.scope, notes);
    } catch {
      setAuthStatus(
        "Guarda tu jardín local antes de crear una cuenta. Revisa el espacio disponible.",
      );
      return;
    }
    if (!lease.isActive()) return;
    setAuthStatus("Creando cuenta...");
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        emailRedirectTo: getAuthRedirectUrl("confirmation"),
        data: {
          name:
            authName.trim() ||
            (account.name === "Modo invitado" ? "Mi cuenta" : account.name),
          role: account.role,
        },
      },
    });
    setAuthStatus(
      error
        ? formatAuthError(error.message)
        : data.session
          ? "Cuenta creada. Tu sesión ya está activa."
          : "Cuenta creada. Te enviamos un correo para confirmar tu registro.",
    );
    if (!error && data.session) {
      authFlow.completeAuthFlow();
      enterApp();
    }
  };

  const requestPasswordReset = async () => {
    if (!supabase) {
      setAuthStatus("Supabase no está configurado.");
      return;
    }
    const email = authEmail.trim();
    if (!email || !email.includes("@")) {
      setAuthStatus("Escribe un correo válido para recuperar tu cuenta.");
      return;
    }

    setAuthStatus("Enviando enlace seguro…");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl("recovery"),
    });
    setAuthStatus(
      error
        ? formatAuthError(error.message)
        : "Si existe una cuenta con ese correo, recibirás un enlace para crear una nueva contraseña.",
    );
  };

  const updatePassword = async () => {
    if (
      !supabase ||
      !session?.user ||
      !authFlow.passwordRecovery ||
      authFlow.callbackError
    ) {
      setAuthStatus("El enlace ya no es válido o expiró. Solicita uno nuevo.");
      return;
    }
    const passwordIssue = passwordPolicyError(authPassword);
    if (passwordIssue) {
      setAuthStatus(passwordIssue);
      return;
    }
    if (!authConfirmPassword || authPassword !== authConfirmPassword) {
      setAuthStatus(
        !authConfirmPassword
          ? "Confirma tu nueva contraseña."
          : "Las contraseñas no coinciden.",
      );
      return;
    }

    setAuthStatus("Guardando tu nueva contraseña…");
    const { error } = await supabase.auth.updateUser({
      password: authPassword,
    });
    if (error) {
      setAuthStatus(formatAuthError(error.message));
      return;
    }
    setAuthPassword("");
    setAuthConfirmPassword("");
    setAuthStatus("Contraseña actualizada.");
    authFlow.completeAuthFlow();
    enterApp();
  };

  const signInWithEmail = async () => {
    if (!supabase) {
      setAuthStatus("Supabase no está configurado.");
      return;
    }

    try {
      await saveNotesToDb(lease.scope, notes);
    } catch {
      setAuthStatus(
        "No se pudo guardar el jardín invitado. Revisa el espacio disponible antes de entrar.",
      );
      return;
    }
    if (!lease.isActive()) return;
    setAuthStatus("Iniciando sesión...");
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    if (error) {
      setAuthStatus(formatAuthError(error.message));
      return;
    }
    setAuthStatus("Sesión iniciada.");
    authFlow.completeAuthFlow();
    enterApp();
  };

  const signOut = async () => {
    if (!supabase || !session?.user || accountAction) return;
    setAccountAction("signout");
    setSyncStatus("");
    setAuthStatus("Guardando el jardín antes de salir…");
    try {
      await saveNotesToDb(lease.scope, notes);
      if (!lease.isActive()) return;
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      if (lease.isActive())
        setAuthStatus(
          "No se pudo cerrar sesión con seguridad. Tus notas siguen en esta cuenta; vuelve a intentarlo.",
        );
      if (lease.isActive()) setAccountAction(null);
    }
  };

  const deleteAccount = async () => {
    if (!supabase || !session?.user || accountAction) return;
    const identity = session.user.email || "esta cuenta";
    if (
      !window.confirm(
        `¿Eliminar permanentemente ${identity}? Se borrarán la cuenta, sus jardines, ideas y datos sincronizados.`,
      )
    )
      return;
    if (
      !window.confirm(
        "Confirmación final: esta acción no se puede deshacer. Si quieres conservar algo, cancela y exporta un backup primero.",
      )
    )
      return;

    setAccountAction("delete");
    setSyncStatus("");
    setAuthStatus("Eliminando tu cuenta y sus datos…");
    let remoteDeleted = false;
    try {
      await deleteOwnAccountFromSupabase(lease.syncAccess());
      remoteDeleted = true;
      // Prevent the account workspace cleanup from recreating its deleted note cache.
      latestNotes.current = { notes: [], notesLoaded: false };
      await deleteNotesFromDb(lease.scope);
      if (!clearAccountStorage(lease.scope))
        throw new Error(
          "La cuenta se eliminó, pero no se pudieron limpiar todos sus datos de este dispositivo.",
        );
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch (error) {
      if (remoteDeleted) {
        // The server-side deletion succeeded; always try to remove the now-invalid local session.
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
      if (lease.isActive()) {
        setAuthStatus(
          remoteDeleted
            ? "La cuenta fue eliminada. Cierra y vuelve a abrir Seeds para completar la limpieza local."
            : error instanceof Error
              ? error.message
              : "No se pudo eliminar la cuenta. Inténtalo de nuevo.",
        );
        setAccountAction(null);
      }
    }
  };

  const syncGarden = async () => {
    if (!session?.user) {
      setSyncStatus("Inicia sesión para sincronizar.");
      return;
    }

    setIsSyncing(true);
    setSyncStatus("Sincronizando jardín...");
    try {
      const synced = await syncGardenIncrementally(
        lease.scope,
        { ownerId: lease.scope.userId!, planets, notes },
        lease.syncAccess(),
      );
      if (!lease.isActive()) return;
      const reconciled = applySyncTombstones(
        mergeSyncSnapshots(
          syncSnapshotRef.current || { planets, notes },
          synced,
        ),
        synced.tombstones,
      );
      syncSnapshotRef.current = reconciled;
      if (reconciled.planets.length > 0) setPlanets(reconciled.planets);
      setNotes(reconciled.notes);
      const currentQueue = loadSyncQueue(lease.scope);
      setPendingSyncCount(currentQueue.length);
      setSyncRetryAt(currentQueue[0]?.nextAttemptAt || 0);
      setSyncStatus(
        synced.conflicts > 0
          ? `${synced.conflicts} ${synced.conflicts === 1 ? "conflicto fue protegido" : "conflictos fueron protegidos"} durante la sincronización.`
          : currentQueue.length > 0
            ? `Sincronización actualizada · ${currentQueue.length} ${currentQueue.length === 1 ? "cambio pendiente" : "cambios pendientes"}.`
            : `Sincronizado: ${reconciled.planets.length} jardines y ${reconciled.notes.filter((note) => !isDailyEntryNote(note)).length} ideas.`,
      );
    } catch (error) {
      try {
        setPendingSyncCount(loadSyncQueue(lease.scope).length);
      } catch {
        /* Keep the sync error below. */
      }
      setSyncStatus(
        error instanceof Error
          ? error.message
          : "No se pudo sincronizar. Tus cambios siguen guardados localmente.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const enterApp = () => {
    setStoredItem("seed-landing-seen", "true");
    setStoredItem("seed-welcome-v2-seen", "true");
    setShowLanding(false);
    setLandingRoute("landing");
  };

  const openFocusMode = (id: string) => {
    setDailyFocusEntryId(null);
    setSelectedNoteId(null);
    setShowMobileMenu(false);
    setShowGardenFullscreen(false);
    setFocusNoteId(id);
    setView("focus");
  };

  const openTodayFocus = () => {
    if (
      !currentDailyEntry?.dailyEntry?.intention.trim() ||
      currentDailyEntry.dailyEntry.closedAt
    )
      return;
    setSelectedNoteId(null);
    setShowMobileMenu(false);
    setShowGardenFullscreen(false);
    setDailyFocusEntryId(currentDailyEntry.id);
    setFocusNoteId(null);
    setView("focus");
  };

  const runCardAction = (
    note: SeedNote,
    action: ReturnType<typeof getIdeaGuidance>["kind"],
  ) => {
    if (action === "grow") {
      growNote(note.id);
      return;
    }

    if (action === "water") {
      openWatering(note.id);
      return;
    }

    if (action === "focus") {
      openFocusMode(note.id);
      return;
    }

    if (action === "pause") {
      if (note.paused) restoreFromShed(note.id);
      else moveNoteToShed(note.id);
      return;
    }

    setSelectedNoteId(note.id);
  };

  const openCalendarToday = () => {
    setSelectedNoteId(null);
    setCurrentMonth(new Date());
    setView("calendar");
  };

  const navigateToView = (nextView: AppView) => {
    if (nextView === "calendar") {
      openCalendarToday();
      return;
    }
    setView(nextView);
  };

  const quickEntryIsMobile = useIsMobileViewport();
  // Use the visible viewport once: no extra keyboard inset on the sheet or footer.
  const quickEntryViewportStyle: CSSProperties | undefined =
    quickEntryViewport.height
      ? { top: quickEntryViewport.offsetTop, height: quickEntryViewport.height }
      : undefined;
  const closeCreateMenu = (withSound = true) => {
    if (withSound) playMicroSound("closePop", true);
    setShowCreateMenu(false);
  };
  const createDraftTodo = (text = "", completed = false): DraftTodo => ({
    id: crypto.randomUUID(),
    text,
    completed,
  });
  const focusProjectTodoInput = (id: string) => {
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-project-todo-id="${id}"]`,
      );
      const row = input?.closest<HTMLElement>("[data-project-todo-row]");
      const list = input?.closest<HTMLElement>("[data-project-todo-list]");
      input?.focus({ preventScroll: true });
      if (row && list) {
        const targetTop =
          row.offsetTop - list.clientHeight + row.offsetHeight + 12;
        list.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }
    });
  };
  const setProjectTodosAndContent = (nextTodos: DraftTodo[]) => {
    setProjectTodos(nextTodos);
    setNewNote((current) => ({
      ...current,
      content: nextTodos.map((todo) => todo.text).join("\n"),
    }));
  };
  const buildProjectTodosFromContent = () => {
    const lines = newNote.content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length > 0
      ? lines.map((line) => createDraftTodo(line))
      : [createDraftTodo()];
  };
  const updateProjectTodo = (id: string, text: string) => {
    setProjectTodosAndContent(
      projectTodos.map((todo) => (todo.id === id ? { ...todo, text } : todo)),
    );
  };
  const toggleProjectTodo = (id: string) => {
    setProjectTodos(
      projectTodos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  };
  const addProjectTodoAfter = (id?: string) => {
    const nextTodo = createDraftTodo();
    if (!id) {
      setProjectTodosAndContent([...projectTodos, nextTodo]);
      focusProjectTodoInput(nextTodo.id);
      return;
    }
    const index = projectTodos.findIndex((todo) => todo.id === id);
    const nextTodos = [...projectTodos];
    nextTodos.splice(index >= 0 ? index + 1 : nextTodos.length, 0, nextTodo);
    setProjectTodosAndContent(nextTodos);
    focusProjectTodoInput(nextTodo.id);
  };
  const removeProjectTodo = (id: string) => {
    const nextTodos = projectTodos.filter((todo) => todo.id !== id);
    setProjectTodosAndContent(
      nextTodos.length > 0 ? nextTodos : [createDraftTodo()],
    );
  };
  const handleProjectTodoDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = projectTodos.findIndex((todo) => todo.id === active.id);
    const newIndex = projectTodos.findIndex((todo) => todo.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setProjectTodosAndContent(arrayMove(projectTodos, oldIndex, newIndex));
  };
  const updateSproutPromptTodo = (id: string, text: string) => {
    setSproutPromptTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, text } : todo)),
    );
  };
  const toggleSproutPromptTodo = (id: string) => {
    setSproutPromptTodos((current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  };
  const addSproutPromptTodoAfter = (id?: string) => {
    const nextTodo = createDraftTodo();
    setSproutPromptTodos((current) => {
      if (!id) return [...current, nextTodo];
      const index = current.findIndex((todo) => todo.id === id);
      const nextTodos = [...current];
      nextTodos.splice(index >= 0 ? index + 1 : nextTodos.length, 0, nextTodo);
      return nextTodos;
    });
    focusProjectTodoInput(nextTodo.id);
  };
  const removeSproutPromptTodo = (id: string) => {
    setSproutPromptTodos((current) => {
      const nextTodos = current.filter((todo) => todo.id !== id);
      return nextTodos.length > 0 ? nextTodos : [createDraftTodo()];
    });
  };
  const handleSproutPromptTodoDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setSproutPromptTodos((current) => {
      const oldIndex = current.findIndex((todo) => todo.id === active.id);
      const newIndex = current.findIndex((todo) => todo.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  };
  const openCreateOption = (
    option: "seed" | "sprout" | "journal" | "garden",
  ) => {
    setShowCreateMenu(false);
    if (option === "garden") {
      setShowMobileMenu(true);
      setShowGardenSwitcher(true);
      setShowPlanetSettings(false);
      setIsAddingPlanet(true);
      return;
    }

    setSelectedNoteId(null);
    setFilterStage("all");
    setSearch("");
    setCreateMode(option);
    setShowQuickEntryDetails(false);
    setShowDiscardConfirmation(false);
    setShowProjectTodos(option === "sprout");
    setProjectTodos(option === "sprout" ? [createDraftTodo()] : []);
    setNewNote({
      title: "",
      content: "",
      dueDate: "",
      seedType:
        option === "sprout"
          ? "project"
          : option === "journal"
            ? "learning"
            : "idea",
      priority: "normal",
      planetId: activePlanetId,
    });
    setQuickEntryViewport({
      height: null,
      keyboardInset: 0,
      offsetTop: 0,
      keyboardOpen: false,
    });
    setIsAdding(true);
  };
  const quickActionsNote = quickActionsNoteId
    ? notes.find((note) => note.id === quickActionsNoteId)
    : null;
  const runQuickAction = (
    action:
      | "water"
      | "sprout"
      | "focus"
      | "pause"
      | "harvest"
      | "delete"
      | "later",
  ) => {
    if (!quickActionsNote) return;
    const noteId = quickActionsNote.id;
    setQuickActionsNoteId(null);

    if (action === "water") {
      openWatering(noteId);
      return;
    }
    if (action === "sprout") {
      openSproutPrompt(noteId);
      return;
    }
    if (action === "focus") {
      openFocusMode(noteId);
      return;
    }
    if (action === "pause") {
      if (quickActionsNote.paused) restoreFromShed(noteId);
      else moveNoteToShed(noteId);
      return;
    }
    if (action === "harvest") {
      completeQuickSeed(noteId);
      return;
    }
    if (action === "later") {
      saveInboxForLater(noteId);
      return;
    }
    deleteNote(noteId);
  };

  const toggleTodayWidget = (widgetId: TodayWidgetId, enabled: boolean) => {
    setTodayWidgets((current) => {
      if (enabled) {
        return current.includes(widgetId) ? current : [...current, widgetId];
      }
      return current.filter((id) => id !== widgetId);
    });
  };

  const closeSettings = () => {
    setShowSettings(false);
    window.setTimeout(() => setSettingsPage("root"), 180);
  };

  const settingsTitles: Record<SettingsPage, string> = {
    root: t("settings"),
    profile: t("profile"),
    appearance: "Apariencia",
    today: appLanguage === "en" ? "Arrange my walk" : "Organizar mi paseo",
    watering: "Riego",
    data: "Cuenta y datos",
  };

  const settingsRows: Array<{
    page: Exclude<SettingsPage, "root">;
    icon: LucideIcon;
    title: string;
    detail: string;
    value?: string;
  }> = [
    {
      page: "profile",
      icon: User,
      title: t("profile"),
      detail: account.name || "Nombre, rol e intención",
      value: account.role || undefined,
    },
    {
      page: "appearance",
      icon: Sparkles,
      title: "Apariencia y sensación",
      detail: "Tema, haptics y sonidos",
      value: THEMES.find((item) => item.id === (activePlanet.theme || theme))
        ?.label,
    },
    {
      page: "today",
      icon: LayoutGrid,
      title:
        appLanguage === "en"
          ? "Personalize dashboard"
          : "Personalizar dashboard",
      detail: "Módulos visibles en la pantalla principal",
      value: `${todayWidgets.length} ${appLanguage === "en" ? "of" : "de"} ${DASHBOARD_MODULES.length}`,
    },
    {
      page: "watering",
      icon: Droplets,
      title: "Riego y recordatorios",
      detail: `Cada ${defaultWateringInterval} días · ${String(reminderHour).padStart(2, "0")}:00`,
      value: notificationsEnabled ? "Activo" : "Suave",
    },
    {
      page: "data",
      icon: Cloud,
      title: "Cuenta y datos",
      detail: session?.user
        ? session.user.email || "Cuenta conectada"
        : "Sync, backups y datos locales",
      value: session?.user ? "Sync" : "Local",
    },
  ];

  const renderSettingsNavRow = (item: (typeof settingsRows)[number]) => (
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
        <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium text-[var(--text-muted)]">
          {item.detail}
        </span>
      </span>
      {item.value && (
        <span className="max-w-[7rem] truncate text-xs font-semibold text-[var(--text-muted)]">
          {item.value}
        </span>
      )}
      <ChevronRight
        size={17}
        className="shrink-0 text-[var(--text-muted)]/65"
      />
    </button>
  );

  const renderSettingsSection = (title: string, children: ReactNode) => (
    <section className="space-y-2">
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {title}
      </p>
      <div className="overflow-hidden rounded-[1.45rem] bg-[var(--surface-strong)] shadow-sm ring-1 ring-[var(--border)]">
        {children}
      </div>
    </section>
  );

  const quickEntryCopy =
    createMode === "sprout"
      ? {
          title: appLanguage === "en" ? "New sprout" : "Nuevo brote",
          subtitle:
            appLanguage === "en"
              ? "Name it. Add only the next steps."
              : "Nómbralo. Agrega solo los siguientes pasos.",
          placeholder:
            appLanguage === "en"
              ? "Add a first step..."
              : "Agrega un primer paso...",
          action: appLanguage === "en" ? "Create" : "Crear",
          compactLabel:
            appLanguage === "en"
              ? "Project · Checklist"
              : "Proyecto · Checklist",
          details: appLanguage === "en" ? "Options" : "Opciones",
          titlePlaceholder:
            appLanguage === "en" ? "Sprout name" : "Nombre del brote",
        }
      : createMode === "journal"
        ? {
            title: gardenName("learning", appLanguage, true),
            subtitle:
              appLanguage === "en"
                ? "Keep what you learned."
                : "Guarda lo que aprendiste.",
            placeholder:
              appLanguage === "en"
                ? "Write the thought you want to keep..."
                : "Escribe la idea que quieres conservar...",
            action: appLanguage === "en" ? "Save" : "Guardar",
            compactLabel:
              appLanguage === "en"
                ? "Reflection · Learning"
                : "Reflexión · Aprendizaje",
            details: appLanguage === "en" ? "Options" : "Opciones",
            titlePlaceholder:
              appLanguage === "en"
                ? "Reflection title"
                : "Título de la reflexión",
          }
        : {
            title: appLanguage === "en" ? "New seed" : "Nueva semilla",
            subtitle:
              appLanguage === "en"
                ? "Capture now. Decide later."
                : "Captura ahora. Decide después.",
            placeholder:
              appLanguage === "en"
                ? "Write the idea as it arrives..."
                : "Escribe la idea tal como llega...",
            action: t("plant"),
            compactLabel: `${appLanguage === "en" ? "Seedbed" : "Semillero"} · ${SEED_TYPES.find((type) => type.id === newNote.seedType)?.label || gardenTypeName("idea", appLanguage)}`,
            details: appLanguage === "en" ? "Options" : "Opciones",
            titlePlaceholder:
              appLanguage === "en" ? "New seed" : "Nueva semilla",
          };
  const quickEntryPlanet =
    planets.find((planet) => planet.id === newNote.planetId) || activePlanet;
  const closeQuickEntry = () => {
    setShowDiscardConfirmation(false);
    blurQuickEntryFocus();
    setShowQuickEntryDetails(false);
    setShowProjectTodos(false);
    setProjectTodos([]);
    setQuickEntryViewport({
      height: null,
      keyboardInset: 0,
      offsetTop: 0,
      keyboardOpen: false,
    });
    setIsAdding(false);
  };

  const canSaveQuickEntry = Boolean(
    newNote.title.trim() ||
    composerContent(
      newNote.content,
      createMode === "sprout" && showProjectTodos ? projectTodos : undefined,
    ),
  );
  const requestCloseQuickEntry = () => {
    if (canSaveQuickEntry) {
      blurQuickEntryFocus();
      setShowDiscardConfirmation(true);
    } else closeQuickEntry();
  };
  const switchQuickEntryMode = (mode: CreateMode) => {
    if (mode === createMode) return;
    const content =
      createMode === "sprout" && showProjectTodos
        ? projectTodos
            .map((todo) => todo.text)
            .filter((text) => text.trim())
            .join("\n")
        : newNote.content;
    setNewNote((current) => ({
      ...current,
      content,
      seedType:
        mode === "sprout"
          ? "project"
          : mode === "journal"
            ? "learning"
            : "idea",
    }));
    if (mode === "sprout")
      setProjectTodos(
        content.trim()
          ? content
              .split("\n")
              .filter((line) => line.trim())
              .map((line) => createDraftTodo(line))
          : [createDraftTodo()],
      );
    setShowProjectTodos(mode === "sprout");
    setCreateMode(mode);
  };

  useLayoutEffect(() => {
    if (!isAdding) return;
    const root = document.getElementById("root");
    const previousInert = root?.inert;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    quickEntryOverlayRef.current
      ?.querySelector<HTMLElement>('[data-quick-entry-autofocus="true"]')
      ?.focus({ preventScroll: true });
    return () => {
      if (root) root.inert = previousInert || false;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLElement>(".note-create-primary")
          ?.focus({ preventScroll: true });
    };
  }, [isAdding]);

  useEffect(() => {
    if (!isAdding) return;
    if (showDiscardConfirmation)
      quickEntryOverlayRef.current
        ?.querySelector<HTMLElement>(".note-composer-discard button")
        ?.focus({ preventScroll: true });
    else
      quickEntryOverlayRef.current
        ?.querySelector<HTMLElement>('[data-quick-entry-autofocus="true"]')
        ?.focus({ preventScroll: true });
  }, [isAdding, showDiscardConfirmation]);

  if (storageError || !notesLoaded || recoveringLegacy) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f5f7f1] p-6 text-center text-[#263324]">
        <section role="status" className="max-w-sm space-y-4">
          <h1 className="text-xl font-semibold">
            {storageError
              ? "Tu jardín necesita atención"
              : recoveringLegacy
                ? "Recuperando datos anteriores…"
                : "Abriendo tu jardín…"}
          </h1>
          <p>{storageError || "Cargando solo los datos de este espacio."}</p>
          {storageError && (
            <>
              <button
                onClick={async () => {
                  if (!notesLoaded) {
                    window.location.reload();
                    return;
                  }
                  try {
                    await saveNotesToDb(lease.scope, notes);
                    if (lease.isActive()) setStorageError("");
                  } catch {
                    /* Keep the in-memory garden and recovery UI. */
                  }
                }}
                className="rounded-full bg-[#263324] px-6 py-3 text-white"
              >
                Reintentar
              </button>
              {notesLoaded && (
                <button
                  onClick={exportBackup}
                  className="block w-full underline"
                >
                  Exportar una copia antes de salir
                </button>
              )}
            </>
          )}
        </section>
      </main>
    );
  }

  if (showLanding) {
    return (
      <LandingPage
        route={landingRoute}
        onEnter={enterApp}
        onShowLanding={() => {
          setAuthStatus("");
          setLandingRoute("landing");
        }}
        onShowLogin={() => {
          setAuthStatus("");
          setAuthPassword("");
          setAuthConfirmPassword("");
          setLandingRoute("login");
        }}
        onShowRegister={() => {
          setAuthStatus("");
          setAuthPassword("");
          setAuthConfirmPassword("");
          setLandingRoute("register");
        }}
        onShowForgot={() => {
          setAuthStatus("");
          setAuthPassword("");
          setAuthConfirmPassword("");
          setLandingRoute("forgot");
        }}
        authConfigured={isSupabaseConfigured}
        canUpdatePassword={
          Boolean(session?.user) &&
          authFlow.passwordRecovery &&
          !authFlow.callbackError
        }
        accountName={authName}
        setAccountName={setAuthName}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authConfirmPassword={authConfirmPassword}
        setAuthConfirmPassword={setAuthConfirmPassword}
        authDisabledReason={authDisabledReason}
        authStatus={authStatus}
        onSignIn={signInWithEmail}
        onSignUp={signUpWithEmail}
        onRequestPasswordReset={requestPasswordReset}
        onUpdatePassword={updatePassword}
      />
    );
  }

  return (
    <div className="safe-app-shell app-shell flex h-screen flex-col overflow-hidden bg-transparent font-sans text-[var(--text-main)] md:flex-row">
      <MobileAppHeader
        hidden={view === "focus" || showGardenFullscreen || isAdding}
        gardenName={activePlanet.name}
        ideaCount={planetNotes.length}
        onOpenMenu={() => setShowMobileMenu(true)}
        onGoHome={() => {
          setSelectedNoteId(null);
          setShowCreateMenu(false);
          setView("today");
        }}
        onOpenSettings={() => setShowSettings(true)}
      />
      {view !== "focus" && (
        <>
          <AnimatePresence>
            {showMobileMenu && (
              <motion.button
                type="button"
                aria-label="Cerrar menú"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMobileMenu(false)}
                className="mobile-modal-overlay fixed inset-0 z-40 bg-black/20 md:hidden md:backdrop-blur-md"
              />
            )}
          </AnimatePresence>
          {/* Sidebar Navigation */}
          <aside
        ref={mobileMenuRef}
        className={`app-sidebar mobile-modal-sheet fixed left-3 right-3 top-[calc(var(--safe-top-control)+3.25rem)] z-50 flex max-h-[calc(100vh-var(--safe-top-control)-env(safe-area-inset-bottom)-8.25rem)] shrink-0 origin-top flex-col overflow-y-auto rounded-[2rem] border border-white/60 bg-[var(--sidebar-bg)]/94 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] transition-all duration-300 app-scrollbar md:static md:z-20 md:h-screen md:max-h-none md:w-72 md:max-w-none md:origin-center md:translate-y-0 md:scale-100 md:rounded-none md:border-r md:border-[var(--border)] md:bg-[var(--sidebar-bg)] md:p-6 md:opacity-100 md:shadow-none md:backdrop-blur-2xl ${showMobileMenu ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-3 scale-[0.97] opacity-0 md:pointer-events-auto"}`}
      >
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
            <h1 className="text-xl font-semibold tracking-tight text-[var(--earth)] leading-none">
              Seeds
            </h1>
            <p className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
              Ideas y proyectos
            </p>
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
          <p className="px-4 text-[10px] uppercase font-black tracking-[0.25em] text-[var(--seed-accent)] opacity-50">
            {gardenName("garden", appLanguage)}
          </p>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGardenSwitcher((value) => !value)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-left shadow-sm soft-interaction hover:border-[var(--sage)]/25"
              aria-expanded={showGardenSwitcher}
              aria-label="Cambiar jardín"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1.2rem] bg-[var(--bg-app)] font-serif text-lg font-black text-[var(--sage)] ring-1 ring-[var(--border)]">
                {activePlanet.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold tracking-tight text-[var(--earth)]">
                  {activePlanet.name}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-[var(--text-muted)]">
                  {planetNoteCounts.get(activePlanet.id) || 0}{" "}
                  {appLanguage === "en" ? "items" : "elementos"}
                </span>
              </span>
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--sage)] transition-transform ${showGardenSwitcher ? "rotate-180" : ""}`}
              >
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
                              ? "bg-[var(--bg-app)] text-[var(--sage)]"
                              : "text-[var(--earth)] hover:bg-[var(--surface-soft)]"
                          }`}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] font-serif text-sm font-black">
                            {planet.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black">
                              {planet.name}
                            </span>
                            <span className="block text-[10px] font-bold text-[var(--text-muted)]">
                              {count}{" "}
                              {appLanguage === "en" ? "items" : "elementos"}
                            </span>
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
                        setIsAddingPlanet((value) => !value);
                        setShowPlanetSettings(false);
                      }}
                      className={`flex h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left text-xs font-black transition-all ${
                        isAddingPlanet
                          ? "bg-[var(--sage)] text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20"
                          : "bg-[var(--sage)]/10 text-[var(--sage)] hover:bg-[var(--sage)]/15"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl ${isAddingPlanet ? "bg-white/20" : "bg-[var(--surface-strong)]"}`}
                        >
                          <Plus size={15} />
                        </span>
                        <span>Crear jardín</span>
                      </span>
                      <ChevronRight
                        size={15}
                        className={
                          isAddingPlanet
                            ? "rotate-90 transition-transform"
                            : "transition-transform"
                        }
                      />
                    </button>
                    <button
                      type="button"
                      onClick={openPlanetSettings}
                      className={`flex h-10 w-full items-center justify-between gap-3 rounded-2xl border px-3 text-left text-xs font-black transition-all ${
                        showPlanetSettings
                          ? "border-[var(--sage)]/30 bg-[var(--surface-soft)] text-[var(--sage)] shadow-sm"
                          : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)] hover:text-[var(--sage)]"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)]">
                          <Settings size={14} />
                        </span>
                        <span>Administrar jardín actual</span>
                      </span>
                      <ChevronRight
                        size={14}
                        className={
                          showPlanetSettings
                            ? "rotate-90 transition-transform"
                            : "transition-transform"
                        }
                      />
                    </button>
                  </div>

                  {isAddingPlanet && (
                    <div className="mt-2 rounded-[1.35rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--bg-app),var(--surface-soft))] p-3 shadow-inner shadow-white/40">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[var(--surface-strong)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                          <Plus size={15} />
                        </span>
                        <div>
                          <p className="text-xs font-black text-[var(--earth)]">
                            Nuevo jardín
                          </p>
                          <p className="text-[10px] font-semibold text-[var(--text-muted)]">
                            Crea un espacio para un tema.
                          </p>
                        </div>
                      </div>
                      <label className="flex h-12 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 shadow-sm focus-within:border-[var(--border)]">
                        <Sprout
                          size={15}
                          className="shrink-0 text-[var(--sage)]"
                        />
                        <input
                          value={newPlanetName}
                          onChange={(event) =>
                            setNewPlanetName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") addPlanet();
                            if (event.key === "Escape")
                              setIsAddingPlanet(false);
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
                          <p className="text-xs font-black text-[var(--earth)]">
                            Jardín actual
                          </p>
                          <p className="text-[10px] font-semibold text-[var(--text-muted)]">
                            Renombra o elimina este jardín.
                          </p>
                        </div>
                      </div>
                      <label className="flex h-12 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 shadow-sm focus-within:border-[var(--border)]">
                        <Leaf
                          size={15}
                          className="shrink-0 text-[var(--sage)]"
                        />
                        <input
                          value={editingPlanetName}
                          onChange={(event) =>
                            setEditingPlanetName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") renameActivePlanet();
                            if (event.key === "Escape")
                              setShowPlanetSettings(false);
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
            {
              id: "today",
              label: navigationLabel("today", appLanguage),
              detail:
                appLanguage === "en"
                  ? "Dashboard · today’s priority"
                  : "Dashboard · tu prioridad de hoy",
              icon: Droplets,
            },
            {
              id: "inbox",
              label: navigationLabel("inbox", appLanguage),
              detail:
                appLanguage === "en"
                  ? "Inbox · captures to organize"
                  : "Bandeja de entrada · capturas",
              icon: Sprout,
            },
            {
              id: "projects",
              label: navigationLabel("projects", appLanguage),
              detail:
                appLanguage === "en"
                  ? "Projects · your next task"
                  : "Proyectos · tu siguiente labor",
              icon: Target,
            },
            {
              id: "board",
              label: navigationLabel("board", appLanguage),
              detail:
                appLanguage === "en"
                  ? "Board · connect ideas"
                  : "Pizarra · conecta ideas",
              icon: LayoutGrid,
            },
            {
              id: "shed",
              label: navigationLabel("shed", appLanguage),
              detail:
                appLanguage === "en"
                  ? "For later · resting"
                  : "Para después · en reposo",
              icon: Archive,
            },
            {
              id: "garden",
              label: navigationLabel("garden", appLanguage),
              detail:
                appLanguage === "en"
                  ? "Visualize your progress"
                  : "Visualiza tus avances",
              icon: LayoutGrid,
            },
            {
              id: "3D",
              label: navigationLabel("3D", appLanguage),
              detail:
                appLanguage === "en"
                  ? "3D planet view"
                  : "Vista del planeta en 3D",
              icon: Box,
            },
            {
              id: "calendar",
              label: navigationLabel("calendar", appLanguage),
              detail:
                appLanguage === "en"
                  ? "Dates and activity"
                  : "Fechas e historial",
              icon: CalendarIcon,
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedNoteId(null);
                if (item.id === "projects") {
                  setSearch("");
                  setFilterStage("all");
                }
                navigateToView(item.id as AppView);
                setShowMobileMenu(false);
              }}
              className={`relative flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left soft-interaction group ${
                view === item.id
                  ? "bg-[var(--surface-strong)] text-[var(--sage)] shadow-sm ring-1 ring-[var(--border)]"
                  : "text-[var(--earth)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              {view === item.id && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute left-1.5 h-6 w-1 rounded-full bg-[var(--sage)]"
                />
              )}
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${view === item.id ? "bg-[var(--bg-app)] text-[var(--sage)]" : "bg-transparent text-[var(--earth)]/65 group-hover:bg-[var(--surface-strong)] group-hover:text-[var(--sage)]"}`}
              >
                <item.icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug tracking-tight break-words">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--text-muted)]">
                  {item.detail}
                </span>
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
            {gardenName("plant", appLanguage)}
          </button>
          <div className="flex items-center gap-1 border-t border-[var(--border)] px-1 py-3">
            <button
              type="button"
              onClick={() => {
                setSelectedNoteId(null);
                navigateToView("profile");
                setShowMobileMenu(false);
              }}
              className={`group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors ${
                view === "profile"
                  ? "bg-[var(--surface-strong)] ring-1 ring-[var(--border)]"
                  : "hover:bg-[var(--surface-soft)]"
              }`}
              aria-label={
                appLanguage === "en" ? "Open profile" : "Abrir perfil"
              }
            >
              <AccountAvatar
                photo={account.photo}
                initials={accountInitials}
                className="h-10 w-10 shrink-0 rounded-full ring-2 ring-[var(--surface-strong)]"
                textClassName="text-sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-[var(--earth)]">
                  {account.name || "Jardinero Digital"}
                </span>
                <span className="block truncate text-[10px] font-medium text-[var(--text-muted)]">
                  {account.email || "Sin correo"}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSettings(true);
                setShowMobileMenu(false);
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--sage)]"
              title="Ajustes"
              aria-label="Abrir ajustes"
            >
              <Settings size={18} />
            </button>
            <button
              type="button"
              onClick={exportGarden}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--sage)]"
              title="Exportar jardín"
              aria-label="Exportar jardín"
            >
              <Download size={18} />
            </button>
          </div>
        </div>
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <main
        className={`app-main flex flex-1 flex-col overflow-hidden md:flex-row ${
          view === "focus"
            ? "fixed inset-0 z-[60] h-dvh w-screen bg-[radial-gradient(circle_at_50%_8%,color-mix(in_srgb,var(--sage)_12%,transparent),transparent_48%),var(--bg-app)] backdrop-blur-3xl"
            : "relative"
        }`}
      >
        <section
          className={`app-content ${selectedNoteId ? "app-content-has-detail" : ""} flex-1 overflow-y-auto app-scrollbar bg-transparent transition-all duration-300 ${view === "focus" ? "h-dvh w-full px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6" : view === "calendar" ? "px-3 pb-3 pt-[var(--safe-top-space)] sm:px-5 sm:pb-5 md:p-6" : "px-4 pb-[var(--safe-bottom-space)] pt-[var(--safe-top-space)] sm:px-6 md:p-10"} ${selectedNoteId ? "md:mr-[400px]" : ""}`}
        >
          <div
            className={`app-content-inner ${view === "focus" ? "relative mx-auto flex min-h-full w-full max-w-[108rem] items-center justify-center" : view === "calendar" ? "mx-auto max-w-[100rem]" : "mx-auto max-w-4xl"}`}
          >
            <header
              className={`app-page-header mb-6 flex-col md:mb-10 md:flex-row justify-between items-start gap-4 md:gap-6 ${view === "today" || view === "board" || view === "focus" ? "hidden" : "flex"}`}
            >
              <div className="w-full">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-semibold text-[var(--earth)] leading-none">
                        {activePlanet.name}
                      </h2>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-1.5 shadow-sm">
                        <TrendingUp size={14} className="text-[var(--sage)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)]">
                          {planetNotes.length} ideas
                        </span>
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs italic text-[var(--text-muted)]">
                      {activePlanet.description ||
                        "Cada nota es el comienzo de algo grande."}
                    </p>
                  </div>
                </motion.div>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3">
                  {[
                    {
                      id: "inbox",
                      label: t("seeds"),
                      value: gardenStats.seeds,
                      tone: "bg-[var(--tone-seed-bg)] text-[var(--tone-seed)]",
                    },
                    {
                      id: "projects",
                      label: t("sprouts"),
                      value: gardenStats.active,
                      tone: "bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)]",
                    },
                    {
                      id: "harvest",
                      label: appLanguage === "en" ? "Harvests" : "Cosechas",
                      value: gardenStats.completed,
                      tone: "bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)]",
                    },
                    {
                      id: "shed",
                      label: "El cobertizo",
                      value: gardenStats.shed,
                      tone: "bg-[var(--bg-app)] text-[var(--sage)]",
                    },
                  ].map((stat) => {
                    const isActiveStat = view === stat.id;
                    return (
                      <motion.button
                        key={stat.label}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          setFilterStage("all");
                          setSelectedNoteId(null);
                          navigateToView(
                            isActiveStat ? "today" : (stat.id as AppView),
                          );
                        }}
                        className={`rounded-2xl border px-3 py-3 shadow-sm text-left soft-interaction sm:px-4 ${isActiveStat ? "bg-[var(--surface-strong)] border-[var(--sage)] ring-1 ring-[var(--sage)]/30" : "bg-[var(--surface-soft)] border-[var(--border)] hover:bg-[var(--surface-strong)]"}`}
                      >
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                          {stat.label}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xl font-serif font-black text-[var(--earth)] sm:text-2xl">
                            {stat.value}
                          </span>
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full sm:h-7 sm:w-7 ${stat.tone}`}
                          >
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
                    <Pause
                      size={18}
                      className="mt-0.5 shrink-0 text-[var(--tone-warning)]"
                    />
                    <p className="text-sm text-[var(--tone-warning)]">
                      Tienes {growingNotes.length} brotes activos. Para avanzar
                      mejor, guarda algunos en Cobertizo o usa Enfoque.
                    </p>
                  </motion.div>
                )}
              </div>
              <div className="relative w-full md:w-64 md:mt-[6.45rem]">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  size={16}
                />
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
              {view === "today" ? (
                <motion.div
                  key="today-screen"
                  initial={false}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <TodayView
                    accountName={account.name}
                    notes={planetEntries}
                    quickNote={quickNote}
                    setQuickNote={setQuickNote}
                    onQuickCapture={addQuickNote}
                    onUndoCapture={undoQuickCapture}
                    onOpenWatering={openWatering}
                    onSkipWatering={skipWateringToday}
                    onSelectNote={setSelectedNoteId}
                    onToggleTask={toggleTask}
                    onFocusNote={openFocusMode}
                    onStartPlanting={startPlanting}
                    onCloseDay={closeDayWithReflection}
                    onSaveDailyFocus={saveDailyFocus}
                    onStartDailyFocus={openTodayFocus}
                    onToggleDailyFocus={toggleTodayFocus}
                    onContinuePrevious={continuePreviousDailyEntry}
                    onDismissPrevious={dismissPreviousDailyEntry}
                    onNavigate={navigateToView}
                    onShowWateringQueue={showWateringQueue}
                    onCustomize={() => {
                      setSettingsPage("today");
                      setShowSettings(true);
                    }}
                    onDevelopNote={cultivateInboxNote}
                    onSaveLater={saveInboxForLater}
                    onUpdateNote={updateNote}
                    onReuseHarvest={reuseHarvestLearning}
                    onSaveJournal={saveGardenerJournal}
                    boardRaw={boardRaw}
                    reviewSnoozes={reviewSnoozes}
                    onSnoozeReview={snoozeDashboardReview}
                    featuredProjectId={featuredProjectId}
                    onFeatureProject={setFeaturedProjectId}
                    todayWidgets={todayWidgets}
                    dashboardOrder={dashboardOrder}
                    wateredToday={wateredToday}
                    wateringStreak={wateringRitual.streak}
                    getProgress={getProgress}
                    dailyIntention={dailyIntention}
                    dailyIntentionNoteId={dailyIntentionNoteId}
                    currentDailyEntry={currentDailyEntry}
                    previousDailyEntry={previousDailyEntry}
                  />
                </motion.div>
              ) : view === "board" ? (
                <motion.div
                  key={`board-screen:${activePlanet.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <GardenBoard
                    key={`board:${activePlanet.id}`}
                    raw={boardRaw}
                    notes={planetNotes}
                    language={appLanguage === "en" ? "en" : "es"}
                    onSave={saveGardenBoard}
                    onOpenNote={setSelectedNoteId}
                    onExit={() => navigateToView("today")}
                  />
                </motion.div>
              ) : view === "inbox" ? (
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
                  onStartPlanting={() => openCreateOption("seed")}
                />
              ) : view === "projects" ? (
                <ProjectsView
                  notes={planetNotes}
                  onSelectNote={setSelectedNoteId}
                  onFocusNote={openFocusMode}
                  onToggleTask={toggleTask}
                  onOpenWatering={openWatering}
                  onTogglePause={moveNoteToShed}
                  onShowActions={setQuickActionsNoteId}
                  onStartSprout={() => openCreateOption("sprout")}
                  getProgress={getProgress}
                />
              ) : view === "shed" ? (
                <ShedView
                  notes={planetNotes}
                  onSelectNote={setSelectedNoteId}
                  onRestore={restoreFromShed}
                  onSprout={openSproutPrompt}
                  onDelete={deleteNote}
                />
              ) : view === "focus" ? (
                dailyFocusEntryId ? (
                  <DailyFocusSession
                    key={dailyFocusEntryId}
                    entry={planetEntries.find(
                      (note) => note.id === dailyFocusEntryId,
                    )}
                    notes={planetNotes}
                    language={appLanguage === "en" ? "en" : "es"}
                    onToggleComplete={() => {
                      if (lease.isActive())
                        setNotes((current) =>
                          toggleDailyFocusCompletion(
                            current,
                            dailyFocusEntryId,
                          ),
                        );
                    }}
                    onToggleProjectTask={toggleTask}
                    onLogMinutes={(minutes) => {
                      if (lease.isActive())
                        setNotes((current) =>
                          logDailyFocusSession(
                            current,
                            dailyFocusEntryId,
                            minutes,
                          ),
                        );
                    }}
                    onUpdateProjectMemo={updateFocusMemo}
                    onQuickCapture={(value) => captureQuickSeed(value, true)}
                    onExit={() => setView("today")}
                  />
                ) : (
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
                    onUpdateFocusMemo={updateFocusMemo}
                    onQuickCapture={(value) => captureQuickSeed(value, true)}
                    onFocusFeedback={feel}
                    onExit={() => setView("today")}
                  />
                )
              ) : view === "profile" ? (
                <motion.div
                  key="profile-view"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="space-y-5 pb-2 md:pb-8"
                >
                  <section className="overflow-hidden rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm">
                    <div className="flex items-center gap-4 px-5 py-5">
                      <AccountAvatar
                        photo={account.photo}
                        initials={accountInitials}
                        className="h-16 w-16 rounded-[1.35rem] ring-1 ring-[var(--border)]"
                        textClassName="text-2xl"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-2xl font-semibold tracking-tight text-[var(--earth)]">
                          {account.name || "Jardinero Digital"}
                        </h3>
                        <p className="mt-1 truncate text-sm font-medium text-[var(--text-muted)]">
                          {account.purpose ||
                            "Un jardín para ideas y proyectos"}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-muted)]">
                          {session?.user?.email ||
                            account.email ||
                            "Modo local"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 border-t border-[var(--border)]">
                      {[
                        { label: t("seeds"), value: profileStats.seeds },
                        { label: t("sprouts"), value: profileStats.active },
                        {
                          label: appLanguage === "en" ? "Harvests" : "Cosechas",
                          value: profileStats.harvests,
                        },
                        { label: "Racha", value: wateringRitual.streak },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="border-r border-[var(--border)] px-2 py-3 text-center last:border-r-0"
                        >
                          <p className="text-lg font-semibold text-[var(--earth)]">
                            {item.value}
                          </p>
                          <p className="mt-0.5 truncate text-[9px] font-medium text-[var(--text-muted)]">
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm">
                    {[
                      {
                        icon: Settings,
                        title: t("settings"),
                        detail:
                          appLanguage === "en"
                            ? "Account, theme, watering and reminders"
                            : "Cuenta, tema, riego y recordatorios",
                        onClick: () => setShowSettings(true),
                      },
                      {
                        icon: CalendarIcon,
                        title: t("path"),
                        detail:
                          appLanguage === "en"
                            ? "Review activity by day"
                            : "Revisa actividad por día",
                        onClick: openCalendarToday,
                      },
                      {
                        icon: Box,
                        title: t("planet"),
                        detail:
                          appLanguage === "en"
                            ? "Open the 3D garden when you need it"
                            : "Abre el jardín 3D cuando lo necesites",
                        onClick: () => setView("3D"),
                      },
                      {
                        icon: Archive,
                        title: "El cobertizo",
                        detail: `${gardenStats.shed} idea${gardenStats.shed === 1 ? "" : "s"} guardada${gardenStats.shed === 1 ? "" : "s"} para después`,
                        onClick: () => setView("shed"),
                      },
                      {
                        icon: Archive,
                        title: "Lo aprendido",
                        detail: `${profileStats.harvests} cierre${profileStats.harvests === 1 ? "" : "s"} de idea${profileStats.harvests === 1 ? "" : "s"}`,
                        onClick: () => setView("harvest"),
                      },
                    ].map((item, index) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={item.onClick}
                        className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] ${index > 0 ? "border-t border-[var(--border)]" : ""}`}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--sage)]">
                          <item.icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-[var(--earth)]">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block truncate text-sm font-medium text-[var(--text-muted)]">
                            {item.detail}
                          </span>
                        </span>
                        <ChevronRight
                          size={16}
                          className="text-[var(--text-muted)]"
                        />
                      </button>
                    ))}
                  </section>

                  <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {profileStats.season}
                    </p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--earth)]">
                      {account.mantra?.trim() ||
                        "Estoy cultivando ideas que merecen volver a existir fuera de mi cabeza."}
                    </p>
                  </section>
                </motion.div>
              ) : view === "harvest" ? (
                <HarvestView
                  notes={planetNotes}
                  onSelectNote={setSelectedNoteId}
                  onStartPlanting={() => openCreateOption("seed")}
                />
              ) : view === "garden" ? (
                <motion.div
                  key={`${view}-view`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: "spring", stiffness: 280, damping: 28 }}
                >
                  <section className="mb-5 overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm">
                    <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-3xl font-semibold tracking-tight text-[var(--earth)]">
                          {t("garden")}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                          {gardenStats.total} ideas plantadas en{" "}
                          {activePlanet.name}
                        </p>
                      </div>
                      <button
                        onClick={() => setView("3D")}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                      >
                        <Box size={15} /> {t("planet")}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 border-t border-[var(--border)]">
                      {[
                        { label: "Flores", value: gardenStats.flowers },
                        { label: t("sprouts"), value: gardenStats.active },
                        { label: "Árboles", value: gardenStats.trees },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="border-r border-[var(--border)] px-3 py-3 text-center last:border-r-0"
                        >
                          <p className="text-xl font-semibold text-[var(--earth)]">
                            {item.value}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="mb-5 flex gap-2 overflow-x-auto pb-2 app-scrollbar">
                    {[
                      {
                        id: "all",
                        label: "Todo el jardín",
                        count: gardenStats.total,
                      },
                      {
                        id: "water",
                        label: "Necesita atención",
                        count: gardenStats.watering,
                      },
                      {
                        id: "shed",
                        label: "El cobertizo",
                        count: gardenStats.shed,
                      },
                      {
                        id: "seed",
                        label: gardenStageName("seed", appLanguage),
                        count: gardenStats.plantedSeeds,
                      },
                      {
                        id: "sprout",
                        label: gardenStageName("sprout", appLanguage),
                        count: gardenStats.visualSprouts,
                      },
                      {
                        id: "bloom",
                        label: appLanguage === "en" ? "Harvests" : "Cosechas",
                        count: gardenStats.completed,
                      },
                    ].map((item) => {
                      const isActive =
                        item.id === "all"
                          ? !search.trim() && filterStage === "all"
                          : item.id === "water"
                            ? search.trim().toLowerCase() === "riego"
                            : item.id === "shed"
                              ? search.trim().toLowerCase() === "cobertizo"
                              : filterStage === item.id &&
                                search.trim().toLowerCase() !== "riego";

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedNoteId(null);
                            if (item.id === "all") {
                              setSearch("");
                              setFilterStage("all");
                            } else if (item.id === "water") {
                              setSearch("riego");
                              setFilterStage("all");
                            } else if (item.id === "shed") {
                              setSearch("cobertizo");
                              setFilterStage("all");
                            } else {
                              setSearch("");
                              setFilterStage(
                                item.id as SeedNote["growthStage"],
                              );
                            }
                          }}
                          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition-colors ${
                            isActive
                              ? "bg-[var(--sage)] text-[var(--on-sage)] border-[var(--sage)] shadow-lg shadow-[var(--sage)]/20"
                              : "bg-[var(--surface-soft)] text-[var(--earth)] border-[var(--border)] hover:bg-[var(--surface-strong)]"
                          }`}
                        >
                          {item.label}{" "}
                          <span
                            className={
                              isActive
                                ? "text-white/70"
                                : "text-[var(--text-muted)]"
                            }
                          >
                            {item.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-28 space-y-3 md:mb-20">
                    {gardenList.visibleItems.map((note) => {
                      const progress = getProgress(note);
                      const stageMeta = STAGE_META[note.growthStage];
                      const nextTask = note.tasks.find(
                        (task) => !task.completed,
                      );
                      const guidance = getIdeaGuidance(note);
                      const StageIcon =
                        note.growthStage === "bloom"
                          ? CheckCircle2
                          : note.growthStage === "withered"
                            ? Skull
                            : note.growthStage === "sprout"
                              ? Sprout
                              : Leaf;
                      const stageTone =
                        note.growthStage === "bloom"
                          ? "bg-[var(--tone-harvest-bg)] text-[var(--tone-harvest)] ring-[var(--tone-harvest-border)]"
                          : note.growthStage === "withered"
                            ? "bg-[var(--tone-warning-bg)] text-[var(--tone-warning)] ring-[var(--tone-warning-border)]"
                            : note.growthStage === "sprout"
                              ? "bg-[var(--tone-sprout-bg)] text-[var(--tone-sprout)] ring-[var(--tone-sprout-border)]"
                              : "bg-[var(--tone-seed-bg)] text-[var(--tone-seed)] ring-[var(--tone-seed-border)]";

                      return (
                        <GestureNoteSurface
                          key={note.id}
                          onPress={() => setSelectedNoteId(note.id)}
                          onSwipeRight={() => openWatering(note.id)}
                          onSwipeLeft={() =>
                            note.paused
                              ? restoreFromShed(note.id)
                              : moveNoteToShed(note.id)
                          }
                          onLongPress={() => setQuickActionsNoteId(note.id)}
                          rightLabel="Regar"
                          leftLabel={note.paused ? "Volver" : "El cobertizo"}
                          leftIcon={note.paused ? Leaf : Archive}
                          wrapperClassName={IDEA_CARD_WRAPPER}
                          className={`${IDEA_CARD_SURFACE} min-h-[5.25rem] cursor-pointer px-4 py-3 ${
                            selectedNoteId === note.id
                              ? "bg-[var(--bg-app)]"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`${IDEA_ICON_TILE} ${stageTone}`}>
                              <StageIcon size={18} strokeWidth={2.2} />
                              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-current opacity-35" />
                            </div>

                            <div className="min-w-0 flex-1 rounded-[0.95rem] bg-transparent">
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <h3
                                  className={`min-w-0 truncate text-[15px] font-semibold leading-tight ${selectedNoteId === note.id ? "text-[var(--sage)]" : note.growthStage === "withered" ? "text-[var(--text-muted)]" : "text-[var(--earth)]"}`}
                                >
                                  {note.title}
                                </h3>
                                <NoteCareStatus
                                  note={note}
                                  language={appLanguage === "en" ? "en" : "es"}
                                  compact
                                />
                                <span className="shrink-0 text-[11px] font-semibold text-[var(--text-muted)]">
                                  {note.isGrowth
                                    ? `${progress}%`
                                    : stageMeta.shortLabel}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-1 bg-transparent text-sm leading-relaxed text-[var(--text-muted)]">
                                {nextTask?.text || note.content}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[var(--text-muted)]">
                                <span>
                                  {appLanguage === "en" ? "Created" : "Creada"}{" "}
                                  {formatShortDate(note.createdAt)}
                                </span>
                                {note.tasks.length > 0 && (
                                  <span>
                                    {note.tasks.length}{" "}
                                    {gardenName(
                                      "task",
                                      appLanguage,
                                    ).toLocaleLowerCase()}
                                  </span>
                                )}
                                {(note.focusedMinutes || 0) > 0 && (
                                  <span>{note.focusedMinutes || 0} min</span>
                                )}
                                {note.dueDate && (
                                  <span
                                    className={
                                      note.growthStage === "withered"
                                        ? "text-[var(--tone-warning)]"
                                        : "text-[var(--sage)]"
                                    }
                                  >
                                    {formatShortDate(note.dueDate)}
                                  </span>
                                )}
                              </div>

                              {note.isGrowth && (
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-app)]">
                                  <div
                                    style={{ width: `${progress}%` }}
                                    className={`h-full rounded-full ${note.growthStage === "bloom" ? "bg-[#7f9a83]" : "bg-[var(--sage)]"}`}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNote(note.id);
                                }}
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
                                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-xs font-semibold leading-none shadow-sm soft-interaction active:translate-y-px ${guidance.actionTone}`}
                                title={guidance.title}
                                aria-label={guidance.action}
                              >
                                {guidance.kind === "water" ? (
                                  <Droplets size={14} />
                                ) : guidance.kind === "focus" ? (
                                  <Target size={14} />
                                ) : guidance.kind === "grow" ? (
                                  <Sprout size={14} />
                                ) : guidance.kind === "pause" ? (
                                  note.paused ? (
                                    <Leaf size={14} />
                                  ) : (
                                    <Archive size={14} />
                                  )
                                ) : (
                                  <ArrowRight size={14} />
                                )}
                              </button>
                              <ChevronRight
                                size={16}
                                className="hidden text-[var(--text-muted)] sm:block"
                              />
                            </div>
                          </div>
                        </GestureNoteSurface>
                      );
                    })}
                    {gardenList.hasMore && (
                      <ProgressiveListMoreButton
                        remaining={gardenList.remaining}
                        onClick={gardenList.showMore}
                      />
                    )}
                  </div>
                </motion.div>
              ) : view === "calendar" ? (
                <CalendarView
                  key="calendar-view"
                  currentMonth={currentMonth}
                  setCurrentMonth={setCurrentMonth}
                  notes={planetNotes}
                  onSelectNote={setSelectedNoteId}
                  onExit={() => setView("today")}
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
                  <Suspense
                    fallback={
                      <div className="h-[75vh] rounded-[3rem] border border-[var(--border)] bg-[var(--surface-soft)] flex items-center justify-center text-center p-8">
                        <div>
                          <Box
                            className="mx-auto text-[var(--sage)] mb-4 animate-pulse"
                            size={44}
                          />
                          <p className="font-serif text-3xl font-black text-[var(--earth)]">
                            Cargando ecosistema
                          </p>
                          <p className="mt-2 text-sm text-[var(--text-muted)]">
                            El 3D se carga solo cuando lo necesitas.
                          </p>
                        </div>
                      </div>
                    }
                  >
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
                  <Suspense
                    fallback={
                      <div className="grid h-screen place-items-center bg-[var(--earth)] text-center text-[var(--on-earth)]">
                        <div>
                          <Box
                            className="mx-auto mb-4 animate-pulse text-white/70"
                            size={44}
                          />
                          <p className="font-serif text-3xl font-black">
                            Cargando planeta
                          </p>
                        </div>
                      </div>
                    }
                  >
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

            {visibleGardenNotes.length === 0 &&
              !isAdding &&
              view === "garden" && (
                <EmptyStatePanel
                  icon={Leaf}
                  eyebrow={
                    search || filterStage !== "all"
                      ? "Filtro sin resultados"
                      : "Jardín listo"
                  }
                  title={
                    search || filterStage !== "all"
                      ? "No hay ideas con este filtro"
                      : "Tu jardín todavía está esperando su primera semilla"
                  }
                  detail={
                    search || filterStage !== "all"
                      ? "Prueba Todo el jardín o busca otra palabra para encontrar lo que ya plantaste."
                      : "Escribe una idea que no quieres perder. No tiene que estar perfecta para empezar a crecer."
                  }
                  actionLabel={
                    search || filterStage !== "all"
                      ? "Ver todo"
                      : gardenName("plant", appLanguage)
                  }
                  onAction={() => {
                    if (search || filterStage !== "all") {
                      setSearch("");
                      setFilterStage("all");
                      return;
                    }
                    startPlanting();
                  }}
                  secondaryLabel={
                    search || filterStage !== "all"
                      ? "Plantar nueva"
                      : undefined
                  }
                  onSecondary={
                    search || filterStage !== "all" ? startPlanting : undefined
                  }
                  variant={
                    search || filterStage !== "all" ? "compact" : "default"
                  }
                />
              )}
          </div>
        </section>

        {/* Selected Note Detail Panel */}
        <AnimatePresence>
          {selectedNoteId && selectedNote && selectedGuidance && (
            <motion.aside
              initial={{ x: "102%", opacity: 0.98 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "102%", opacity: 0.98 }}
              transition={{
                type: "tween",
                duration: 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="app-detail-panel mobile-detail-panel absolute bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--bg-app)] shadow-2xl md:z-30 md:w-[420px]"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-strong)]/82 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.9rem)] md:pt-4 md:backdrop-blur-2xl">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {selectedNote.inbox
                      ? "Semillero"
                      : selectedNote.paused
                        ? "El cobertizo"
                        : STAGE_META[selectedNote.growthStage].label}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[var(--earth)]">
                    {activePlanet.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedNoteId(null)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-[var(--bg-app)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mobile-fast-scroll flex-1 overflow-y-auto app-scrollbar px-4 py-4 pb-44 md:pb-36">
                <section className="overflow-hidden rounded-[1.75rem] bg-[var(--surface-strong)] shadow-sm ring-1 ring-[var(--border)]">
                  <div className="relative p-5">
                    <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,var(--surface-soft),transparent)]" />
                    <div className="relative">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${STAGE_META[selectedNote.growthStage].bg} ${STAGE_META[selectedNote.growthStage].color}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {selectedNote.paused
                              ? "El cobertizo"
                              : STAGE_META[selectedNote.growthStage].shortLabel}
                          </span>
                          <NoteCareStatus
                            note={selectedNote}
                            language={appLanguage === "en" ? "en" : "es"}
                          />
                        </div>
                        <span className="shrink-0 rounded-full bg-[var(--bg-app)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                          {formatShortDate(selectedNote.createdAt)}
                        </span>
                      </div>

                      <input
                        type="text"
                        value={selectedNote.title}
                        onChange={(e) =>
                          updateNote(selectedNote.id, { title: e.target.value })
                        }
                        className="seed-title-input w-full bg-transparent text-[2rem] font-semibold leading-tight tracking-tight text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/38"
                        placeholder="Sin título"
                      />

                      <textarea
                        value={selectedNote.content}
                        onChange={(e) =>
                          updateNote(selectedNote.id, {
                            content: e.target.value,
                          })
                        }
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
                      {selectedGuidance.kind === "water" ? (
                        <Droplets size={17} />
                      ) : selectedGuidance.kind === "focus" ? (
                        <Target size={17} />
                      ) : selectedGuidance.kind === "grow" ? (
                        <Sprout size={17} />
                      ) : (
                        <Sparkles size={17} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Acción recomendada
                      </p>
                      <h4 className="mt-1 text-lg font-semibold tracking-tight text-[var(--earth)]">
                        {selectedGuidance.title}
                      </h4>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                        {selectedGuidance.detail}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                          {selectedNote.growthStage === "bloom"
                            ? "Cosechado"
                            : formatReviewAge(selectedNote)}
                        </span>
                        <span className="rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                          {selectedNote.isGrowth &&
                          selectedNote.tasks.length > 0
                            ? `${selectedCompletedSteps}/${selectedNote.tasks.length} pasos`
                            : "Sin pasos"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!(selectedIsDone && selectedGuidance.kind === "open") && (
                    <button
                      onClick={() => {
                        if (selectedGuidance.kind === "grow")
                          openSproutPrompt(selectedNote.id);
                        else if (selectedGuidance.kind === "water")
                          openWatering(selectedNote.id);
                        else if (selectedGuidance.kind === "focus") {
                          openFocusMode(selectedNote.id);
                        } else {
                          addTask(selectedNote.id);
                        }
                      }}
                      className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm soft-interaction ${selectedGuidance.actionTone}`}
                    >
                      {selectedGuidance.kind === "water" ? (
                        <Droplets size={15} />
                      ) : selectedGuidance.kind === "focus" ? (
                        <Target size={15} />
                      ) : selectedGuidance.kind === "grow" ? (
                        <Sprout size={15} />
                      ) : (
                        <Plus size={15} />
                      )}
                      {selectedGuidance.kind === "open"
                        ? "Añadir labor"
                        : selectedGuidance.action}
                    </button>
                  )}
                </section>

                {selectedNote.isGrowth ? (
                  <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-sm">
                    <div className="border-b border-[var(--border)] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--earth)]">
                            Siguiente labor
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
                            {selectedNextTask
                              ? selectedNextTask.text
                              : selectedNote.growthStage === "bloom"
                                ? "Cosecha completada"
                                : "Añade un paso pequeño"}
                          </p>
                        </div>
                        <span className="rounded-full bg-[var(--bg-app)] px-3 py-1.5 text-xs font-semibold text-[var(--sage)]">
                          {selectedProgress}%
                        </span>
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
                        {selectedNote.tasks.map((task) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-[var(--bg-app)]"
                          >
                            <button
                              onClick={() =>
                                toggleTask(selectedNote.id, task.id)
                              }
                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all ${task.completed ? "border-[var(--sage)] bg-[var(--sage)] text-[var(--on-sage)]" : "border-[var(--border)] text-transparent hover:border-[var(--sage)]"}`}
                              aria-label={
                                task.completed
                                  ? "Marcar labor pendiente"
                                  : "Completar labor"
                              }
                            >
                              <CheckCircle2 size={15} />
                            </button>
                            <input
                              type="text"
                              value={task.text}
                              onChange={(e) =>
                                updateTask(
                                  selectedNote.id,
                                  task.id,
                                  e.target.value,
                                )
                              }
                              className={`min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--earth)] outline-none transition-all placeholder:text-[var(--text-muted)]/55 ${task.completed ? "line-through opacity-45" : ""}`}
                              placeholder="Describe el paso..."
                            />
                            <button
                              type="button"
                              onClick={() =>
                                deleteTask(selectedNote.id, task.id)
                              }
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tone-danger-bg)] hover:text-[var(--tone-danger)]"
                              aria-label="Eliminar labor"
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
                    <p className="text-sm font-semibold text-[var(--earth)]">
                      Cierre guardado
                    </p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                      Esta idea ya está cosechada. Si dejó algo importante,
                      guárdalo en Lo aprendido.
                    </p>
                  </section>
                ) : (
                  <section className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-sm">
                    <p className="text-sm font-semibold text-[var(--earth)]">
                      Semilla sin presión
                    </p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                      Decide después o conviértela en brote cuando exista un
                      primer paso de 5 minutos.
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
                    <ChevronRight
                      size={16}
                      className="text-[var(--text-muted)]"
                    />
                  </summary>
                  <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] bg-[var(--bg-app)]/30 p-3 sm:grid-cols-4">
                    {[
                      {
                        label: "Creada",
                        value: formatShortDate(selectedNote.createdAt),
                      },
                      {
                        label: "Riego",
                        value:
                          selectedNote.growthStage === "bloom"
                            ? "Lista"
                            : selectedReviewDays <= 0
                              ? "Hoy"
                              : `${selectedReviewDays}d`,
                      },
                      {
                        label: gardenName("task", appLanguage),
                        value:
                          selectedNote.isGrowth && selectedNote.tasks.length > 0
                            ? `${selectedCompletedSteps}/${selectedNote.tasks.length}`
                            : "Libre",
                      },
                      {
                        label: "Atención",
                        value: `${selectedNote.focusedMinutes || 0}m`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl bg-[var(--surface-strong)] px-3 py-3 text-center shadow-sm ring-1 ring-[var(--border)]"
                      >
                        <p className="truncate text-lg font-semibold text-[var(--earth)]">
                          {item.value}
                        </p>
                        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>

                {selectedNote.growthStage === "bloom" && (
                  <section className="mt-4 rounded-[1.5rem] border border-[var(--tone-harvest-border)] bg-[var(--tone-harvest-bg)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--tone-harvest)]">
                          Lo aprendido
                        </p>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                          Opcional: guarda el cierre de esta idea sin
                          convertirlo en diario.
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
                      value={selectedNote.reflection || ""}
                      onChange={(e) =>
                        updateNote(selectedNote.id, {
                          reflection: e.target.value,
                        })
                      }
                      rows={3}
                      className="mt-3 w-full resize-none rounded-2xl border border-[var(--tone-harvest-border)] bg-[var(--surface-strong)]/85 p-3 text-sm font-medium text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/65 focus:ring-0"
                      placeholder="Qué aprendiste de esta idea?"
                    />
                    <textarea
                      value={selectedNote.takeaway || ""}
                      onChange={(e) =>
                        updateNote(selectedNote.id, {
                          takeaway: e.target.value,
                        })
                      }
                      rows={2}
                      className="mt-2 w-full resize-none rounded-2xl border border-[var(--tone-harvest-border)] bg-[var(--surface-strong)]/85 p-3 text-sm font-medium text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/65 focus:ring-0"
                      placeholder="Qué te dejó este proyecto?"
                    />
                  </section>
                )}

                {selectedNote.growthStage === "withered" && (
                  <section className="mt-4 rounded-[1.5rem] border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] p-4">
                    <p className="text-sm font-semibold text-[var(--tone-warning)]">
                      Esta semilla se quedó quieta
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                      Puedes revivirla si todavía importa, o soltarla sin culpa.
                    </p>
                  </section>
                )}

                <details className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)] [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--earth)]">
                    Organización
                    <ChevronRight
                      size={16}
                      className="text-[var(--text-muted)]"
                    />
                  </summary>
                  <div className="border-t border-[var(--border)]">
                    <div className="border-b border-[var(--border)] px-4 py-3">
                      <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">
                        Tipo
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
                        {SEED_TYPES.map((type) => (
                          <button
                            key={type.id}
                            onClick={() =>
                              updateNote(selectedNote.id, { seedType: type.id })
                            }
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                              (selectedNote.seedType || "idea") === type.id
                                ? "bg-[var(--sage)] text-[var(--on-sage)]"
                                : "bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--earth)]"
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="border-b border-[var(--border)] px-4 py-3">
                      <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">
                        Prioridad
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
                        {PRIORITY_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() =>
                              updateNote(selectedNote.id, {
                                priority: option.id,
                              })
                            }
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                              selectedPriority.id === option.id
                                ? "bg-[var(--sage)] text-[var(--on-sage)]"
                                : "bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--earth)]"
                            }`}
                          >
                            {priorityLabel(option)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
                      <span className="text-sm font-medium text-[var(--text-muted)]">
                        Fecha objetivo
                      </span>
                      <input
                        type="date"
                        value={
                          selectedNote.dueDate
                            ? timestampToDateInput(selectedNote.dueDate)
                            : ""
                        }
                        onChange={(e) =>
                          updateNote(selectedNote.id, {
                            dueDate: e.target.value
                              ? dateInputToEndOfDay(e.target.value)
                              : undefined,
                          })
                        }
                        className="min-w-0 bg-transparent text-right text-sm font-semibold text-[var(--earth)] outline-none"
                      />
                    </label>
                    <div className="flex min-h-12 items-center justify-between gap-2 px-4 py-2">
                      <span className="text-sm font-medium text-[var(--text-muted)]">
                        Riego
                      </span>
                      <div className="flex gap-1">
                        {[
                          { value: 1, label: "Diario" },
                          { value: 3, label: "3d" },
                          { value: 7, label: "Semana" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() =>
                              updateNote(selectedNote.id, {
                                wateringIntervalDays: option.value,
                              })
                            }
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                              (selectedNote.wateringIntervalDays || 1) ===
                              option.value
                                ? "bg-[var(--sage)] text-[var(--on-sage)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
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

              <div className="border-t border-[var(--border)] bg-[var(--surface-strong)]/92 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:pb-3 md:backdrop-blur-2xl">
                <div className="grid grid-cols-2 gap-2">
                  {selectedIsDone ? (
                    <>
                      <button
                        onClick={() => {
                          setFilterStage("all");
                          setSearch("");
                          setView("harvest");
                          setSelectedNoteId(null);
                        }}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                      >
                        <Archive size={15} />{" "}
                        {appLanguage === "en" ? "Harvests" : "Cosechas"}
                      </button>
                      <button
                        onClick={() => setView("3D")}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)]"
                      >
                        <Box size={15} /> {t("planet")}
                      </button>
                    </>
                  ) : selectedIsQuickSeed ? (
                    <>
                      <button
                        onClick={() => completeQuickSeed(selectedNote.id)}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                      >
                        <CheckCircle2 size={15} />{" "}
                        {gardenName("complete", appLanguage)}
                      </button>
                      <button
                        onClick={() =>
                          selectedNote.inbox
                            ? cultivateInboxNote(selectedNote.id)
                            : openSproutPrompt(selectedNote.id)
                        }
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)]"
                      >
                        <Sprout size={15} />{" "}
                        {gardenName("project", appLanguage, true)}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openFocusMode(selectedNote.id)}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 text-sm font-semibold text-[var(--on-sage)] soft-interaction"
                      >
                        <Target size={15} />{" "}
                        {appLanguage === "en" ? "Cultivate" : "Cultivar"}
                      </button>
                      <button
                        onClick={() => addTask(selectedNote.id)}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-sm font-semibold text-[var(--sage)]"
                      >
                        <Plus size={15} />{" "}
                        {gardenName("task", appLanguage, true)}
                      </button>
                    </>
                  )}
                </div>
                {selectedIsProject && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openWatering(selectedNote.id)}
                      className="flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-xs font-semibold text-[var(--sage)]"
                    >
                      <Droplets size={14} /> Regar
                    </button>
                    <button
                      onClick={() =>
                        selectedNote.paused
                          ? restoreFromShed(selectedNote.id)
                          : moveNoteToShed(selectedNote.id)
                      }
                      className="flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--bg-app)] px-4 text-xs font-semibold text-[var(--sage)]"
                    >
                      {selectedNote.paused ? (
                        <Leaf size={14} />
                      ) : (
                        <Archive size={14} />
                      )}{" "}
                      {selectedNote.paused ? "Volver" : "El cobertizo"}
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
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatShortDate(selectedNote.createdAt)}
                  </span>
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
              className="mobile-modal-overlay fixed inset-0 z-[64] flex items-end justify-center bg-black/25 p-3 md:backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setQuickActionsNoteId(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{
                  type: "tween",
                  duration: 0.16,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mobile-modal-sheet w-full max-w-md overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
                <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--seed-accent)]">
                      Acciones rápidas
                    </p>
                    <h3 className="mt-1 truncate text-2xl font-semibold tracking-tight text-[var(--earth)]">
                      {quickActionsNote.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                      {quickActionsNote.content}
                    </p>
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
                  {!quickActionsNote.inbox &&
                    quickActionsNote.growthStage !== "bloom" && (
                      <button
                        onClick={() => runQuickAction("water")}
                        className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-water-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-water)] ring-1 ring-[var(--tone-water-border)]"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80">
                          <Droplets size={16} />
                        </span>
                        Regar
                      </button>
                    )}
                  {quickActionsNote.inbox || !quickActionsNote.isGrowth ? (
                    <button
                      onClick={() => runQuickAction("sprout")}
                      className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-sprout-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-sprout)] ring-1 ring-[var(--tone-sprout-border)]"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80">
                        <Sprout size={16} />
                      </span>
                      Convertir en brote
                    </button>
                  ) : (
                    <button
                      onClick={() => runQuickAction("focus")}
                      className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--bg-app)] px-4 text-left text-sm font-semibold text-[var(--sage)]"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]">
                        <Target size={16} />
                      </span>
                      {gardenName("focus", appLanguage)}
                    </button>
                  )}
                  {quickActionsNote.inbox ? (
                    <button
                      onClick={() => runQuickAction("later")}
                      className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-warning-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-warning)] ring-1 ring-[var(--tone-warning-border)]"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80">
                        <Archive size={16} />
                      </span>
                      Guardar en Cobertizo
                    </button>
                  ) : (
                    <button
                      onClick={() => runQuickAction("pause")}
                      className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-warning-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-warning)] ring-1 ring-[var(--tone-warning-border)]"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80">
                        {quickActionsNote.paused ? (
                          <Leaf size={16} />
                        ) : (
                          <Archive size={16} />
                        )}
                      </span>
                      {quickActionsNote.paused
                        ? "Traer al jardín"
                        : "Guardar en Cobertizo"}
                    </button>
                  )}
                  <button
                    onClick={() => runQuickAction("harvest")}
                    className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-harvest-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-harvest)] ring-1 ring-[var(--tone-harvest-border)]"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80">
                      <CheckCircle2 size={16} />
                    </span>
                    Cosechar
                  </button>
                  <button
                    onClick={() => runQuickAction("delete")}
                    className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--tone-danger-bg)] px-4 text-left text-sm font-semibold text-[var(--tone-danger)] ring-1 ring-[var(--tone-danger-border)]"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-strong)]/80">
                      <Trash2 size={16} />
                    </span>
                    Eliminar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sproutPromptNoteId &&
            (() => {
              const note = notes.find((n) => n.id === sproutPromptNoteId);
              if (!note) return null;

              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mobile-modal-overlay fixed inset-0 z-[62] flex items-end justify-center bg-black/25 p-4 md:backdrop-blur-sm sm:items-center"
                  onClick={() => setSproutPromptNoteId(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 28, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 18, scale: 0.97 }}
                    transition={{
                      type: "tween",
                      duration: 0.17,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="mobile-modal-sheet w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--seed-accent)]">
                          Semilla a brote
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--earth)]">
                          Define sus primeros pasos
                        </h3>
                        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                          Empieza con uno. Si hace falta, agrega más con Enter.
                        </p>
                      </div>
                      <button
                        onClick={() => setSproutPromptNoteId(null)}
                        className="grid h-9 w-9 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-app)]"
                        aria-label="Cerrar"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl bg-[var(--bg-app)] p-4">
                      <p className="text-sm font-semibold text-[var(--earth)]">
                        {note.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                        {note.content}
                      </p>
                    </div>

                    <div
                      data-project-todo-list
                      className="mt-4 max-h-64 overflow-y-auto rounded-[1.35rem] bg-[var(--bg-app)]/65 p-2 app-scrollbar"
                    >
                      <DndContext
                        sensors={projectTodoSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleSproutPromptTodoDragEnd}
                      >
                        <SortableContext
                          items={sproutPromptTodos.map((todo) => todo.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="grid gap-1.5">
                            {sproutPromptTodos.map((todo, index) => (
                              <ProjectTodoDraftRow
                                key={todo.id}
                                todo={todo}
                                index={index}
                                total={sproutPromptTodos.length}
                                appLanguage={appLanguage}
                                onToggle={toggleSproutPromptTodo}
                                onChange={updateSproutPromptTodo}
                                onEnter={addSproutPromptTodoAfter}
                                onRemove={removeSproutPromptTodo}
                                onFocus={() => undefined}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                      <button
                        type="button"
                        onClick={() => addSproutPromptTodoAfter()}
                        className="mt-2 flex h-10 w-full items-center justify-center rounded-2xl text-sm font-semibold text-[var(--sage)] transition-colors hover:bg-[var(--surface-strong)]"
                      >
                        Agregar paso
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSproutPromptNoteId(null);
                          setSproutPromptTodos([]);
                        }}
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
          {wateringNoteId &&
            (() => {
              const note = notes.find((n) => n.id === wateringNoteId);
              if (!note) return null;
              const nextTask = note.tasks.find((task) => !task.completed);
              const reviewAge = formatReviewAge(note);

              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mobile-modal-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/24 p-3 pt-[calc(env(safe-area-inset-top)+1rem)] md:backdrop-blur-xl sm:items-center sm:p-4"
                  onClick={() => setWateringNoteId(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.98 }}
                    transition={{
                      type: "tween",
                      duration: 0.17,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="mobile-modal-sheet w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl sm:p-6"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">
                          Revisión amable
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--earth)]">
                          ¿Qué necesita esta idea?
                        </h3>
                        <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                          {reviewAge}
                        </p>
                      </div>
                      <button
                        onClick={() => setWateringNoteId(null)}
                        className="p-2 rounded-full hover:bg-[var(--bg-app)] transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-4">
                      <p className="font-semibold text-[var(--earth)]">
                        {note.title}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                        Vuelve a mirarla con calma. Puedes mantenerla viva,
                        darle un siguiente paso o guardarla para después.
                        Cosecha solo si ya cumplió su ciclo.
                      </p>
                      {nextTask && (
                        <p className="mt-3 rounded-2xl bg-[var(--surface-strong)] px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--sage)]">
                          Siguiente paso: {nextTask.text}
                        </p>
                      )}
                    </div>

                    <label className="block">
                      <span className="mb-2 block px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Nota de revisión
                      </span>
                      <textarea
                        value={wateringNote}
                        onChange={(event) =>
                          setWateringNote(event.target.value)
                        }
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-4 text-base font-medium leading-relaxed text-[var(--earth)] outline-none transition-all placeholder:text-[var(--text-muted)]/65 focus:bg-[var(--surface-strong)] focus:ring-0 sm:text-sm"
                        placeholder="Opcional: qué cambió, qué entendiste o qué queda vivo..."
                      />
                      <span className="mt-2 block px-1 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                        Se guarda como la última revisión de esta idea.
                      </span>
                    </label>

                    <div className="mt-5 grid grid-cols-1 gap-2">
                      <button
                        onClick={() =>
                          waterNote(
                            note.id,
                            wateringNote.trim() || "Riego rápido: sigue viva",
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 py-3 text-sm font-semibold text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
                      >
                        <Droplets size={17} /> Sigue viva
                      </button>
                      <button
                        onClick={() => {
                          saveWateringObservation(
                            note.id,
                            "Revisión: merece un siguiente paso.",
                          );
                          setWateringNoteId(null);
                          setWateringNote("");
                          openSproutPrompt(note.id);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sage)] px-4 py-3 text-sm font-semibold text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
                      >
                        <Sprout size={17} /> Darle un paso
                      </button>
                      <button
                        onClick={() => moveNoteToShed(note.id, wateringNote)}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--tone-warning-bg)] px-4 py-3 text-sm font-semibold text-[var(--tone-warning)] ring-1 ring-[var(--tone-warning-border)] transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        <Archive size={17} /> Guardar en Cobertizo
                      </button>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => harvestFromWatering(note.id)}
                          className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--tone-harvest-bg)] px-3 text-xs font-semibold text-[var(--tone-harvest)] ring-1 ring-[var(--tone-harvest-border)] transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          <CheckCircle2 size={13} /> Cosechar
                        </button>
                        <button
                          onClick={() => {
                            setWateringNoteId(null);
                            setWateringNote("");
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
              <span className="text-sm font-black text-[var(--earth)]">
                {celebration}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {flowerReward && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mobile-modal-overlay fixed inset-0 z-[65] flex items-end justify-center bg-black/20 p-4 md:backdrop-blur-sm sm:items-center"
              onClick={() => setFlowerReward(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{
                  type: "tween",
                  duration: 0.17,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mobile-modal-sheet w-full max-w-sm overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="relative grid h-48 place-items-center bg-[linear-gradient(180deg,var(--tone-harvest-bg),var(--surface-soft))]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_20%_76%,rgba(122,138,105,0.15),transparent_28%),radial-gradient(circle_at_82%_70%,rgba(176,148,98,0.13),transparent_26%)]" />
                  <motion.div
                    initial={{ scale: 0.55, y: 18, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{
                      type: "spring",
                      damping: 16,
                      stiffness: 220,
                      delay: 0.08,
                    }}
                    className="relative z-10 grid h-32 w-32 place-items-center rounded-full bg-[var(--surface-strong)]/70 shadow-[0_22px_60px_rgba(47,62,51,0.14)]"
                  >
                    <PlantIllustration
                      stage="bloom"
                      progress={100}
                      isGrowth={false}
                      theme={activePlanet.theme || theme}
                    />
                  </motion.div>
                  <Sparkles
                    className="absolute right-12 top-10 text-[var(--seed-accent)]"
                    size={22}
                  />
                  <Sparkles
                    className="absolute bottom-12 left-12 text-[var(--sage)]"
                    size={18}
                  />
                </div>
                <div className="p-5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--seed-accent)]">
                    Idea cosechada
                  </p>
                  <h3 className="mt-2 font-serif text-3xl font-black leading-tight text-[var(--earth)]">
                    Ciclo cerrado
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
                    “{flowerReward.title}” ya queda guardada. Si te dejó algo,
                    puedes anotarlo en una frase.
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
                        setFilterStage("all");
                        setSearch("");
                        setView("harvest");
                      }}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3 text-sm font-black text-[var(--sage)] hover:bg-[var(--surface-soft)]"
                    >
                      Ver cosechas
                    </button>
                    <button
                      onClick={() => {
                        setFlowerReward(null);
                        setView("today");
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
          {harvestNoteId &&
            (() => {
              const note = notes.find((n) => n.id === harvestNoteId);
              if (!note) return null;

              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mobile-modal-overlay fixed inset-0 z-[65] flex items-end justify-center bg-black/30 p-4 md:backdrop-blur-sm sm:items-center"
                  onClick={() => setHarvestNoteId(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.98 }}
                    transition={{
                      type: "tween",
                      duration: 0.17,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="mobile-modal-sheet w-full max-w-lg rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="relative mb-5 flex h-36 items-center justify-center overflow-hidden rounded-[2rem] border border-[var(--tone-harvest-border)] bg-[linear-gradient(180deg,var(--tone-harvest-bg),var(--surface-soft))]">
                      <div className="seed-card-sheen" />
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 2.8, repeat: Infinity }}
                      >
                        <PlantIllustration
                          stage="bloom"
                          progress={100}
                          isGrowth
                        />
                      </motion.div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--tone-harvest)]">
                      Aprendizaje opcional
                    </p>
                    <h3 className="mt-2 text-3xl font-serif font-black leading-tight text-[var(--earth)]">
                      {note.title}
                    </h3>
                    <p className="mt-3 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
                      Una frase basta. Si no hay nada que guardar, puedes cerrar
                      y la cosecha se mantiene.
                    </p>
                    <textarea
                      value={note.reflection || ""}
                      onChange={(event) =>
                        updateNote(note.id, {
                          reflection: event.target.value,
                          takeaway: event.target.value,
                        })
                      }
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
                          setView("harvest");
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
              className="mobile-modal-overlay fixed inset-0 z-[66] flex items-end justify-center bg-black/18 p-0 md:backdrop-blur-2xl sm:items-center sm:p-4"
              onClick={closeSettings}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{
                  type: "tween",
                  duration: 0.17,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mobile-modal-sheet flex h-[92dvh] max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2.25rem] bg-[var(--bg-app)]/96 p-0 shadow-[0_28px_100px_rgba(0,0,0,0.24)] md:backdrop-blur-2xl sm:h-auto sm:max-h-[86vh] sm:rounded-[2.25rem] sm:ring-1 sm:ring-[var(--border)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--text-muted)]/20 sm:hidden" />
                <div className="relative flex shrink-0 items-center justify-center border-b border-[var(--border)] px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
                  {settingsPage !== "root" && (
                    <button
                      type="button"
                      onClick={() => setSettingsPage("root")}
                      className="absolute left-3 top-2.5 flex h-10 items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-[var(--sage)] transition-colors active:bg-[var(--surface-hover)] sm:left-4 sm:top-3.5 sm:hover:bg-[var(--surface-hover)]"
                      aria-label="Volver a ajustes"
                    >
                      <ChevronLeft size={19} />
                      <span>Atrás</span>
                    </button>
                  )}
                  <h3 className="max-w-[12rem] truncate text-[1.05rem] font-semibold tracking-tight text-[var(--earth)]">
                    {settingsTitles[settingsPage]}
                  </h3>
                  <button
                    onClick={closeSettings}
                    className="absolute right-4 top-3 rounded-full px-2.5 py-2 text-sm font-semibold text-[var(--sage)] transition-colors hover:bg-[var(--surface-hover)] sm:right-5 sm:top-4"
                    aria-label="Cerrar ajustes"
                  >
                    Listo
                  </button>
                </div>

                <div className="mobile-fast-scroll overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 app-scrollbar sm:px-6 sm:pb-6">
                  <AnimatePresence mode="wait" initial={false}>
                    {settingsPage === "root" && (
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
                            onClick={() => setSettingsPage("profile")}
                            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors active:bg-[var(--surface-hover)] sm:px-5 sm:hover:bg-[var(--surface-hover)]"
                          >
                            <AccountAvatar
                              photo={account.photo}
                              initials={accountInitials}
                              className="h-14 w-14 rounded-full shadow-sm ring-1 ring-[var(--border)]"
                              textClassName="text-xl"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-xl font-semibold tracking-tight text-[var(--earth)]">
                                {account.name || "Tu jardín"}
                              </h4>
                              <p className="mt-0.5 truncate text-sm font-medium text-[var(--text-muted)]">
                                {session?.user?.email ||
                                  account.email ||
                                  "Sin sesión en la nube"}
                              </p>
                            </div>
                            <ChevronRight
                              size={18}
                              className="shrink-0 text-[var(--text-muted)]/65"
                            />
                          </button>
                          <div className="grid grid-cols-4 border-t border-[var(--border)] bg-[var(--surface-strong)]/42">
                            {[
                              {
                                label: gardenName("note", appLanguage),
                                value: gardenNotes.length,
                              },
                              {
                                label: t("sprouts"),
                                value: profileStats.active,
                              },
                              { label: "Racha", value: wateringRitual.streak },
                              { label: "Min", value: profileStats.totalFocus },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="border-r border-[var(--border)] px-2 py-3 text-center last:border-r-0"
                              >
                                <p className="text-lg font-semibold text-[var(--earth)]">
                                  {item.value}
                                </p>
                                <p className="mt-0.5 truncate text-[9px] font-medium text-[var(--text-muted)]">
                                  {item.label}
                                </p>
                              </div>
                            ))}
                          </div>
                        </section>

                        {renderSettingsSection(
                          "Seed",
                          settingsRows.map(renderSettingsNavRow),
                        )}

                        {renderSettingsSection(
                          appLanguage === "en" ? "Help" : "Ayuda",
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
                              <span className="block text-[15px] font-semibold text-[var(--earth)]">
                                {appLanguage === "en"
                                  ? "See the getting-started guide"
                                  : "Ver guía inicial"}
                              </span>
                              <span className="mt-0.5 block truncate text-xs font-medium text-[var(--text-muted)]">
                                Plantar, regar y cosechar en 3 pasos
                              </span>
                            </span>
                            <ChevronRight
                              size={17}
                              className="shrink-0 text-[var(--text-muted)]/65"
                            />
                          </button>,
                        )}
                        <GardenerGlossary language={appLanguage} />
                      </motion.div>
                    )}

                    {settingsPage === "profile" && (
                      <motion.div
                        key="settings-profile"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        {renderSettingsSection(
                          "Foto de perfil",
                          <div className="flex items-center gap-4 px-4 py-4">
                            <AccountAvatar
                              photo={account.photo}
                              initials={accountInitials}
                              className="h-20 w-20 rounded-[1.65rem] shadow-sm ring-1 ring-[var(--border)]"
                              textClassName="text-2xl"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--earth)]">
                                {account.photo
                                  ? "Foto personalizada"
                                  : "Agrega una foto"}
                              </p>
                              <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                                Se usa en tu perfil, sidebar y ajustes. La
                                imagen queda guardada solo en esta app.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-full bg-[var(--sage)] px-4 text-xs font-semibold text-[var(--on-sage)] shadow-sm soft-interaction">
                                  Elegir foto
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleProfilePhotoChange}
                                    className="sr-only"
                                  />
                                </label>
                                {account.photo && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAccount((current) => ({
                                        ...current,
                                        photo: undefined,
                                      }))
                                    }
                                    className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--bg-app)] px-4 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-[var(--border)] soft-interaction hover:text-[var(--sage)]"
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>,
                        )}

                        {renderSettingsSection(
                          "Identidad",
                          <>
                            <label className="flex min-h-14 items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
                              <span className="w-24 shrink-0 text-sm font-medium text-[var(--text-muted)]">
                                Nombre
                              </span>
                              <input
                                value={account.name}
                                onChange={(event) =>
                                  setAccount((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/60"
                                placeholder="Tu nombre"
                              />
                            </label>
                            <label className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                              <span className="w-24 shrink-0 text-sm font-medium text-[var(--text-muted)]">
                                Rol
                              </span>
                              <input
                                value={account.role}
                                onChange={(event) =>
                                  setAccount((current) => ({
                                    ...current,
                                    role: event.target.value,
                                  }))
                                }
                                className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/60"
                                placeholder="Creador, estudiante..."
                              />
                            </label>
                          </>,
                        )}

                        {renderSettingsSection(
                          "Uso",
                          <div className="space-y-4 px-4 py-4">
                            <div>
                              <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">
                                Uso principal
                              </p>
                              <AppSelect
                                value={account.purpose || "Ideas personales"}
                                onChange={(value) =>
                                  setAccount((current) => ({
                                    ...current,
                                    purpose: value,
                                  }))
                                }
                                ariaLabel="Uso principal"
                                options={PROFILE_PURPOSE_OPTIONS}
                              />
                            </div>
                            <label className="block">
                              <span className="text-sm font-medium text-[var(--text-muted)]">
                                Estoy cultivando
                              </span>
                              <textarea
                                value={account.mantra || ""}
                                onChange={(event) =>
                                  setAccount((current) => ({
                                    ...current,
                                    mantra: event.target.value,
                                  }))
                                }
                                rows={4}
                                className="mt-2 w-full resize-none rounded-2xl bg-[var(--bg-app)] px-3 py-3 text-sm font-medium leading-relaxed text-[var(--earth)] outline-none placeholder:text-[var(--text-muted)]/60"
                                placeholder="Ideas para crear una vida más tranquila..."
                              />
                            </label>
                          </div>,
                        )}
                      </motion.div>
                    )}

                    {settingsPage === "appearance" && (
                      <motion.div
                        key="settings-appearance"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        {renderSettingsSection(
                          "Jardín actual",
                          <div className="space-y-3 px-4 py-4">
                            <p className="text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                              Cambia el ambiente solo para {activePlanet.name}.
                              El resto de jardines conserva su propia sensación.
                            </p>
                            <AppSelect
                              value={activePlanet.theme || theme}
                              onChange={(value) => {
                                const selectedTheme = value as Theme;
                                setTheme(selectedTheme);
                                setPlanets((current) =>
                                  current.map((planet) =>
                                    planet.id === activePlanet.id
                                      ? touchPlanet({
                                          ...planet,
                                          theme: selectedTheme,
                                        })
                                      : planet,
                                  ),
                                );
                              }}
                              ariaLabel="Ecosistema del jardín actual"
                              options={THEME_SELECT_OPTIONS}
                            />
                          </div>,
                        )}

                        {renderSettingsSection(
                          "Interacciones",
                          <>
                            <div className="flex min-h-14 items-center gap-3 border-b border-[var(--border)] px-4 py-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                                <Sparkles size={16} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[var(--earth)]">
                                  Haptics
                                </p>
                                <p className="truncate text-xs font-medium text-[var(--text-muted)]">
                                  Vibración sutil en acciones importantes
                                </p>
                              </div>
                              <AppSwitch
                                checked={hapticsEnabled}
                                onChange={(checked) => {
                                  setHapticsEnabled(checked);
                                  if (checked)
                                    window.setTimeout(
                                      () => feel("open", true),
                                      0,
                                    );
                                }}
                                ariaLabel={
                                  hapticsEnabled
                                    ? "Desactivar haptics"
                                    : "Activar haptics"
                                }
                              />
                            </div>
                            <div className="flex min-h-14 items-center gap-3 px-4 py-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                                <Droplets size={16} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[var(--earth)]">
                                  Sonidos suaves
                                </p>
                                <p className="truncate text-xs font-medium text-[var(--text-muted)]">
                                  Pop al plantar, gota al regar y bloom al
                                  cosechar
                                </p>
                              </div>
                              <AppSwitch
                                checked={soundsEnabled}
                                onChange={(checked) => {
                                  setSoundsEnabled(checked);
                                  if (checked) playMicroSound("pop", true);
                                }}
                                ariaLabel={
                                  soundsEnabled
                                    ? "Desactivar sonidos"
                                    : "Activar sonidos"
                                }
                              />
                            </div>
                          </>,
                        )}
                      </motion.div>
                    )}

                    {settingsPage === "today" && (
                      <motion.div
                        key="settings-today"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        <p className="px-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                          {appLanguage === "en"
                            ? "Drag the dotted handle to arrange cards. On iPhone, hold it briefly and move your finger. You can also use the arrows. Switches show or hide cards, and changes are saved automatically."
                            : "Arrastra el asa de puntos para ordenar las tarjetas. En iPhone, mantenla pulsada un instante y mueve el dedo. También puedes usar las flechas. Los interruptores muestran u ocultan tarjetas y los cambios se guardan automáticamente."}
                        </p>
                        {renderSettingsSection(
                          appLanguage === "en"
                            ? "Order and visibility"
                            : "Orden y visibilidad",
                          <DashboardModuleSettings
                            order={dashboardOrder}
                            language={appLanguage === "en" ? "en" : "es"}
                            onOrderChange={setDashboardOrder}
                            renderSwitch={(id, title) => (
                              <AppSwitch
                                checked={todayWidgets.includes(id)}
                                onChange={(checked) =>
                                  toggleTodayWidget(id, checked)
                                }
                                ariaLabel={
                                  appLanguage === "en"
                                    ? `Show ${title} on my walk`
                                    : `Mostrar ${title} en mi paseo`
                                }
                              />
                            )}
                          />,
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setDashboardOrder([...DEFAULT_DASHBOARD_MODULES])
                          }
                          className="min-h-11 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-xs font-semibold text-[var(--sage)]"
                        >
                          {appLanguage === "en"
                            ? "Restore default order"
                            : "Restablecer orden"}
                        </button>
                        <p className="px-2 text-xs leading-relaxed text-[var(--text-muted)]">
                          {appLanguage === "en"
                            ? "Hidden cards keep their position when you turn them on again. Restoring the order does not change visibility. Your notes, projects and dates stay intact."
                            : "Las tarjetas ocultas conservan su lugar al volver a activarlas. Restablecer el orden no cambia la visibilidad. Tus notas, proyectos y fechas se mantienen intactos."}
                        </p>
                      </motion.div>
                    )}

                    {settingsPage === "watering" && (
                      <motion.div
                        key="settings-watering"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        {renderSettingsSection(
                          "Ritmo",
                          <div className="space-y-4 px-4 py-4">
                            <div>
                              <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">
                                Riego por defecto
                              </p>
                              <AppSelect
                                value={String(defaultWateringInterval)}
                                onChange={(value) =>
                                  setDefaultWateringInterval(Number(value))
                                }
                                ariaLabel="Riego por defecto"
                                options={WATERING_INTERVAL_OPTIONS}
                              />
                            </div>
                            <label className="flex min-h-12 items-center justify-between gap-3">
                              <span>
                                <span className="block text-sm font-semibold text-[var(--earth)]">
                                  Hora de recordatorio
                                </span>
                                <span className="block text-xs font-medium text-[var(--text-muted)]">
                                  Aviso suave, sin presión
                                </span>
                              </span>
                              <input
                                type="time"
                                value={`${String(reminderHour).padStart(2, "0")}:00`}
                                onChange={(event) => {
                                  const hour = Number(
                                    event.target.value.split(":")[0],
                                  );
                                  setReminderHour(
                                    Number.isFinite(hour)
                                      ? Math.min(23, Math.max(0, hour))
                                      : reminderHour,
                                  );
                                }}
                                className="bg-transparent text-right text-sm font-semibold text-[var(--earth)] outline-none"
                              />
                            </label>
                          </div>,
                        )}

                        {renderSettingsSection(
                          "Recordatorios",
                          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                              <Clock size={16} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--earth)]">
                                Activar avisos
                              </p>
                              <p className="truncate text-xs font-medium text-[var(--text-muted)]">
                                Seed te recuerda revisar ideas vivas
                              </p>
                            </div>
                            <AppSwitch
                              checked={notificationsEnabled}
                              onChange={(checked) => {
                                if (checked) {
                                  enableNotifications();
                                  return;
                                }
                                setNotificationsEnabled(false);
                                clearSeedNotifications();
                              }}
                              ariaLabel={
                                notificationsEnabled
                                  ? "Desactivar recordatorios"
                                  : "Activar recordatorios"
                              }
                            />
                          </div>,
                        )}
                      </motion.div>
                    )}

                    {settingsPage === "data" && (
                      <motion.div
                        key="settings-data"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        {renderSettingsSection(
                          "Cuenta",
                          <div className="px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[var(--earth)]">
                                  {session?.user
                                    ? "Cuenta conectada"
                                    : "Modo local"}
                                </p>
                                <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                                  {session?.user
                                    ? session.user.email
                                    : "Este jardín invitado se guarda solo en este dispositivo. Al iniciar sesión permanecerá separado de la cuenta."}
                                </p>
                              </div>
                              {session?.user && (
                                <button
                                  type="button"
                                  onClick={signOut}
                                  disabled={accountAction !== null}
                                  className="shrink-0 rounded-full bg-[var(--bg-app)] px-3 py-2 text-xs font-semibold text-[var(--sage)] ring-1 ring-[var(--border)] disabled:opacity-45"
                                >
                                  {accountAction === "signout"
                                    ? "Saliendo…"
                                    : "Cerrar sesión"}
                                </button>
                              )}
                            </div>

                            {!session?.user ? (
                              <div className="mt-4 space-y-2">
                                <input
                                  type="email"
                                  value={authEmail}
                                  onChange={(event) =>
                                    setAuthEmail(event.target.value)
                                  }
                                  placeholder="correo@email.com"
                                  className="h-11 w-full rounded-2xl bg-[var(--bg-app)] px-3 text-sm outline-none focus:ring-0"
                                />
                                <input
                                  type="password"
                                  value={authPassword}
                                  onChange={(event) =>
                                    setAuthPassword(event.target.value)
                                  }
                                  placeholder="Contraseña"
                                  className="h-11 w-full rounded-2xl bg-[var(--bg-app)] px-3 text-sm outline-none focus:ring-0"
                                />
                                <input
                                  type="password"
                                  value={authConfirmPassword}
                                  onChange={(event) =>
                                    setAuthConfirmPassword(event.target.value)
                                  }
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
                                  <p className="text-xs font-medium text-[var(--text-muted)]">
                                    {authDisabledReason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={syncGarden}
                                disabled={isSyncing}
                                className="mt-4 h-11 w-full rounded-full bg-[var(--sage)] text-sm font-semibold text-[var(--on-sage)] disabled:opacity-50"
                              >
                                {isSyncing
                                  ? "Sincronizando..."
                                  : pendingSyncCount > 0
                                    ? `Sincronizar ${pendingSyncCount} ${pendingSyncCount === 1 ? "cambio" : "cambios"}`
                                    : "Sincronizar ahora"}
                              </button>
                            )}

                            {(authStatus || syncStatus) && (
                              <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">
                                {syncStatus || authStatus}
                              </p>
                            )}
                          </div>,
                        )}

                        <p className="px-2 text-xs leading-relaxed text-[var(--text-muted)]">
                          Cada cuenta y el modo invitado conservan un jardín
                          separado. Los datos de versiones anteriores no se
                          importan automáticamente: puedes recuperarlos aquí
                          confirmando que son tuyos. La copia original se
                          conserva.
                        </p>
                        {renderSettingsSection(
                          "Backups",
                          <>
                            {[
                              {
                                label: "Exportar Markdown",
                                icon: Download,
                                onClick: exportGarden,
                              },
                              {
                                label: "Exportar backup",
                                icon: Download,
                                onClick: exportBackup,
                              },
                              {
                                label: "Importar backup",
                                icon: Archive,
                                onClick: () => importInputRef.current?.click(),
                              },
                              {
                                label: "Recuperar datos de la versión anterior",
                                icon: Archive,
                                onClick: recoverLegacyGarden,
                              },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={item.onClick}
                                className="flex min-h-12 w-full items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-hover)]"
                              >
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--sage)] ring-1 ring-[var(--border)]">
                                  <item.icon size={15} />
                                </span>
                                <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--earth)]">
                                  {item.label}
                                </span>
                                <ChevronRight
                                  size={15}
                                  className="text-[var(--text-muted)]"
                                />
                              </button>
                            ))}
                          </>,
                        )}

                        {renderSettingsSection(
                          "Zona sensible",
                          <>
                            <button
                              onClick={clearGardenData}
                              disabled={accountAction !== null}
                              className="flex min-h-12 w-full items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 text-left text-sm font-semibold text-[var(--tone-danger)] transition-colors last:border-b-0 hover:bg-[var(--tone-danger-bg)] disabled:opacity-45"
                            >
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--tone-danger-bg)] text-[var(--tone-danger)]">
                                <Trash2 size={15} />
                              </span>
                              <span className="min-w-0 flex-1">
                                Borrar datos locales
                              </span>
                              <ChevronRight
                                size={15}
                                className="text-[var(--tone-danger)] opacity-55"
                              />
                            </button>
                            {session?.user && (
                              <button
                                onClick={deleteAccount}
                                disabled={accountAction !== null}
                                className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-[var(--tone-danger)] transition-colors hover:bg-[var(--tone-danger-bg)] disabled:opacity-45"
                              >
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--tone-danger-bg)] text-[var(--tone-danger)]">
                                  <User size={15} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block">
                                    {accountAction === "delete"
                                      ? "Eliminando cuenta…"
                                      : "Eliminar cuenta"}
                                  </span>
                                  <span className="mt-0.5 block text-[10px] font-medium opacity-70">
                                    Borra la cuenta y todos sus datos
                                    permanentemente
                                  </span>
                                </span>
                                <ChevronRight
                                  size={15}
                                  className="text-[var(--tone-danger)] opacity-55"
                                />
                              </button>
                            )}
                          </>,
                        )}
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
                      event.currentTarget.value = "";
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
              className="mobile-modal-overlay fixed inset-0 z-[70] flex items-end justify-center bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] md:backdrop-blur-md sm:items-center sm:p-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{
                  type: "tween",
                  duration: 0.17,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mobile-modal-sheet flex max-h-[min(88vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-white/55 bg-[var(--surface-strong)] shadow-[0_24px_90px_rgba(20,30,24,0.28)] sm:max-w-2xl"
              >
                {(() => {
                  const step =
                    ONBOARDING_STEPS[onboardingStep] || ONBOARDING_STEPS[0];
                  const StepIcon = step.icon;
                  const isLastStep =
                    onboardingStep === ONBOARDING_STEPS.length - 1;

                  return (
                    <>
                      <div className="relative shrink-0 border-b border-[var(--border)] bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-soft))] px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_0%,rgba(255,255,255,0.82),transparent_30%),radial-gradient(circle_at_4%_100%,rgba(122,169,92,0.16),transparent_34%)]" />
                        <div className="relative">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--seed-accent)]">
                                Primer recorrido
                              </p>
                              <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--earth)] sm:text-3xl">
                                Planta. Decide. Cultiva.
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
                                className={`h-1.5 flex-1 rounded-full transition-colors ${index <= onboardingStep ? "bg-[var(--sage)]" : "bg-[var(--border)]"}`}
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
                                    Paso {onboardingStep + 1} de{" "}
                                    {ONBOARDING_STEPS.length} · {step.eyebrow}
                                  </p>
                                  <h3 className="mt-1 text-3xl font-black leading-tight tracking-tight text-[var(--earth)] sm:text-4xl">
                                    {step.title}
                                  </h3>
                                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
                                    {step.text}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 items-center gap-2 rounded-[1.5rem] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border)]">
                              {[
                                {
                                  label: "Plantar",
                                  icon: Leaf,
                                  active: onboardingStep >= 0,
                                },
                                {
                                  label: "Regar",
                                  icon: Droplets,
                                  active: onboardingStep >= 1,
                                },
                                {
                                  label: "Cosechar",
                                  icon: CheckCircle2,
                                  active: onboardingStep >= 2,
                                },
                              ].map((item) => {
                                const ItemIcon = item.icon;
                                return (
                                  <div
                                    key={item.label}
                                    className={`rounded-2xl px-2 py-3 text-center transition-colors ${item.active ? "bg-[var(--surface-strong)] text-[var(--earth)] shadow-sm" : "text-[var(--text-muted)]/45"}`}
                                  >
                                    <ItemIcon size={18} className="mx-auto" />
                                    <p className="mt-2 truncate text-[11px] font-black">
                                      {item.label}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="rounded-[1.4rem] bg-[var(--surface-strong)] px-4 py-3">
                              <p className="text-sm font-black leading-snug text-[var(--sage)]">
                                {step.action}
                              </p>
                              <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                                {step.detail}
                              </p>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-strong)] px-5 py-3 sm:px-6">
                        <div className="grid grid-cols-[auto_1fr] gap-3">
                          <button
                            onClick={() =>
                              setOnboardingStep((value) =>
                                Math.max(0, value - 1),
                              )
                            }
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
                              setOnboardingStep((value) =>
                                Math.min(
                                  ONBOARDING_STEPS.length - 1,
                                  value + 1,
                                ),
                              );
                            }}
                            className="min-h-12 rounded-2xl bg-[var(--sage)] px-5 font-black text-[var(--on-sage)] shadow-lg shadow-[var(--sage)]/20 active:translate-y-px soft-interaction"
                          >
                            {isLastStep
                              ? gardenName("plant", appLanguage)
                              : "Siguiente"}
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            finishOnboarding();
                            setView("3D");
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

        {createPortal(
          <AnimatePresence>
            {isAdding && (
              <motion.div
                ref={quickEntryOverlayRef}
                className="note-composer-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (showDiscardConfirmation)
                      setShowDiscardConfirmation(false);
                    else requestCloseQuickEntry();
                  }
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key === "Enter" &&
                    !showDiscardConfirmation
                  ) {
                    event.preventDefault();
                    if (canSaveQuickEntry) addNote();
                  }
                  if (event.key === "Tab") {
                    const scope = quickEntryOverlayRef.current?.querySelector(
                      showDiscardConfirmation
                        ? ".note-composer-discard"
                        : ".note-composer-sheet",
                    );
                    const controls = Array.from(
                      scope?.querySelectorAll<HTMLElement>(
                        'button:not(:disabled), input, textarea, select, [tabindex="0"]',
                      ) || [],
                    ).filter((element) => element.getClientRects().length > 0);
                    const first = controls[0];
                    const last = controls[controls.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                      event.preventDefault();
                      last?.focus();
                    } else if (
                      !event.shiftKey &&
                      document.activeElement === last
                    ) {
                      event.preventDefault();
                      first?.focus();
                    }
                  }
                }}
              >
                <div
                  className="note-composer-backdrop"
                  onClick={requestCloseQuickEntry}
                  aria-hidden="true"
                />
                <div
                  className={`note-composer-stage ${quickEntryViewport.keyboardOpen ? "has-keyboard" : ""}`}
                  style={quickEntryViewportStyle}
                  onClick={requestCloseQuickEntry}
                >
                  <motion.section
                    className="note-composer-sheet"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="note-composer-heading"
                    initial={{ y: quickEntryIsMobile ? 28 : 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 16, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="note-composer-handle" aria-hidden="true" />
                    <header
                      className="note-composer-header"
                      inert={showDiscardConfirmation || undefined}
                    >
                      <button
                        type="button"
                        className="note-composer-close"
                        aria-label={
                          appLanguage === "en"
                            ? "Close editor"
                            : "Cerrar editor"
                        }
                        onClick={requestCloseQuickEntry}
                      >
                        <X size={21} />
                      </button>
                      <h2 id="note-composer-heading">
                        {createMode === "seed"
                          ? appLanguage === "en"
                            ? "New garden note"
                            : "Nuevo apunte del jardín"
                          : quickEntryCopy.title}
                      </h2>
                      <button
                        type="button"
                        className="note-composer-save"
                        disabled={!canSaveQuickEntry}
                        onClick={addNote}
                      >
                        <CheckCircle2 size={17} />
                        <span>{appLanguage === "en" ? "Save" : "Guardar"}</span>
                      </button>
                    </header>

                    <div
                      className="note-composer-content"
                      inert={showDiscardConfirmation || undefined}
                    >
                      <div
                        className="note-composer-modes"
                        role="group"
                        aria-label={
                          appLanguage === "en"
                            ? "Capture type"
                            : "Tipo de captura"
                        }
                      >
                        {[
                          {
                            id: "seed" as const,
                            icon: Pencil,
                            label:
                              appLanguage === "en"
                                ? "Garden note"
                                : "Apunte del jardín",
                          },
                          {
                            id: "sprout" as const,
                            icon: Box,
                            label: appLanguage === "en" ? "Sprout" : "Brote",
                          },
                          {
                            id: "journal" as const,
                            icon: BookOpen,
                            label:
                              appLanguage === "en" ? "Lesson" : "Aprendizaje",
                          },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={createMode === item.id}
                            onClick={() => switchQuickEntryMode(item.id)}
                          >
                            <item.icon size={16} />
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="note-composer-writing">
                        <input
                          className="note-composer-title"
                          aria-label={
                            appLanguage === "en"
                              ? "Title (optional)"
                              : "Título (opcional)"
                          }
                          placeholder={
                            createMode === "sprout"
                              ? quickEntryCopy.titlePlaceholder
                              : appLanguage === "en"
                                ? "Title (optional)"
                                : "Título (opcional)"
                          }
                          type="text"
                          autoCapitalize="sentences"
                          autoComplete="off"
                          spellCheck
                          data-quick-entry-autofocus={
                            createMode === "sprout" ? "true" : undefined
                          }
                          value={newNote.title}
                          onChange={(event) =>
                            setNewNote((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          enterKeyHint="next"
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" &&
                              !event.metaKey &&
                              !event.ctrlKey
                            ) {
                              event.preventDefault();
                              quickEntryOverlayRef.current
                                ?.querySelector<HTMLElement>(
                                  ".note-composer-text, [data-project-todo-id]",
                                )
                                ?.focus();
                            }
                          }}
                        />
                        {createMode === "sprout" && showProjectTodos ? (
                          <div
                            className="note-composer-checklist app-scrollbar"
                            data-project-todo-list
                          >
                            <p>
                              {appLanguage === "en"
                                ? "Small steps to get started"
                                : "Pequeños pasos para empezar"}
                            </p>
                            <DndContext
                              sensors={projectTodoSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleProjectTodoDragEnd}
                            >
                              <SortableContext
                                items={projectTodos.map((todo) => todo.id)}
                                strategy={verticalListSortingStrategy}
                              >
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
                                    onFocus={() => {}}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                            <button
                              type="button"
                              className="note-composer-add-step"
                              onClick={() => addProjectTodoAfter()}
                            >
                              <Plus size={17} />
                              {appLanguage === "en"
                                ? "Add garden task"
                                : "Agregar labor"}
                            </button>
                          </div>
                        ) : (
                          <textarea
                            className="note-composer-text app-scrollbar"
                            aria-label={
                              appLanguage === "en"
                                ? "Note content"
                                : "Contenido de la nota"
                            }
                            placeholder={
                              createMode === "journal"
                                ? quickEntryCopy.placeholder
                                : appLanguage === "en"
                                  ? "What’s on your mind?\nStart here. You can organize it later."
                                  : "¿Qué tienes en mente?\nEmpieza aquí. Puedes ordenarlo después."
                            }
                            autoCapitalize="sentences"
                            autoComplete="off"
                            spellCheck
                            data-quick-entry-autofocus="true"
                            value={newNote.content}
                            onChange={(event) =>
                              setNewNote((current) => ({
                                ...current,
                                content: event.target.value,
                              }))
                            }
                          />
                        )}
                      </div>

                      {showQuickEntryDetails && (
                        <div
                          id="note-composer-options"
                          className="note-composer-options app-scrollbar"
                        >
                          <label>
                            <span>
                              <Leaf size={15} />
                              {appLanguage === "en" ? "Garden" : "Jardín"}
                            </span>
                            <select
                              value={newNote.planetId}
                              onChange={(event) =>
                                setNewNote((current) => ({
                                  ...current,
                                  planetId: event.target.value,
                                }))
                              }
                            >
                              {planets.map((planet) => (
                                <option key={planet.id} value={planet.id}>
                                  {planet.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>
                              <Flag size={15} />
                              {appLanguage === "en" ? "Priority" : "Prioridad"}
                            </span>
                            <select
                              value={newNote.priority}
                              onChange={(event) =>
                                setNewNote((current) => ({
                                  ...current,
                                  priority: event.target
                                    .value as typeof newNote.priority,
                                }))
                              }
                            >
                              {PRIORITY_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {priorityLabel(option)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>
                              <CalendarIcon size={15} />
                              {appLanguage === "en" ? "Date" : "Fecha"}
                            </span>
                            <input
                              type="date"
                              value={newNote.dueDate}
                              onChange={(event) =>
                                setNewNote((current) => ({
                                  ...current,
                                  dueDate: event.target.value,
                                }))
                              }
                            />
                          </label>
                          {createMode === "seed" && (
                            <label>
                              <span>
                                <Tag size={15} />
                                {appLanguage === "en"
                                  ? "Category"
                                  : "Categoría"}
                              </span>
                              <select
                                value={newNote.seedType}
                                onChange={(event) =>
                                  setNewNote((current) => ({
                                    ...current,
                                    seedType: event.target
                                      .value as typeof newNote.seedType,
                                  }))
                                }
                              >
                                {SEED_TYPES.map((type) => (
                                  <option key={type.id} value={type.id}>
                                    {appLanguage === "en"
                                      ? gardenTypeName(type.id, appLanguage)
                                      : type.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      )}

                      <footer className="note-composer-footer">
                        <div className="note-composer-destination">
                          <Leaf size={16} />
                          <span>
                            {quickEntryPlanet?.name}
                            <small>
                              {createMode === "sprout"
                                ? appLanguage === "en"
                                  ? "Sprouts"
                                  : "Brotes"
                                : createMode === "journal"
                                  ? gardenName("harvest", appLanguage)
                                  : gardenName("inbox", appLanguage)}
                            </small>
                          </span>
                        </div>
                        <button
                          type="button"
                          className="note-composer-options-button"
                          aria-expanded={showQuickEntryDetails}
                          aria-controls="note-composer-options"
                          onClick={() => {
                            blurQuickEntryFocus();
                            setShowQuickEntryDetails((current) => !current);
                          }}
                        >
                          <Settings size={16} />
                          <span>
                            {appLanguage === "en" ? "Options" : "Opciones"}
                          </span>
                          {(newNote.dueDate ||
                            newNote.priority !== "normal") && (
                            <span className="note-composer-options-dot" />
                          )}
                        </button>
                      </footer>
                    </div>

                    {showDiscardConfirmation && (
                      <div className="note-composer-discard-backdrop">
                        <div
                          className="note-composer-discard"
                          role="alertdialog"
                          aria-modal="true"
                          aria-labelledby="discard-note-heading"
                          aria-describedby="discard-note-description"
                        >
                          <h3 id="discard-note-heading">
                            {appLanguage === "en"
                              ? "Leave this note?"
                              : "¿Salir de esta nota?"}
                          </h3>
                          <p id="discard-note-description">
                            {appLanguage === "en"
                              ? "Your text has not been saved yet."
                              : "Tu texto todavía no se ha guardado."}
                          </p>
                          <button
                            type="button"
                            autoFocus
                            className="note-composer-save"
                            onClick={() => setShowDiscardConfirmation(false)}
                          >
                            {appLanguage === "en"
                              ? "Keep writing"
                              : "Seguir escribiendo"}
                          </button>
                          <button
                            type="button"
                            className="note-composer-discard-button"
                            onClick={closeQuickEntry}
                          >
                            {appLanguage === "en"
                              ? "Discard note"
                              : "Descartar nota"}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.section>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

        {/* Floating Action Button */}
        {!isAdding &&
          view !== "focus" &&
          view !== "board" &&
          !showGardenFullscreen && (
            <>
              <AnimatePresence>
                {showCreateMenu && (
                  <>
                    <motion.button
                      type="button"
                      aria-label="Cerrar opciones de creación"
                      className="mobile-modal-overlay fixed inset-0 z-40 bg-black/[0.03] md:backdrop-blur-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      onClick={() => closeCreateMenu(true)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 24, scale: 0.78, rotate: -2 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: [0.78, 1.045, 0.985, 1],
                        rotate: [-2, 1.5, -0.5, 0],
                      }}
                      exit={{ opacity: 0, y: 12, scale: 0.92, rotate: -1 }}
                      transition={{
                        duration: 0.38,
                        ease: [0.18, 1.28, 0.32, 1],
                      }}
                      style={{ transformOrigin: "85% 100%" }}
                      className="mobile-modal-sheet fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-strong)]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.16)] md:bottom-24 md:right-8 md:backdrop-blur-2xl"
                    >
                      <div className="px-3 pb-2 pt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {appLanguage === "en"
                            ? "Choose capture type"
                            : "Elegir captura"}
                        </p>
                      </div>
                      {[
                        {
                          id: "seed" as const,
                          icon: Leaf,
                          title:
                            appLanguage === "en"
                              ? "Quick seed"
                              : "Semilla rápida",
                          detail:
                            appLanguage === "en"
                              ? "Capture now, decide later"
                              : "Captura ahora, decide después",
                        },
                        {
                          id: "sprout" as const,
                          icon: Sprout,
                          title:
                            appLanguage === "en"
                              ? "Small project"
                              : "Proyecto pequeño",
                          detail:
                            appLanguage === "en"
                              ? "Name it and add steps"
                              : "Nómbralo y agrega pasos",
                        },
                        {
                          id: "journal" as const,
                          icon: Sparkles,
                          title:
                            appLanguage === "en" ? "Learning" : "Aprendizaje",
                          detail:
                            appLanguage === "en"
                              ? "Save what it left you"
                              : "Guarda lo que te dejó",
                        },
                      ].map((item, index) => (
                        <motion.button
                          key={item.id}
                          type="button"
                          initial={{
                            opacity: 0,
                            y: 14,
                            scale: 0.9,
                            rotate: -1,
                          }}
                          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, y: 6, scale: 0.96 }}
                          transition={{
                            type: "spring",
                            stiffness: 520,
                            damping: 24,
                            mass: 0.72,
                            delay: 0.05 + index * 0.045,
                          }}
                          onClick={() => openCreateOption(item.id)}
                          className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-[var(--bg-app)] active:bg-[var(--bg-app)]"
                        >
                          <motion.span
                            initial={{ scale: 0.75 }}
                            animate={{ scale: [0.75, 1.14, 1] }}
                            transition={{
                              duration: 0.32,
                              delay: 0.08 + index * 0.055,
                            }}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-app)] text-[var(--sage)]"
                          >
                            <item.icon size={17} />
                          </motion.span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[var(--earth)]">
                              {item.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs font-medium text-[var(--text-muted)]">
                              {item.detail}
                            </span>
                          </span>
                          <ChevronRight
                            size={15}
                            className="text-[var(--text-muted)]"
                          />
                        </motion.button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
              <motion.div
                className="note-create-launcher"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
              >
                <button
                  type="button"
                  className="note-create-primary"
                  onClick={() => startPlanting()}
                >
                  <Plus size={21} strokeWidth={2.2} />
                  <span>{appLanguage === "en" ? "Plant" : "Plantar"}</span>
                </button>
                <button
                  type="button"
                  className="note-create-more"
                  aria-label={
                    appLanguage === "en"
                      ? "More creation options"
                      : "Más opciones de creación"
                  }
                  aria-expanded={showCreateMenu}
                  onClick={() => setShowCreateMenu((current) => !current)}
                >
                  {showCreateMenu ? <X size={19} /> : <ChevronDown size={19} />}
                </button>
              </motion.div>
            </>
          )}
      </main>
    </div>
  );
}
