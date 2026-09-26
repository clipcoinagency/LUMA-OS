// Global app state: boot status, settings and workspace (persisted through the db layer).
import { boot, loadState, saveSettings, saveWorkspace, type BootInfo } from './db/defaults';
import { setVersionChangeHandler, toStorageError, type StorageError } from './db/idb';
import type { Settings, ThemeId, Workspace } from './db/schema';
import { detectPlatform, requestPersistentStorage } from './platform/platform';

type Status = 'loading' | 'ready' | 'error';

class AppState {
  status = $state<Status>('loading');
  error = $state<StorageError | null>(null);
  settings = $state<Settings | null>(null);
  workspace = $state<Workspace | null>(null);
  firstRun = $state(false);
  launches = $state(0);
  staleWindow = $state(false);
  readonly platform = detectPlatform();

  async start() {
    this.status = 'loading';
    this.error = null;
    setVersionChangeHandler(() => { this.staleWindow = true; });
    try {
      const info: BootInfo = await boot();
      this.settings = info.settings;
      this.workspace = info.workspace;
      this.firstRun = info.firstRun;
      this.launches = info.launches;
      applyTheme(info.settings.theme, false);
      applyMotion(info.settings.reduceMotion);
      this.status = 'ready';
      // Durable storage where the browser grants it silently; never blocks (Firefox prompts).
      if (this.platform !== 'file') void requestPersistentStorage();
    } catch (e) {
      this.error = toStorageError(e);
      this.status = 'error';
    }
  }

  /** Re-reads settings/workspace after a restore or reset, without unmounting the UI. */
  async reload() {
    const s = await loadState();
    this.settings = s.settings;
    this.workspace = s.workspace;
    this.firstRun = s.firstRun;
    applyTheme(s.settings.theme, true);
    applyMotion(s.settings.reduceMotion);
  }

  async updateSettings(patch: Partial<Omit<Settings, 'id'>>) {
    if (patch.theme && patch.theme !== this.settings?.theme) applyTheme(patch.theme, true);
    if (patch.reduceMotion !== undefined) applyMotion(patch.reduceMotion);
    this.settings = await saveSettings(patch);
  }

  async updateWorkspace(patch: Partial<Omit<Workspace, 'id'>>) {
    this.workspace = await saveWorkspace(patch);
  }
}

export const app = new AppState();

const THEME_COLORS: Record<ThemeId, string> = { soft: '#fbf6f2', dark: '#060a13' };

export function applyTheme(theme: ThemeId, animate: boolean) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    setTimeout(() => root.classList.remove('theme-transition'), 400);
  }
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

export function applyMotion(reduce: boolean) {
  document.documentElement.dataset.reduceMotion = String(reduce);
}
