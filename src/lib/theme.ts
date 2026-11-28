// The themes, in the order the picker and the "switch theme" shortcuts cycle through them.
import type { ThemeId } from './db/schema';

export const THEMES: { id: ThemeId; name: string; mood: string }[] = [
  { id: 'light', name: 'Light', mood: 'Bright white with indigo and sky light. Crisp and clear.' },
  { id: 'soft', name: 'Soft', mood: 'Calm cream and dusty rose. Elegant and warm.' },
  { id: 'dark', name: 'Dark', mood: 'Deep midnight with violet glow. Focused and cinematic.' },
  { id: 'paper', name: 'Paper', mood: 'Warm paper, black ink and one red accent. Calm and editorial.' },
  { id: 'ink', name: 'Night Ink', mood: 'The Paper look for evenings. Deep ink with bone-white type.' },
  { id: 'nebula', name: 'Nebula', mood: 'Liquid violet glass, iridescent edges and a quiet starfield.' },
];

export const themeName = (t: ThemeId) => THEMES.find((x) => x.id === t)?.name ?? 'Soft';
export type StyleId = 'almanac' | 'nebula' | 'aurora';
/** Paper and Night Ink share the Almanac layout (rules instead of glass, editorial type); Nebula is
 *  liquid glass; the original three themes are "aurora" and are never changed by the new looks. */
export const styleOf = (t: ThemeId): StyleId => (t === 'paper' || t === 'ink' ? 'almanac' : t === 'nebula' ? 'nebula' : 'aurora');
/** The new looks (Paper, Night Ink, Nebula) carry the extra sections and features. */
export const isNewLook = (t: ThemeId | undefined): boolean => !!t && styleOf(t) !== 'aurora';

export function nextTheme(t: ThemeId): ThemeId {
  const i = THEMES.findIndex((x) => x.id === t);
  return THEMES[(i + 1) % THEMES.length]!.id;
}
