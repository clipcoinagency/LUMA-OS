// Task reminders: polls open tasks for ones whose reminder time has arrived, queues them for the
// ReminderAlert popup, and marks them fired so they don't repeat. Runs entirely client-side — there
// is no backend, so a reminder only fires while this tab is open (the honest limit of a local-first,
// no-account app). Mirrors clock.svelte.ts's polling shape.
import { isReminderDue, listTasks, markReminded } from './domain/tasks';
import { today } from './util/dates';
import { changes } from './db/changes.svelte';
import type { Task } from './db/schema';

export const dueReminders = $state<Task[]>([]);
const queuedIds = new Set<string>();
let started = false;

function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// A short two-note chime via the Web Audio API — no external asset, so it stays inside the
// single-file build. Browsers block audio before any user gesture on the page; by the time a
// reminder can fire the user has always already interacted with the app (added the task, at
// least), so this reliably plays. If it's still blocked for some reason, the visual popup alone
// is a fine fallback — never let a sound failure stop the reminder from showing.
function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = start + i * 0.18;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.42);
    }
    setTimeout(() => void ctx.close(), 900);
  } catch { /* audio unavailable/blocked — the visual popup still shows */ }
}

async function check() {
  const day = today();
  const hm = nowHM();
  const tasks = await listTasks();
  const due = tasks.filter((t) => !queuedIds.has(t.id) && isReminderDue(t, day, hm));
  if (!due.length) return;
  for (const t of due) {
    queuedIds.add(t.id);
    dueReminders.push(t);
    void markReminded(t.id, day);
  }
  playChime();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    for (const t of due) new Notification('Life OS reminder', { body: t.title, tag: t.id });
  }
}

/** Removes a task from the on-screen queue (dismiss, mark done, or snooze already handled it). */
export function clearReminder(id: string) {
  queuedIds.delete(id);
  const i = dueReminders.findIndex((t) => t.id === id);
  if (i !== -1) dueReminders.splice(i, 1);
}

export function initReminders() {
  if (started || typeof window === 'undefined') return;
  started = true;
  void check();
  setInterval(() => void check(), 20_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  // Picking up a task edited/created elsewhere (e.g. a reminder time moved earlier) shouldn't
  // have to wait for the next 20s tick.
  let lastVersion = changes.version;
  setInterval(() => { if (changes.version !== lastVersion) { lastVersion = changes.version; void check(); } }, 2000);
}

/** Requests OS notification permission — call only from a deliberate user action (e.g. turning the
 *  reminder toggle on), never automatically, per browser policy and good practice alike. */
export function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
}
