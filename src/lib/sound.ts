// Tiny Web Audio sounds — no external assets, so everything stays inside the single-file build.
// Browsers block audio before any user gesture; by the time anything here plays the user has always
// already interacted with the app. If audio is blocked or unavailable the visual cue still shows —
// never let a sound failure get in the way of the feature.
type Ctor = typeof AudioContext;

function context(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    return Ctx ? new Ctx() : null;
  } catch { return null; }
}

function notes(freqs: number[], gap: number, len: number, peak: number) {
  const ctx = context();
  if (!ctx) return;
  try {
    const start = ctx.currentTime;
    for (const [i, freq] of freqs.entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = start + i * gap;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + len + 0.02);
    }
    setTimeout(() => void ctx.close(), (freqs.length * gap + len + 0.2) * 1000);
  } catch { /* blocked */ }
}

/** Two-note reminder chime. */
export function playChime() { notes([660, 880], 0.18, 0.4, 0.22); }

/** Warm three-note rise when a focus session reaches its time. */
export function playSessionDone() { notes([523.25, 659.25, 783.99], 0.16, 0.7, 0.2); }
