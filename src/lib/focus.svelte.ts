// Reactive controller for Focus Mode: one running session at a time, parked in IndexedDB so it
// survives reloads, ticking from timestamps (see domain/focus.ts). The overlay and the little
// "session in progress" pill both read from here.
import {
  clearActive, elapsedMs, formatClock, loadActive, pausedState, progressOf, recordSession, remainingMs, resumedState, saveActive, targetMs,
  type ActiveFocus,
} from './domain/focus';
import { setTaskDone } from './domain/tasks';
import { playSessionDone } from './sound';
import { toast } from './ui/toast.svelte';
import { formatMinutes } from './domain/focus';

export interface StartInput { label: string; plannedMin: number; taskId?: string | null; projectId?: string | null }

class FocusController {
  active = $state<ActiveFocus | null>(null);
  open = $state(false);          // the full-screen overlay (picker or running view)
  now = $state(Date.now());
  /** The planned time was reached and the person hasn't chosen what to do next. */
  reached = $state(false);
  private timer: ReturnType<typeof setInterval> | null = null;
  private wake: WakeLockSentinel | null = null;
  private baseTitle = typeof document !== 'undefined' ? document.title : 'Life OS';

  get running() { return !!this.active && !this.active.pausedAt; }
  get remaining() { return this.active ? remainingMs(this.active, this.now) : 0; }
  get elapsed() { return this.active ? elapsedMs(this.active, this.now) : 0; }
  get progress() { return this.active ? progressOf(this.active, this.now) : 0; }
  get clock() { return formatClock(this.remaining); }
  get targetMin() { return this.active ? targetMs(this.active) / 60_000 : 0; }

  /** Restores a session that was running when the page was closed/reloaded. */
  async restore() {
    if (this.active) return;
    const a = await loadActive();
    if (!a) return;
    this.active = a;
    this.now = Date.now();
    this.afterChange();
  }

  show() { this.open = true; }
  hide() { this.open = false; void this.releaseScreen(); }

  async start(input: StartInput) {
    if (this.active) { this.open = true; return; }
    const a: ActiveFocus = {
      startedAt: new Date().toISOString(), plannedMin: Math.max(1, Math.round(input.plannedMin)), extraMin: 0,
      taskId: input.taskId ?? null, projectId: input.projectId ?? null, label: input.label.trim() || 'Focus', pausedAt: null, pausedMs: 0,
    };
    this.active = a;
    this.reached = false;
    this.now = Date.now();
    this.open = true;
    await saveActive(a);
    this.afterChange();
  }

  /** Start from anywhere: opens the overlay straight on a task (or on the picker). */
  openFor(task?: { id: string; title: string; projectId?: string | null }) {
    if (this.active) { this.open = true; return; }
    this.preselect = task ? { id: task.id, title: task.title, projectId: task.projectId ?? null } : null;
    this.open = true;
  }
  preselect = $state<{ id: string; title: string; projectId: string | null } | null>(null);

  async pause() {
    if (!this.active || this.active.pausedAt) return;
    this.active = pausedState(this.active, Date.now());
    this.now = Date.now();
    await saveActive(this.active);
    this.afterChange();
  }

  async resume() {
    if (!this.active?.pausedAt) return;
    this.active = resumedState(this.active, Date.now());
    this.now = Date.now();
    await saveActive(this.active);
    this.afterChange();
  }

  async extend(min = 5) {
    if (!this.active) return;
    this.active = { ...this.active, extraMin: this.active.extraMin + min };
    this.reached = false;
    await saveActive(this.active);
    this.afterChange();
  }

  /** End the session: logs it (if it was long enough) and optionally ticks the task off. */
  async finish({ completeTask = false } = {}) {
    const a = this.active;
    if (!a) return;
    const at = Date.now();
    this.active = null;
    this.reached = false;
    this.open = false;
    this.stopTimer();
    await clearActive();
    const s = await recordSession(a, at);
    if (completeTask && a.taskId) await setTaskDone(a.taskId, true);
    this.afterChange();
    toast(s ? `Logged ${formatMinutes(s.seconds / 60)} of focus${completeTask ? ' · task done' : ''}` : 'Session too short to log');
  }

  /** Throw the session away without logging it. */
  async discard() {
    this.active = null;
    this.reached = false;
    this.open = false;
    this.stopTimer();
    await clearActive();
    this.afterChange();
  }

  // ---------------------------------------------------------------- internals
  private afterChange() {
    const live = this.running;
    if (live) this.startTimer(); else this.stopTimer();
    this.syncTitle();
    if (live && this.open) void this.holdScreen(); else if (!live) void this.releaseScreen();
  }

  private startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.now = Date.now();
      this.syncTitle();
      if (this.active && !this.reached && remainingMs(this.active, this.now) === 0 && !this.active.pausedAt) {
        this.reached = true;
        playSessionDone();
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('Focus session complete', { body: this.active.label, tag: 'focus' });
      }
    }, 250);
  }
  private stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  private syncTitle() {
    if (typeof document === 'undefined') return;
    document.title = this.active ? `${this.reached ? '✓' : this.clock} · ${this.active.label}` : this.baseTitle;
  }
  async holdScreen() {
    try {
      if (this.wake || !('wakeLock' in navigator)) return;
      this.wake = await navigator.wakeLock.request('screen');
      this.wake.addEventListener('release', () => { this.wake = null; });
    } catch { /* not allowed (battery saver / unsupported) — the timer still runs */ }
  }
  async releaseScreen() {
    try { await this.wake?.release(); } catch { /* ignore */ }
    this.wake = null;
  }
}

export const focus = new FocusController();

if (typeof document !== 'undefined') {
  // the screen lock is released whenever the page is hidden; take it back when we return
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && focus.running && focus.open) void focus.holdScreen();
    if (!document.hidden) focus.now = Date.now();
  });
}
