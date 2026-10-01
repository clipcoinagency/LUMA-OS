// Opens a create/edit form from anywhere (dashboard quick actions, empty states, module pages).
export type QuickKind = 'task' | 'transaction' | 'habit' | 'goal' | 'event' | 'note' | 'workout' | 'project';

class Quick {
  kind = $state<QuickKind | null>(null);
  // raw (not deeply reactive): presets carry records to edit, and a reactive Proxy would reach
  // IndexedDB on save and throw DataCloneError.
  preset = $state.raw<Record<string, unknown>>({});
}

export const quick = new Quick();

export function openQuick(kind: QuickKind, preset: Record<string, unknown> = {}) {
  quick.preset = preset;
  quick.kind = kind;
}

export function closeQuick() {
  quick.kind = null;
}
