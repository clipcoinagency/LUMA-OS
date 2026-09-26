// Workspace rules shared by onboarding and settings.
import { MODULE_WIDGETS } from './db/defaults';
import type { ModuleId, WidgetId, Workspace } from './db/schema';
import { availableWidgets } from './widgets';

/** Enabling keeps the user's order and appends new modules; newly enabled modules bring their widgets. */
export function withEnabledModules(ws: Pick<Workspace, 'moduleOrder' | 'widgets'>, next: ModuleId[]) {
  const kept = ws.moduleOrder.filter((m) => next.includes(m));
  const added = next.filter((m) => !kept.includes(m));
  const widgets = [...ws.widgets];
  for (const m of added) {
    for (const w of MODULE_WIDGETS[m]) {
      if (widgets.includes(w)) continue;
      const beforeStats = widgets.indexOf('week-stats'); // keep the weekly summary last
      if (beforeStats === -1) widgets.push(w);
      else widgets.splice(beforeStats, 0, w);
    }
  }
  return { enabledModules: next, moduleOrder: [...kept, ...added], widgets };
}

/** Widgets to render: the user's order, minus anything whose module is disabled. */
export function visibleWidgets(ws: Pick<Workspace, 'enabledModules' | 'widgets'>): WidgetId[] {
  const allowed = new Set(availableWidgets(ws.enabledModules));
  return ws.widgets.filter((w) => allowed.has(w));
}

/** All widgets the user could show, in display order (enabled first, in their order). */
export function widgetChoices(ws: Pick<Workspace, 'enabledModules' | 'widgets'>): WidgetId[] {
  const avail = availableWidgets(ws.enabledModules);
  const on = ws.widgets.filter((w) => avail.includes(w));
  return [...on, ...avail.filter((w) => !on.includes(w))];
}

/** Modules in navigation order. */
export function orderedModules(ws: Pick<Workspace, 'enabledModules' | 'moduleOrder'>): ModuleId[] {
  const ordered = ws.moduleOrder.filter((m) => ws.enabledModules.includes(m));
  return [...ordered, ...ws.enabledModules.filter((m) => !ordered.includes(m))];
}
