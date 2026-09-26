// Svelte transitions run in JS, so CSS `prefers-reduced-motion` doesn't reach them.
// Every transition duration goes through `dur()` so reduced motion is honoured everywhere.
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return document.documentElement.dataset.reduceMotion === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function dur(ms: number): number {
  return reducedMotion() ? 0 : ms;
}
