import { newId } from '../util/ids';
import { nowIso, today } from '../util/dates';
import { DEFAULT_MODULES, type FinanceCategory, type ModuleId, type Settings, type WidgetId, type Workspace } from './schema';
import { get, getAll, put, putMany, transact } from './idb';

export const APP_VERSION = '2.0.0';

export function defaultCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const map: Record<string, string> = {
      US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', IN: 'INR', JP: 'JPY', CH: 'CHF', SE: 'SEK', NO: 'NOK',
      DK: 'DKK', PL: 'PLN', ZA: 'ZAR', SG: 'SGD', HK: 'HKD', AE: 'AED', SA: 'SAR', PK: 'PKR', BR: 'BRL', MX: 'MXN',
      PH: 'PHP', ID: 'IDR', MY: 'MYR', TH: 'THB', NG: 'NGN', KE: 'KES', TR: 'TRY',
    };
    const euro = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'HR'];
    if (region && euro.includes(region)) return 'EUR';
    return (region && map[region]) || 'USD';
  } catch {
    return 'USD';
  }
}

export function defaultSettings(): Settings {
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const imperial = /-(US|LR|MM)$/i.test(lang);
  return {
    id: 'settings',
    displayName: '',
    theme: typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'soft',
    currency: typeof navigator !== 'undefined' ? defaultCurrency() : 'USD',
    weekStartsOn: /-(US|CA|JP|BR|MX|PH|IL)$/i.test(lang) ? 0 : 1,
    locale: null,
    units: { weight: imperial ? 'lb' : 'kg', water: 'glasses' },
    reduceMotion: false,
    backupReminderDays: 14,
    updatedAt: nowIso(),
  };
}

/** Which dashboard widgets each module contributes, in default order. */
export const MODULE_WIDGETS: Record<ModuleId, WidgetId[]> = {
  tasks: ['today-tasks'],
  habits: ['habit-progress'],
  goals: ['goal-progress'],
  calendar: ['upcoming-events'],
  wellness: ['wellness-summary'],
  finance: ['finance-summary'],
  notes: ['recent-notes'],
  work: ['work-projects'],
  study: ['study-subjects', 'reading-now'],
};

export function defaultWorkspace(): Workspace {
  const modules = [...DEFAULT_MODULES];
  return {
    id: 'workspace',
    onboarded: false,
    enabledModules: modules,
    moduleOrder: modules,
    dashboardLayout: 'balanced',
    widgets: ['quick-actions', ...modules.flatMap((m) => MODULE_WIDGETS[m]), 'week-stats'],
    updatedAt: nowIso(),
  };
}

export function defaultFinanceCategories(): FinanceCategory[] {
  const at = nowIso();
  const mk = (name: string, type: FinanceCategory['type'], color: string, icon: string, order: number): FinanceCategory =>
    ({ id: newId('cat'), name, type, color, icon, order, archived: false, createdAt: at, updatedAt: at });
  return [
    mk('Salary', 'income', '#3aa57a', 'briefcase', 0),
    mk('Other income', 'income', '#56b6a0', 'plus-circle', 1),
    mk('Housing', 'expense', '#8c7ae6', 'home', 2),
    mk('Groceries', 'expense', '#e0906f', 'shopping-basket', 3),
    mk('Eating out', 'expense', '#e36d8a', 'utensils', 4),
    mk('Transport', 'expense', '#5aa2e0', 'car', 5),
    mk('Bills & utilities', 'expense', '#c9a227', 'receipt', 6),
    mk('Health', 'expense', '#4fbfa8', 'heart-pulse', 7),
    mk('Shopping', 'expense', '#d47fc1', 'shopping-bag', 8),
    mk('Fun', 'expense', '#f0a94a', 'party-popper', 9),
    mk('Other', 'expense', '#9aa3b2', 'circle', 10),
    mk('Savings', 'saving', '#2f8fbd', 'piggy-bank', 11),
  ];
}

export interface BootInfo {
  settings: Settings;
  workspace: Workspace;
  firstRun: boolean;
  launches: number;
}

/** Loads settings + workspace, creating defaults when missing (first run, or after a reset). */
export async function loadState(): Promise<Omit<BootInfo, 'launches'>> {
  let settings = await get('settings', 'settings');
  let workspace = await get('workspace', 'workspace');
  const firstRun = !settings || !workspace;
  if (!settings) { settings = defaultSettings(); await put('settings', settings); }
  if (!workspace) { workspace = defaultWorkspace(); await put('workspace', workspace); }
  if (firstRun && (await getAll('finance_categories')).length === 0) await putMany('finance_categories', defaultFinanceCategories());
  return { settings, workspace, firstRun };
}

/** Opens the database, seeds defaults on first run, records a launch. */
export async function boot(): Promise<BootInfo> {
  const { settings, workspace, firstRun } = await loadState();
  const launches = await transact<number>('meta', 'readwrite', (t, set) => {
    const os = t.objectStore('meta');
    os.get('launches').onsuccess = (e) => {
      const n = (((e.target as IDBRequest).result?.value as number) ?? 0) + 1;
      os.put({ key: 'launches', value: n });
      os.put({ key: 'lastOpenedAt', value: nowIso() });
      set(n);
    };
    os.get('installedAt').onsuccess = (e) => {
      if (!(e.target as IDBRequest).result) os.put({ key: 'installedAt', value: nowIso() });
    };
    os.put({ key: 'appVersion', value: APP_VERSION });
  });
  return { settings, workspace, firstRun, launches };
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const cur = (await get('settings', 'settings')) ?? defaultSettings();
  const next: Settings = { ...cur, ...patch, id: 'settings', updatedAt: nowIso() };
  await put('settings', next);
  return next;
}

export async function saveWorkspace(patch: Partial<Omit<Workspace, 'id'>>): Promise<Workspace> {
  const cur = (await get('workspace', 'workspace')) ?? defaultWorkspace();
  const next: Workspace = { ...cur, ...patch, id: 'workspace', updatedAt: nowIso() };
  await put('workspace', next);
  return next;
}

export { today };
