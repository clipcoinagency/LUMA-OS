// Life OS data schema — version 1.
//
// Rules (from Phase 0):
//  • History is never overwritten: every historical fact is its own dated row (habit log, goal
//    check-in, wellness day, transaction, task completion) so any past day can be reconstructed.
//  • Calendar days are local DateKeys ("YYYY-MM-DD"); moments are ISO UTC timestamps.
//  • Money is integer minor units + currency code.
//  • SCHEMA_VERSION only increases. Changing a store = a new migration step, never an edit of v1.

import type { DateKey } from '../util/dates';

export const DB_NAME = 'lifeos';
export const SCHEMA_VERSION = 1;

export const MODULE_IDS = ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance'] as const;
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
  updatedAt: string;
}

export type WidgetId =
  | 'today-tasks' | 'habit-progress' | 'goal-progress' | 'upcoming-events'
  | 'wellness-summary' | 'finance-summary' | 'recent-notes' | 'quick-actions' | 'week-stats';

export interface Workspace {
  id: 'workspace';
  onboarded: boolean;
  enabledModules: ModuleId[];
  moduleOrder: ModuleId[];
  dashboardLayout: 'focus' | 'balanced' | 'compact';
  widgets: WidgetId[];            // ordered; filtered by enabled modules at render time
  updatedAt: string;
}

export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface Task extends Stamped {
  title: string;
  notes: string;
  priority: Priority;
  dueDate: DateKey | null;
  tags: string[];
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
}

export interface Note extends Stamped {
  title: string;
  content: string;
  date: DateKey;                  // the day it belongs to (defaults to created day)
  pinned: boolean;
  tags: string[];
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
  safety: { keyPath: 'id', indexes: { by_created: 'createdAt' }, local: true },
};

export const STORE_NAMES = Object.keys(STORES) as StoreName[];
export const BACKUP_STORES = STORE_NAMES.filter((s) => !STORES[s].local);

/** meta keys that describe this device, not the user's workspace — never exported/restored. */
export const DEVICE_META_KEYS = ['launches', 'installedAt', 'lastOpenedAt', 'persistRequested', 'lastBackupAt', 'lastRestoreAt', 'lastResetAt'];
