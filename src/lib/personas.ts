// Starting points for onboarding. A persona is just a pre-chosen, pre-ordered set of areas — nothing
// is locked in; the next step lets people add or remove any area, and Settings can change it any time.
import type { Component } from 'svelte';
import { GraduationCap, Rocket, Briefcase, HeartPulse, House, Sprout } from '@lucide/svelte';
import { MODULE_WIDGETS } from './db/defaults';
import type { ModuleId, WidgetId, Workspace } from './db/schema';

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  icon: Component;
  color: string;
  modules: ModuleId[];          // enabled, in display order
}

export const PERSONAS: Persona[] = [
  { id: 'student', name: 'Student', tagline: 'Classes, assignments, exams and study time', icon: GraduationCap, color: 'var(--mod-study)', modules: ['study', 'tasks', 'calendar', 'goals', 'habits', 'wellness', 'notes'] },
  { id: 'founder', name: 'Founder', tagline: 'Projects, clients, meetings and money', icon: Rocket, color: 'var(--mod-work)', modules: ['work', 'tasks', 'calendar', 'goals', 'finance', 'habits', 'notes'] },
  { id: 'professional', name: 'Professional', tagline: 'Work, deadlines and focused time', icon: Briefcase, color: 'var(--mod-calendar)', modules: ['work', 'tasks', 'calendar', 'goals', 'habits', 'notes'] },
  { id: 'health', name: 'Health first', tagline: 'Fitness, sleep, habits and daily planning', icon: HeartPulse, color: 'var(--mod-wellness)', modules: ['wellness', 'habits', 'goals', 'tasks', 'calendar', 'notes'] },
  { id: 'life', name: 'Organise my life', tagline: 'Tasks, habits, goals, money and wellbeing', icon: House, color: 'var(--mod-habits)', modules: ['tasks', 'habits', 'goals', 'finance', 'wellness', 'calendar', 'notes'] },
  { id: 'simple', name: 'Keep it simple', tagline: 'Just tasks and habits — add more whenever you like', icon: Sprout, color: 'var(--mod-tasks)', modules: ['tasks', 'habits'] },
];

/** The workspace fields a persona implies: its areas, in its order, with each area's widgets. */
export function workspaceForPersona(p: Pick<Persona, 'id' | 'modules'>): Pick<Workspace, 'enabledModules' | 'moduleOrder' | 'widgets' | 'persona'> {
  const widgets: WidgetId[] = ['quick-actions', ...p.modules.flatMap((m) => MODULE_WIDGETS[m]), 'week-stats'];
  return { enabledModules: [...p.modules], moduleOrder: [...p.modules], widgets, persona: p.id };
}
