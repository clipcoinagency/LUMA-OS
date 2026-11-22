// System notifications, one API for every package:
//  • Android app → Android's own notifications (via the native bridge), which can also be scheduled
//    ahead so they ring with the app closed.
//  • Browsers (Windows/Mac file, hosted PWA, Android Chrome) → the web Notification API, which only
//    rings while Life OS is open (in front or in the background). Android Chrome refuses
//    `new Notification()` and needs the service worker to show it instead.
//  • iPhone/iPad Safari and others without the API → none (reminders still appear inside the app).
import { detectPlatform, nativeBridge, type NativeNote } from './platform/platform';

export type NotifyChannel = 'native' | 'web' | 'none';
export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';
export interface ShowNote { key: string; title: string; body: string; route?: string }

export async function notifyChannel(): Promise<NotifyChannel> {
  if (detectPlatform() === 'capacitor') return (await nativeBridge())?.notifications ? 'native' : 'none';
  return typeof Notification !== 'undefined' ? 'web' : 'none';
}

const fromNative = (s: string): NotifyPermission => (s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'default');

export async function notifyPermission(): Promise<NotifyPermission> {
  const ch = await notifyChannel();
  if (ch === 'native') return fromNative(await (await nativeBridge())!.notifications!.permission());
  if (ch === 'web') return Notification.permission as NotifyPermission;
  return 'unsupported';
}

/** Ask for permission — only ever call this from a deliberate user action (a switch or a button). */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  const ch = await notifyChannel();
  if (ch === 'native') return fromNative(await (await nativeBridge())!.notifications!.request());
  if (ch === 'web') return Notification.permission === 'default' ? ((await Notification.requestPermission()) as NotifyPermission) : (Notification.permission as NotifyPermission);
  return 'unsupported';
}

function open(route?: string) {
  try { window.focus(); } catch { /* ignore */ }
  if (route) location.hash = route;
}

/** Show a notification right now. Returns false when it can't (no permission / no support). */
export async function showNotification(n: ShowNote, nativeId: number): Promise<boolean> {
  const ch = await notifyChannel();
  if (ch === 'native') {
    if ((await notifyPermission()) !== 'granted') return false;
    await (await nativeBridge())!.notifications!.showNow({ id: nativeId, title: n.title, body: n.body, route: n.route });
    return true;
  }
  if (ch !== 'web' || Notification.permission !== 'granted') return false;
  try {
    const x = new Notification(n.title, { body: n.body, tag: n.key });
    x.onclick = () => { open(n.route); x.close(); };
    return true;
  } catch {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (!reg) return false;
    await reg.showNotification(n.title, { body: n.body, tag: n.key, data: { route: n.route ?? '' } });
    return true;
  }
}

/** Android app only: replace everything scheduled with this list. */
export async function scheduleNative(items: NativeNote[]): Promise<boolean> {
  const n = (await nativeBridge())?.notifications;
  if (!n) return false;
  await n.replaceAll(items);
  return true;
}

let tapWired = false;
/** Android app only: tapping a notification opens the page it's about. */
export async function wireNativeTaps() {
  if (tapWired) return;
  const n = (await nativeBridge())?.notifications;
  if (!n) return;
  tapWired = true;
  n.onTap((route) => open(route));
}
