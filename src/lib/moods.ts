// Shared mood scale (1–5) used by the Wellness widget, the Wellness module and the day History
// panel, so the icon/label/colour stay identical everywhere a mood is shown.
import type { Component } from 'svelte';
import { Angry, Frown, Meh, Smile, Laugh } from '@lucide/svelte';

export interface MoodDef { value: 1 | 2 | 3 | 4 | 5; icon: Component; label: string; color: string }

export const MOODS: MoodDef[] = [
  { value: 1, icon: Angry, label: 'Awful', color: '#c0605a' },
  { value: 2, icon: Frown, label: 'Low', color: '#c98a4a' },
  { value: 3, icon: Meh, label: 'Okay', color: '#9a9a6a' },
  { value: 4, icon: Smile, label: 'Good', color: '#4f9a78' },
  { value: 5, icon: Laugh, label: 'Great', color: '#3f8fae' },
];
