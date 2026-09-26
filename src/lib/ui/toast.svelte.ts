// Tiny toast queue (Svelte 5 runes module). Toasts are polite live-region announcements.

export interface Toast {
  id: number;
  message: string;
  tone: 'neutral' | 'success' | 'danger';
  action?: { label: string; run: () => void };
}

let seq = 0;
export const toasts = $state<Toast[]>([]);

export function dismiss(id: number) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i !== -1) toasts.splice(i, 1);
}

export function toast(message: string, opts: { tone?: Toast['tone']; action?: Toast['action']; ms?: number } = {}) {
  const id = ++seq;
  toasts.push({ id, message, tone: opts.tone ?? 'neutral', action: opts.action });
  if (toasts.length > 3) toasts.shift();
  setTimeout(() => dismiss(id), opts.ms ?? (opts.action ? 6000 : 3500));
  return id;
}
