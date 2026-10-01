// The one-tap actions shared by the dashboard, the "New" sheet and the command palette.
import type { Component } from 'svelte';
import { CheckSquare, Repeat, Target, CalendarPlus, NotebookPen, Droplet, Wallet, Dumbbell, Focus, Briefcase, GraduationCap, BookHeart } from '@lucide/svelte';
import { focus } from '../../lib/focus.svelte';
import { app } from '../../lib/app.svelte';
import { clock } from '../../lib/clock.svelte';
import { router } from '../../lib/router.svelte';
import { getWellness, updateWellness } from '../../lib/domain/daily';
import { toast } from '../../lib/ui/toast.svelte';
import { openQuick } from './quick.svelte';
import type { ModuleId } from '../../lib/db/schema';

export interface QuickAction {
  id: string;
  module: ModuleId | null;        // null = always available
  label: string;
  icon: Component;
  color: string;
  run: () => void;
}

async function addWater() {
  const unit = app.settings?.units.water ?? 'glasses';
  const step = unit === 'ml' ? 250 : unit === 'oz' ? 8 : 1;
  const d = await getWellness(clock.today);
  const w = await updateWellness(clock.today, { water: (d.water ?? 0) + step });
  toast(`Water: ${w.water} ${unit} today`, { action: { label: 'Undo', run: () => void updateWellness(clock.today, { water: d.water }) } });
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'focus', module: null, label: 'Start focus', icon: Focus, color: 'var(--mod-focus)', run: () => focus.openFor() },
  { id: 'task', module: 'tasks', label: 'Add task', icon: CheckSquare, color: 'var(--mod-tasks)', run: () => openQuick('task') },
  { id: 'habit', module: 'habits', label: 'Habits', icon: Repeat, color: 'var(--mod-habits)', run: () => router.go({ name: 'module', module: 'habits' }) },
  { id: 'money', module: 'finance', label: 'Spending', icon: Wallet, color: 'var(--mod-finance)', run: () => openQuick('transaction') },
  { id: 'water', module: 'wellness', label: 'Add water', icon: Droplet, color: 'var(--mod-wellness)', run: () => void addWater() },
  { id: 'workout', module: 'wellness', label: 'Log workout', icon: Dumbbell, color: 'var(--mod-wellness)', run: () => openQuick('workout') },
  { id: 'journal', module: 'notes', label: 'Journal', icon: BookHeart, color: 'var(--mod-notes)', run: () => openQuick('note', { kind: 'journal' }) },
  { id: 'event', module: 'calendar', label: 'Add event', icon: CalendarPlus, color: 'var(--mod-calendar)', run: () => openQuick('event') },
  { id: 'note', module: 'notes', label: 'New note', icon: NotebookPen, color: 'var(--mod-notes)', run: () => openQuick('note') },
  { id: 'project', module: 'work', label: 'New project', icon: Briefcase, color: 'var(--mod-work)', run: () => openQuick('project', { kind: 'work' }) },
  { id: 'subject', module: 'study', label: 'New subject', icon: GraduationCap, color: 'var(--mod-study)', run: () => openQuick('project', { kind: 'study' }) },
  { id: 'goal', module: 'goals', label: 'New goal', icon: Target, color: 'var(--mod-goals)', run: () => openQuick('goal') },
];

/** Actions for the enabled modules, in the user's module order. */
export function enabledQuickActions(includeWorkout = false): QuickAction[] {
  const order = app.workspace?.moduleOrder ?? [];
  const on = app.workspace?.enabledModules ?? [];
  return QUICK_ACTIONS
    .filter((a) => (a.module === null || on.includes(a.module)) && (includeWorkout || a.id !== 'workout'))
    .sort((x, y) => (x.module === null ? -1 : order.indexOf(x.module)) - (y.module === null ? -1 : order.indexOf(y.module)));
}
