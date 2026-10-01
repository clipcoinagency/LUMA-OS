// The three themes, in the order the picker and the "switch theme" shortcuts cycle through them.
import type { ThemeId } from './db/schema';

export const THEMES: { id: ThemeId; name: string; mood: string }[] = [
  { id: 'light', name: 'Light', mood: 'Bright white with indigo and sky light. Crisp and clear.' },
  { id: 'soft', name: 'Soft', mood: 'Calm cream and dusty rose. Elegant and warm.' },
  { id: 'dark', name: 'Dark', mood: 'Deep midnight with violet glow. Focused and cinematic.' },
];

export const themeName = (t: ThemeId) => THEMES.find((x) => x.id === t)?.name ?? 'Soft';
export function nextTheme(t: ThemeId): ThemeId {
  const i = THEMES.findIndex((x) => x.id === t);
  return THEMES[(i + 1) % THEMES.length]!.id;
}
