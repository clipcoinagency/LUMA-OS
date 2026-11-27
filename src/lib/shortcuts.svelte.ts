// Keyboard shortcuts for the new looks (Paper, Night Ink, Nebula). The original three themes never
// react to these keys. Single keys are ignored while you are typing, while a dialog is open, and
// whenever Ctrl/Cmd/Alt is held, so they can never get in the way of text entry or the browser.
//   ?  this list      /  search       n  new task      e  new event      f  start focus      ,  settings
//   g then:  d home · t tasks · c calendar · o goals · h habits · f money · n notes · i insights
//            r weekly reset · e close the day · s seals
import { app } from './app.svelte';
import { palette } from './palette.svelte';
import { focus } from './focus.svelte';
import { router } from './router.svelte';
import { navGroups } from './nav';
import { openQuick } from '../features/quick/quick.svelte';

class Shortcuts { open = $state(false); }
export const shortcuts = new Shortcuts();

export const GO_KEYS: { key: string; id: string; label: string }[] = [
  { key: 'd', id: 'home', label: 'Home' }, { key: 't', id: 'tasks', label: 'Tasks' }, { key: 'c', id: 'calendar', label: 'Calendar' },
  { key: 'o', id: 'goals', label: 'Goals' }, { key: 'h', id: 'habits', label: 'Habits' }, { key: 'f', id: 'finance', label: 'Finance' },
  { key: 'n', id: 'notes', label: 'Notes' }, { key: 'i', id: 'insights', label: 'Insights' }, { key: 'r', id: 'reset', label: 'Weekly Reset' },
  { key: 'e', id: 'close', label: 'Close the day' }, { key: 's', id: 'seals', label: 'Seals' },
];
export const SINGLE_KEYS: { keys: string; label: string }[] = [
  { keys: '?', label: 'Show this list' }, { keys: '/', label: 'Search and jump anywhere' }, { keys: 'n', label: 'New task' },
  { keys: 'e', label: 'New event' }, { keys: 'f', label: 'Start a focus session' }, { keys: ',', label: 'Settings' },
];

/** True when a key press should be left alone: typing somewhere, a dialog is open, or a modifier is held. */
export function shouldIgnore(e: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>, dialogOpen: boolean): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target as HTMLElement | null;
  const tag = t?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return true;
  return dialogOpen;
}

let started = false;
let chord = false;
let chordTimer: ReturnType<typeof setTimeout> | undefined;

function goTo(id: string) {
  const ws = app.workspace;
  if (!ws) return;
  if (id === 'home') { router.go({ name: 'dashboard' }); return; }
  for (const g of navGroups(ws, true)) for (const it of g.items) if (it.id === id) { router.go(it.route); return; }
}

function onKey(e: KeyboardEvent) {
  if (!app.workspace?.onboarded) return;
  if (e.key === 'Escape' && shortcuts.open) { shortcuts.open = false; return; }
  const sheetOpen = shortcuts.open;
  if (shouldIgnore(e, !!document.querySelector('dialog[open]') && !sheetOpen)) return;
  const k = e.key;
  if (chord) {
    chord = false; clearTimeout(chordTimer);
    const hit = GO_KEYS.find((g) => g.key === k.toLowerCase());
    if (hit) { e.preventDefault(); goTo(hit.id); }
    return;
  }
  if (k === '?') { e.preventDefault(); shortcuts.open = !shortcuts.open; return; }
  if (sheetOpen) return;
  if (k === 'g') { chord = true; chordTimer = setTimeout(() => { chord = false; }, 1500); return; }
  if (k === '/') { e.preventDefault(); palette.show(); }
  else if (k === 'n' && app.workspace.enabledModules.includes('tasks')) { e.preventDefault(); openQuick('task'); }
  else if (k === 'e' && app.workspace.enabledModules.includes('calendar')) { e.preventDefault(); openQuick('event'); }
  else if (k === 'f') { e.preventDefault(); focus.openFor(); }
  else if (k === ',') { e.preventDefault(); router.go({ name: 'settings' }); }
}

export function initShortcuts() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('keydown', onKey);
}
