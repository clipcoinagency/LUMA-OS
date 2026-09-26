// The ONLY per-platform code. Everything else is identical on every package (Phase 0 decision).

export type Platform = 'file' | 'web' | 'tauri' | 'capacitor';

interface TauriGlobal {
  dialog?: { save(opts: unknown): Promise<string | null> };
  fs?: { writeTextFile(path: string, text: string): Promise<void> };
}
interface NativeBridge {
  saveTextFile(name: string, text: string): Promise<SaveResult>;
}
declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
    __TAURI_INTERNALS__?: unknown;
    Capacitor?: { getPlatform?: () => string };
    androidBridge?: unknown;
    LifeOSNative?: NativeBridge;
  }
}

export interface SaveResult {
  ok: boolean;
  cancelled?: boolean;
  where?: string;
}

export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';
  if (window.__TAURI__ || window.__TAURI_INTERNALS__) return 'tauri';
  const cap = window.Capacitor;
  if (cap && ((cap.getPlatform && cap.getPlatform() !== 'web') || window.androidBridge)) return 'capacitor';
  return location.protocol === 'file:' ? 'file' : 'web';
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function download(name: string, text: string): SaveResult {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { ok: true, where: 'your Downloads folder' };
}

export async function saveTextFile(name: string, text: string): Promise<SaveResult> {
  const platform = detectPlatform();
  if (platform === 'tauri') {
    const T = window.__TAURI__;
    if (T?.dialog && T.fs) {
      const path = await T.dialog.save({ defaultPath: name, filters: [{ name: 'Life OS backup', extensions: ['json'] }] });
      if (!path) return { ok: false, cancelled: true };
      await T.fs.writeTextFile(path, text);
      return { ok: true, where: path };
    }
    return download(name, text);
  }
  if (platform === 'capacitor' && window.LifeOSNative) return window.LifeOSNative.saveTextFile(name, text);
  if (isIOS() && typeof navigator.canShare === 'function') {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return { ok: true, where: 'the place you chose' };
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return { ok: false, cancelled: true };
      }
    }
  }
  return download(name, text);
}

/** Opens the system file picker; resolves null if the user cancels. */
export function pickTextFile(accept = '.json,application/json'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const done = (f: File | null) => { if (!settled) { settled = true; input.remove(); resolve(f); } };
    input.addEventListener('change', () => done(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}

/** Asks for durable storage. Never awaited in a user flow: Firefox shows a prompt (Phase 0 finding). */
export async function requestPersistentStorage(timeoutMs = 4000): Promise<boolean | 'pending'> {
  if (!navigator.storage?.persist) return false;
  const timeout = new Promise<'pending'>((res) => setTimeout(() => res('pending'), timeoutMs));
  return Promise.race([navigator.storage.persist().catch(() => false), timeout]);
}
