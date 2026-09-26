// Widget catalogue — plain data (no UI imports) so logic and tests stay lightweight.
import type { ModuleId, WidgetId } from './db/schema';

export const WIDGETS: Record<WidgetId, { name: string; description: string; module: ModuleId | null }> = {
  'quick-actions': { name: 'Quick actions', description: 'Add a task, log a habit or record spending in one tap', module: null },
  'today-tasks': { name: "Today's tasks", description: 'What is due today and overdue', module: 'tasks' },
  'habit-progress': { name: 'Habit check-in', description: "Today's habits and streaks", module: 'habits' },
  'goal-progress': { name: 'Goal progress', description: 'Your active goals at a glance', module: 'goals' },
  'upcoming-events': { name: 'Upcoming', description: 'Next events on your calendar', module: 'calendar' },
  'wellness-summary': { name: 'Wellness today', description: 'Water, sleep, mood and activity', module: 'wellness' },
  'finance-summary': { name: 'This month', description: 'Spending, income and balance', module: 'finance' },
  'recent-notes': { name: 'Recent notes', description: 'Your latest notes', module: 'notes' },
  'week-stats': { name: 'Your week', description: 'Consistency across your modules', module: null },
};

/** Widgets that can be shown given the enabled modules. */
export function availableWidgets(enabled: ModuleId[]): WidgetId[] {
  return (Object.keys(WIDGETS) as WidgetId[]).filter((w) => {
    const m = WIDGETS[w].module;
    return m === null || enabled.includes(m);
  });
}
