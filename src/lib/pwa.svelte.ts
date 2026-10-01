// Progressive-web-app support for the hosted build only. The single-file builds (file://, desktop,
// Android shell) never register anything — the manifest and service worker live next to index.html
// on the web host (see scripts/vercel-assemble.mjs), so a missing file there can't produce errors.
import { detectPlatform, isIOS, isStandalone } from './platform/platform';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PwaState {
  private deferred = $state<InstallPromptEvent | null>(null);
  installed = $state(typeof window !== 'undefined' ? isStandalone() : false);
  readonly hosted = typeof window !== 'undefined' && detectPlatform() === 'web';

  /** The browser offered a one-tap install (Chrome/Edge/Android). */
  get canInstall() { return this.hosted && !this.installed && this.deferred !== null; }
  /** iPhone/iPad Safari has no prompt: show "Share → Add to Home Screen" instead. */
  get iosHint() { return this.hosted && !this.installed && typeof navigator !== 'undefined' && isIOS(); }

  async install(): Promise<boolean> {
    const e = this.deferred;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    this.deferred = null;
    if (outcome === 'accepted') this.installed = true;
    return outcome === 'accepted';
  }

  /** @internal */ _capture(e: Event) { e.preventDefault(); this.deferred = e as InstallPromptEvent; }
  /** @internal */ _installed() { this.installed = true; this.deferred = null; }
}

export const pwa = new PwaState();

export function initPwa() {
  if (typeof window === 'undefined' || !pwa.hosted) return;
  window.addEventListener('beforeinstallprompt', (e) => pwa._capture(e));
  window.addEventListener('appinstalled', () => pwa._installed());
  matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => { if (e.matches) pwa._installed(); });
  if (!import.meta.env.PROD) return; // never cache the dev server

  const head = document.head;
  const add = (rel: string, href: string) => { const l = document.createElement('link'); l.rel = rel; l.href = href; head.appendChild(l); };
  add('manifest', './manifest.webmanifest');
  add('apple-touch-icon', './apple-touch-icon.png');
  if ('serviceWorker' in navigator) {
    const register = () => { navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Offline support unavailable:', e)); };
    // the module script can run after `load` has already fired, so don't rely on the event alone
    if (document.readyState === 'complete') register(); else window.addEventListener('load', register);
  }
}
