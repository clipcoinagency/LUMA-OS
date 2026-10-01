// The app's light follows the day: a small, smooth hue shift (and a touch of intensity) on the aurora
// background so morning, afternoon, evening and night each feel a little different. Purely visual —
// nothing else depends on it.

const HUE_KEYS: [number, number][] = [[0, -24], [5, -10], [7, 12], [10, 6], [14, 0], [18, -14], [21, -22], [24, -24]];
const STRENGTH_KEYS: [number, number][] = [[0, 0.82], [6, 0.9], [9, 1], [17, 1.04], [21, 0.9], [24, 0.82]];

function interp(keys: [number, number][], h: number): number {
  for (let i = 1; i < keys.length; i++) {
    const [h1, v1] = keys[i]!;
    const [h0, v0] = keys[i - 1]!;
    if (h <= h1) return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0);
  }
  return keys[keys.length - 1]![1];
}

export function atmosphereFor(date: Date): { hue: number; strength: number } {
  const h = date.getHours() + date.getMinutes() / 60;
  return { hue: Math.round(interp(HUE_KEYS, h) * 10) / 10, strength: Math.round(interp(STRENGTH_KEYS, h) * 100) / 100 };
}

export function applyAtmosphere(date: Date = new Date()) {
  const { hue, strength } = atmosphereFor(date);
  const root = document.documentElement;
  root.style.setProperty('--tod-hue', `${hue}deg`);
  root.style.setProperty('--tod-strength', String(strength));
}
