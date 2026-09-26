// Opens a create form from anywhere (dashboard quick actions, empty states, module pages).
export type QuickKind = 'task' | 'transaction' | 'habit' | 'goal' | 'event' | 'note';

export const quick = $state<{ kind: QuickKind | null; preset: Record<string, unknown> }>({ kind: null, preset: {} });

export function openQuick(kind: QuickKind, preset: Record<string, unknown> = {}) {
  quick.preset = preset;
  quick.kind = kind;
}

export function closeQuick() {
  quick.kind = null;
}
