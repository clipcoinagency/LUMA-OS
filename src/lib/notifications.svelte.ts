// Reminder engine. One plan (domain/notifyPlan.ts), two ways of delivering it:
//  • In the page (browsers): every 30 s, whatever just came due rings once — a system notification
//    when Life OS is in the background, a toast when you are looking at it. Only while it's open.
//  • Android app: the next 7 days of the plan are handed to Android's alarm scheduler, re-planned
//    after every change and whenever the app goes to the background — so they ring with it closed.
// Task reminders keep their own popup (reminders.svelte.ts); this adds events, habits, the morning
// briefing, the Weekly Reset and focus-finished, and puts task reminders on the Android schedule.
import { app } from './app.svelte';
import { changes } from './db/changes.svelte';
import type { NotifyPrefs } from './db/schema';
import { buildHeadline, loadHomeSnapshot, timeLabel } from './domain/home';
import { listTasks } from './domain/tasks';
import { loadActive, remainingMs } from './domain/focus';
import { inResetSeason } from './domain/review';
import { DEFAULT_NOTIFY, idFor, keyOf, planNotifications, type PlanInput, type Planned } from './domain/notifyPlan';
import { notifyChannel, notifyPermission, scheduleNative, showNotification, wireNativeTaps } from './notify';
import { toast } from './ui/toast.svelte';
import { detectPlatform } from './platform/platform';

const LOOKBACK_MS = 15 * 60_000;     // a background tab may be throttled; still ring if we're a little late
const NATIVE_DAYS = 7;
const NATIVE_MAX = 60;

export function notifyPrefs(): NotifyPrefs { return { ...DEFAULT_NOTIFY, ...(app.settings?.notify ?? {}) }; }
/** Task reminders were system notifications before this page existed — keep that for anyone who
 *  never opened it; once they have, their switch decides. */
export function taskNotificationsOn(): boolean { const n = app.settings?.notify; return n ? n.enabled && n.tasks : true; }
export function focusNotificationsOn(): boolean { const n = app.settings?.notify; return n ? n.enabled && n.focus : true; }
/** Android app with reminders set up: task and focus alerts are already on Android's own schedule. */
export function nativeSchedules(): boolean { return detectPlatform() === 'capacitor' && !!app.settings?.notify?.enabled; }

async function gather(fromMs: number, toMs: number): Promise<PlanInput | null> {
  const st = app.settings, ws = app.workspace;
  if (!st || !ws) return null;
  const now = new Date();
  const [snap, tasks, active] = await Promise.all([
    loadHomeSnapshot({ enabled: ws.enabledModules, name: st.displayName, currency: st.currency, weekStartsOn: st.weekStartsOn, focusTargetMin: st.focusTargetMin }),
    listTasks(),
    loadActive(),
  ]);
  const nowMs = now.getTime();
  return {
    now, fromMs, toMs, prefs: notifyPrefs(), tasksOn: taskNotificationsOn(), weekStartsOn: st.weekStartsOn, name: st.displayName,
    tasks, events: snap.events,
    habitsActive: snap.habits.length > 0,
    habitsOpenToday: snap.habits.filter((h) => h.dueToday && !h.doneToday).map((h) => h.name),
    headlineToday: buildHeadline(snap),
    resetDoneThisWeek: inResetSeason(keyOf(now), st.weekStartsOn) && snap.reset === null,
    focus: active && !active.pausedAt ? { endsAt: nowMs + remainingMs(active, nowMs), label: active.label, key: `focus|${active.startedAt}` } : null,
    timeLabel,
  };
}

// ---------------------------------------------------------------- in-page engine

const FIRED = 'lifeos.notified';
function fired(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(FIRED) ?? '{}') as Record<string, number>; } catch { return memo; }
}
let memo: Record<string, number> = {};
function markFired(key: string) {
  const all = fired();
  const cutoff = Date.now() - 3 * 86_400_000;
  for (const k of Object.keys(all)) if (all[k]! < cutoff) delete all[k];
  all[key] = Date.now();
  memo = all;
  try { localStorage.setItem(FIRED, JSON.stringify(all)); } catch { /* private mode: in-memory only */ }
}

async function ring(n: Planned) {
  markFired(n.key);
  if (!document.hidden) { toast(`${n.title} — ${n.body}`, { ms: 8000 }); return; }
  await showNotification({ key: n.key, title: n.title, body: n.body, route: n.route }, idFor(n.key));
}

async function tick() {
  if (!notifyPrefs().enabled || (await notifyChannel()) === 'native') return;
  const now = Date.now();
  const input = await gather(now - LOOKBACK_MS, now + 1);
  if (!input) return;
  const done = fired();
  // task reminders have their own popup and focus has its own chime; this engine adds the rest
  for (const n of planNotifications(input)) if (!done[n.key] && !n.key.startsWith('task|') && !n.key.startsWith('focus|')) await ring(n);
}

// ---------------------------------------------------------------- Android engine

let replanTimer: ReturnType<typeof setTimeout> | null = null;
export function replanSoon(ms = 1500) {
  if (replanTimer) clearTimeout(replanTimer);
  replanTimer = setTimeout(() => { replanTimer = null; void replanNative(); }, ms);
}

async function replanNative() {
  // Only once the user has set reminders up (Settings → Reminders & notifications, in the new looks):
  // until then the Android bridge stays unloaded, exactly as before (it loads on the first backup save).
  const n = app.settings?.notify;
  if (!n) return;
  if ((await notifyChannel()) !== 'native') return;
  void wireNativeTaps();
  if (!n.enabled || (await notifyPermission()) !== 'granted') { await scheduleNative([]); return; }
  const now = Date.now();
  const input = await gather(now + 5_000, now + NATIVE_DAYS * 86_400_000);
  if (!input) return;
  const items = planNotifications(input).slice(0, NATIVE_MAX);
  await scheduleNative(items.map((n) => ({ id: idFor(n.key), title: n.title, body: n.body, at: n.at, route: n.route })));
}

let started = false;
export function initNotifications() {
  if (started || typeof window === 'undefined') return;
  started = true;
  void tick();
  setInterval(() => void tick(), 30_000);
  replanSoon(3000);
  setInterval(() => void replanNative(), 10 * 60_000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) void replanNative(); else void tick(); });
  let last = changes.version;
  setInterval(() => { if (changes.version !== last) { last = changes.version; replanSoon(); } }, 2000);
}
