// Life OS data schema — version 2 (v2 adds projects, focus_sessions and reviews; every v1 store is
// untouched and every field added to a v1 record type is optional, so v1 data and v1 backups load as-is).
//
// Rules (from Phase 0):
//  • History is never overwritten: every historical fact is its own dated row (habit log, goal
//    check-in, wellness day, transaction, task completion) so any past day can be reconstructed.
//  • Calendar days are local DateKeys ("YYYY-MM-DD"); moments are ISO UTC timestamps.
//  • Money is integer minor units + currency code.
//  • SCHEMA_VERSION only increases. Changing a store = a new migration step, never an edit of v1.

import type { DateKey } from '../util/dates';

export const DB_NAME = 'lifeos';
export const SCHEMA_VERSION = 2;

export const MODULE_IDS = ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance', 'work', 'study'] as const;
/** The areas switched on for a brand-new workspace (Work and Study are opt-in). */
export const DEFAULT_MODULES: readonly ModuleId[] = ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance'];
export type ModuleId = (typeof MODULE_IDS)[number];

export type ThemeId = 'soft' | 'dark';

// ---------------------------------------------------------------- records

interface Stamped {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface Settings {
  id: 'settings';
  displayName: string;
  theme: ThemeId;
  currency: string;
  weekStartsOn: 0 | 1;
  locale: string | null;          // null = device default
  units: { weight: 'kg' | 'lb'; water: 'ml' | 'oz' | 'glasses' };
  reduceMotion: boolean;          // in addition to the OS setting
  backupReminderDays: number;     // 0 = off
  focusTargetMin?: number;        // daily focus goal in minutes (default 120)
  updatedAt: string;
}

export type WidgetId =
  | 'today-tasks' | 'habit-progress' | 'goal-progress' | 'upcoming-events'
  | 'wellness-summary' | 'finance-summary' | 'recent-notes' | 'quick-actions' | 'week-stats' | 'work-projects' | 'study-subjects';

export interface Workspace {
  id: 'workspace';
  onboarded: boolean;
  enabledModules: ModuleId[];
  moduleOrder: ModuleId[];
  dashboardLayout: 'focus' | 'balanced' | 'compact';
  widgets: WidgetId[];            // ordered; filtered by enabled modules at render time
  persona?: string | null;        // v2: the starting point chosen in onboarding (informational)
  updatedAt: string;
}

export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface Task extends Stamped {
  title: string;
  notes: string;
  priority: Priority;
  dueDate: DateKey | null;
  dueTime: string | null;         // "HH:MM" 24h — only meaningful when dueDate is set
  reminder: boolean;              // ring an alert at dueTime, once
  remindedOn: DateKey | null;     // the day this reminder last fired (prevents re-firing same day)
  tags: string[];
  projectId?: string | null;      // v2: the project / subject this belongs to
  done: boolean;
  completedOn: DateKey | null;    // the day it was ticked off (history)
  createdOn: DateKey;
}

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  doneOn: DateKey | null;
}

export interface Goal extends Stamped {
  title: string;
  description: string;
  target: number | null;          // null = milestone-only goal
  unit: string;
  current: number;
  deadline: DateKey | null;
  status: 'active' | 'completed' | 'paused' | 'archived';
  milestones: Milestone[];
  createdOn: DateKey;
  completedOn: DateKey | null;
}

/** One check-in per change → progress history for any past date. */
export interface GoalProgress extends Stamped {
  goalId: string;
  date: DateKey;
  value: number;                  // the goal's value after this check-in
  note: string;
}

export type HabitFrequency =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] }      // 0 = Sun … 6 = Sat
  | { kind: 'times-per-week'; times: number };

export interface Habit extends Stamped {
  name: string;
  frequency: HabitFrequency;
  color: string;
  icon: string;
  archived: boolean;
  order: number;
  createdOn: DateKey;
}

/** One row per habit per completed day. id = `${habitId}|${date}` so a day can't be double-logged. */
export interface HabitLog {
  id: string;
  habitId: string;
  date: DateKey;
  createdAt: string;
}

export interface CalendarEvent extends Stamped {
  title: string;
  date: DateKey;
  allDay: boolean;
  startTime: string | null;       // "HH:MM" local
  endTime: string | null;
  notes: string;
  color: string;
  kind?: EventKind;               // v2: meeting / exam / deadline are events with a purpose
  projectId?: string | null;
}

export type EventKind = 'event' | 'meeting' | 'exam' | 'deadline';

export interface Note extends Stamped {
  title: string;
  content: string;
  date: DateKey;                  // the day it belongs to (defaults to created day)
  pinned: boolean;
  tags: string[];
  kind?: 'note' | 'journal';       // v2: a journal entry is a dated note with a mood
  mood?: 1 | 2 | 3 | 4 | 5 | null;
  projectId?: string | null;
}

/** One row per day (id = date). */
export interface WellnessDay {
  id: DateKey;
  date: DateKey;
  water: number | null;           // in settings.units.water
  sleepHours: number | null;
  mood: 1 | 2 | 3 | 4 | 5 | null;
  steps: number | null;
  weight: number | null;          // in settings.units.weight
  calories?: number | null;       // v2
  note: string;
  updatedAt: string;
}

export interface Workout extends Stamped {
  date: DateKey;
  type: string;
  durationMin: number;
  intensity: 'easy' | 'moderate' | 'hard' | null;
  note: string;
}

export type TransactionType = 'income' | 'expense' | 'saving';

export interface Transaction extends Stamped {
  date: DateKey;
  type: TransactionType;
  amountMinor: number;            // always positive; type gives the direction
  currency: string;
  categoryId: string | null;
  note: string;
}

export interface FinanceCategory extends Stamped {
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  order: number;
  archived: boolean;
  budgetMinor?: number | null;    // v2: monthly budget for an expense category
}

// ---------------------------------------------------------------- v2 records

/** A work project or a study subject — the container between a Goal and its Tasks. */
export interface Project extends Stamped {
  title: string;
  kind: 'work' | 'study';
  color: string;
  client: string;                 // work: who it's for · study: the instructor / course code
  deadline: DateKey | null;
  status: 'active' | 'done' | 'archived';
  goalId: string | null;          // the goal this serves
  notes: string;
  createdOn: DateKey;
}

/** One finished (or stopped) focus session. Recorded once, when it ends. */
export interface FocusSession {
  id: string;
  date: DateKey;                  // local day it started
  startedAt: string;
  endedAt: string;
  seconds: number;                // time actually focused (pauses excluded)
  plannedMin: number;
  taskId: string | null;
  projectId: string | null;
  label: string;                  // what it was for, kept even if the task is later deleted
  createdAt: string;
}

/** A completed Weekly Reset. id = reviewed week's start date, so redoing a week replaces it. */
export interface WeeklyReview extends Stamped {
  date: DateKey;                  // start of the week that was reviewed
  planWeek: DateKey;              // start of the week that was planned
  priorities: { title: string; taskId: string | null; day: DateKey | null }[];
  wins: string[];
  reflection: string;
  focusGoalMin: number;
  snapshot: { tasksDone: number; habitRate: number | null; focusMin: number; spentMinor: number | null; moodAvg: number | null };
}

/** Automatic safety copies taken before restore/migration/reset (never exported). */
export interface SafetySnapshot {
  id: string;
  createdAt: string;
  reason: 'before-restore' | 'before-migration' | 'before-reset';
  appVersion: string;
  schemaVersion: number;
  backup: unknown;
}

// ---------------------------------------------------------------- stores

export interface StoreRecordMap {
  meta: MetaRow;
  settings: Settings;
  workspace: Workspace;
  tasks: Task;
  goals: Goal;
  goal_progress: GoalProgress;
  habits: Habit;
  habit_logs: HabitLog;
  events: CalendarEvent;
  notes: Note;
  wellness: WellnessDay;
  workouts: Workout;
  transactions: Transaction;
  finance_categories: FinanceCategory;
  projects: Project;
  focus_sessions: FocusSession;
  reviews: WeeklyReview;
  safety: SafetySnapshot;
}
export type StoreName = keyof StoreRecordMap;

interface StoreDef {
  keyPath: string;
  indexes: Record<string, string>;
  /** Field that must be a valid DateKey on every row (validated on restore). */
  dateField?: string;
  /** Owning module: its data is removed by "reset module" and hidden when disabled. */
  module?: ModuleId;
  /** Excluded from backups (device-local). */
  local?: boolean;
}

export const STORES: Record<StoreName, StoreDef> = {
  meta: { keyPath: 'key', indexes: {} },
  settings: { keyPath: 'id', indexes: {} },
  workspace: { keyPath: 'id', indexes: {} },
  tasks: { keyPath: 'id', indexes: { by_due: 'dueDate', by_completed: 'completedOn', by_created: 'createdOn' }, dateField: 'createdOn', module: 'tasks' },
  goals: { keyPath: 'id', indexes: { by_status: 'status', by_deadline: 'deadline' }, dateField: 'createdOn', module: 'goals' },
  goal_progress: { keyPath: 'id', indexes: { by_goal: 'goalId', by_date: 'date' }, dateField: 'date', module: 'goals' },
  habits: { keyPath: 'id', indexes: { by_order: 'order' }, dateField: 'createdOn', module: 'habits' },
  habit_logs: { keyPath: 'id', indexes: { by_habit: 'habitId', by_date: 'date' }, dateField: 'date', module: 'habits' },
  events: { keyPath: 'id', indexes: { by_date: 'date' }, dateField: 'date', module: 'calendar' },
  notes: { keyPath: 'id', indexes: { by_date: 'date', by_updated: 'updatedAt' }, dateField: 'date', module: 'notes' },
  wellness: { keyPath: 'id', indexes: { by_date: 'date' }, dateField: 'date', module: 'wellness' },
  workouts: { keyPath: 'id', indexes: { by_date: 'date' }, dateField: 'date', module: 'wellness' },
  transactions: { keyPath: 'id', indexes: { by_date: 'date', by_category: 'categoryId' }, dateField: 'date', module: 'finance' },
  finance_categories: { keyPath: 'id', indexes: { by_order: 'order' }, module: 'finance' },
  projects: { keyPath: 'id', indexes: { by_kind: 'kind', by_status: 'status' }, dateField: 'createdOn' },
  focus_sessions: { keyPath: 'id', indexes: { by_date: 'date', by_task: 'taskId' }, dateField: 'date' },
  reviews: { keyPath: 'id', indexes: { by_date: 'date' }, dateField: 'date' },
  safety: { keyPath: 'id', indexes: { by_created: 'createdAt' }, local: true },
};

/** Stores that exist since schema v2 (migration 2 creates exactly these). */
export const V2_STORES: StoreName[] = ['projects', 'focus_sessions', 'reviews'];

export const STORE_NAMES = Object.keys(STORES) as StoreName[];
export const BACKUP_STORES = STORE_NAMES.filter((s) => !STORES[s].local);
/** Stores holding configuration rather than user entries (not counted as "records"). */
export const CONFIG_STORES: StoreName[] = ['meta', 'settings', 'workspace', 'finance_categories'];

/** meta keys that describe this device, not the user's workspace — never exported/restored. */
export const DEVICE_META_KEYS = ['launches', 'installedAt', 'lastOpenedAt', 'persistRequested', 'lastBackupAt', 'lastRestoreAt', 'lastResetAt', 'backupReminderSnoozedAt', 'activeFocus'];
