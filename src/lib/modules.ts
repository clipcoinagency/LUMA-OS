// The 7 modules of Life OS V1: one registry used by onboarding, navigation, settings and dashboard.
import type { Component } from 'svelte';
import { CheckSquare, Target, Repeat, CalendarDays, NotebookPen, HeartPulse, Wallet, Briefcase, GraduationCap } from '@lucide/svelte';
import type { ModuleId } from './db/schema';
export { WIDGETS, availableWidgets } from './widgets';

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  tagline: string;
  icon: Component;
  color: string; // CSS var
}

export const MODULES: Record<ModuleId, ModuleInfo> = {
  tasks: { id: 'tasks', name: 'Tasks', tagline: 'Plan your day and get things done', icon: CheckSquare, color: 'var(--mod-tasks)' },
  goals: { id: 'goals', name: 'Goals', tagline: 'Track progress toward what matters', icon: Target, color: 'var(--mod-goals)' },
  habits: { id: 'habits', name: 'Habits', tagline: 'Build routines and see your streaks', icon: Repeat, color: 'var(--mod-habits)' },
  calendar: { id: 'calendar', name: 'Calendar', tagline: 'Events and a look back at any day', icon: CalendarDays, color: 'var(--mod-calendar)' },
  notes: { id: 'notes', name: 'Notes', tagline: 'Capture thoughts and ideas', icon: NotebookPen, color: 'var(--mod-notes)' },
  wellness: { id: 'wellness', name: 'Fitness & Wellness', tagline: 'Workouts, sleep, water, mood and more', icon: HeartPulse, color: 'var(--mod-wellness)' },
  finance: { id: 'finance', name: 'Finance', tagline: 'Income, spending and savings', icon: Wallet, color: 'var(--mod-finance)' },
  work: { id: 'work', name: 'Work', tagline: 'Projects, clients, meetings and deadlines', icon: Briefcase, color: 'var(--mod-work)' },
  study: { id: 'study', name: 'Study', tagline: 'Subjects, assignments, exams and study time', icon: GraduationCap, color: 'var(--mod-study)' },
};

