// Information architecture. People think in four moves — look at today (Home), plan what's coming
// (Plan), tend the rest of life (Life), and look back / forward (Reflect) — so navigation is grouped
// that way instead of being one long list of modules. Pure data + helpers (no UI state).
import type { Component } from 'svelte';
import { Layers, HeartPulse, Orbit, LineChart as ChartLine, RefreshCcw } from './navicons';
import { MODULES } from './modules';
import type { ModuleId, Workspace } from './db/schema';
import type { Route } from './router.svelte';
import { MoonStar, Award } from '@lucide/svelte';

export type GroupId = 'plan' | 'life' | 'reflect';

export interface NavItem {
  id: string;
  label: string;
  icon: Component;
  color: string;
  route: Route;
  module?: ModuleId;
}

export interface NavGroup {
  id: GroupId;
  label: string;
  icon: Component;
  items: NavItem[];
}

/** Which group each module lives in, in display order inside the group. */
const GROUP_OF: Record<ModuleId, GroupId> = {
  tasks: 'plan', goals: 'plan', habits: 'plan', calendar: 'plan', work: 'plan', study: 'plan',
  wellness: 'life', finance: 'life',
  notes: 'reflect',
};

const GROUP_META: Record<GroupId, { label: string; icon: Component }> = {
  plan: { label: 'Plan', icon: Layers },
  life: { label: 'Life', icon: HeartPulse },
  reflect: { label: 'Reflect', icon: Orbit },
};

const moduleItem = (m: ModuleId): NavItem => ({ id: m, label: MODULES[m].name, icon: MODULES[m].icon, color: MODULES[m].color, route: { name: 'module', module: m }, module: m });

const INSIGHTS: NavItem = { id: 'insights', label: 'Insights', icon: ChartLine, color: 'var(--mod-insights)', route: { name: 'insights' } };
const RESET: NavItem = { id: 'reset', label: 'Weekly Reset', icon: RefreshCcw, color: 'var(--mod-reset)', route: { name: 'reset' } };
// new looks only (Paper, Night Ink, Nebula)
const CLOSE: NavItem = { id: 'close', label: 'Close the day', icon: MoonStar, color: 'var(--mod-focus)', route: { name: 'close' } };
const SEALS: NavItem = { id: 'seals', label: 'Seals', icon: Award, color: 'var(--mod-goals)', route: { name: 'seals' } };

/** Groups with only the items that are switched on, honouring the user's module order. `extras` adds
 *  the new looks' pages (Close the day, Seals); the original themes never pass it. */
export function navGroups(ws: Pick<Workspace, 'enabledModules' | 'moduleOrder'>, extras = false): NavGroup[] {
  const ordered = [...ws.moduleOrder.filter((m) => ws.enabledModules.includes(m)), ...ws.enabledModules.filter((m) => !ws.moduleOrder.includes(m))];
  return (['plan', 'life', 'reflect'] as GroupId[]).map((g) => {
    const items = ordered.filter((m) => GROUP_OF[m] === g).map(moduleItem);
    if (g === 'reflect') items.push(INSIGHTS, RESET);
    if (g === 'reflect' && extras) items.push(CLOSE, SEALS);
    return { id: g, label: GROUP_META[g].label, icon: GROUP_META[g].icon, items };
  }).filter((g) => g.items.length > 0);
}

/** Almanac's table of contents: each page's number ("01"…), counted across groups in display order. */
export function tocNumbers(groups: NavGroup[]): Record<string, { no: string; group: string }> {
  const out: Record<string, { no: string; group: string }> = {};
  let n = 0;
  for (const g of groups) for (const it of g.items) out[it.id] = { no: String(++n).padStart(2, '0'), group: g.label };
  return out;
}

export function groupOfRoute(r: Route): GroupId | 'home' | 'settings' | 'dev' {
  if (r.name === 'module') return GROUP_OF[r.module];
  if (r.name === 'insights' || r.name === 'reset' || r.name === 'close' || r.name === 'seals') return 'reflect';
  if (r.name === 'dashboard') return 'home';
  return r.name === 'settings' ? 'settings' : 'dev';
}

export function itemIsActive(item: NavItem, r: Route): boolean {
  if (item.route.name === 'module') return r.name === 'module' && r.module === item.route.module;
  return item.route.name === r.name;
}
