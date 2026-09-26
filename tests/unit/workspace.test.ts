import { describe, expect, it } from 'vitest';
import { defaultWorkspace } from '../../src/lib/db/defaults';
import { orderedModules, visibleWidgets, widgetChoices, withEnabledModules } from '../../src/lib/workspace';

describe('workspace rules', () => {
  it('hides a disabled module’s widgets without forgetting their position', () => {
    const ws = defaultWorkspace();
    const off = { ...ws, ...withEnabledModules(ws, ws.enabledModules.filter((m) => m !== 'finance')) };
    expect(visibleWidgets(off)).not.toContain('finance-summary');
    expect(off.widgets).toContain('finance-summary'); // remembered
    const on = { ...off, ...withEnabledModules(off, [...off.enabledModules, 'finance']) };
    expect(visibleWidgets(on).indexOf('finance-summary')).toBe(ws.widgets.indexOf('finance-summary'));
  });

  it('keeps the user’s module order and appends newly enabled modules', () => {
    const ws = { ...defaultWorkspace(), moduleOrder: ['habits', 'tasks', 'goals'] as const, enabledModules: ['habits', 'tasks', 'goals'] as const };
    const next = withEnabledModules({ moduleOrder: [...ws.moduleOrder], widgets: ['quick-actions', 'week-stats'] }, ['habits', 'tasks', 'goals', 'notes']);
    expect(next.moduleOrder).toEqual(['habits', 'tasks', 'goals', 'notes']);
    expect(next.widgets).toEqual(['quick-actions', 'recent-notes', 'week-stats']); // weekly summary stays last
  });

  it('designs around Tasks + Goals + Habits only', () => {
    const ws = { ...defaultWorkspace(), ...withEnabledModules(defaultWorkspace(), ['tasks', 'goals', 'habits']) };
    expect(visibleWidgets(ws)).toEqual(['quick-actions', 'today-tasks', 'goal-progress', 'habit-progress', 'week-stats']);
    expect(orderedModules(ws)).toEqual(['tasks', 'goals', 'habits']);
    expect(widgetChoices({ ...ws, widgets: ['goal-progress'] })[0]).toBe('goal-progress');
  });
});
