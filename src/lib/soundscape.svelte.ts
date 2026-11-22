// Focus soundscapes (new looks): rain, brown noise and ocean, synthesised live with Web Audio — no
// audio files, so they work offline and inside the single-file build. Gentle fades in and out.
export type SoundKind = 'rain' | 'brown' | 'ocean';
export const SOUNDS: { id: SoundKind; label: string }[] = [
  { id: 'rain', label: 'Rain' },
  { id: 'brown', label: 'Brown noise' },
  { id: 'ocean', label: 'Ocean' },
];

function noiseBuffer(ctx: AudioContext, kind: 'pink' | 'brown'): AudioBuffer {
  const len = ctx.sampleRate * 6;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    }
  }
  return buf;
}

class Soundscape {
  current = $state<SoundKind | null>(null);
  volume = $state(0.6);
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    return { ctx: this.ctx, master: this.master! };
  }

  play(kind: SoundKind) {
    if (this.current === kind) { this.stop(); return; }
    this.teardown(0.25);
    const { ctx, master } = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, kind === 'rain' ? 'pink' : 'brown');
    src.loop = true;
    const out = ctx.createGain();
    if (kind === 'rain') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      out.gain.value = 0.55;
      src.connect(hp).connect(lp).connect(out);
      this.nodes.push(hp, lp);
    } else if (kind === 'brown') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      out.gain.value = 0.9;
      src.connect(lp).connect(out);
      this.nodes.push(lp);
    } else {
      // ocean: brown noise whose loudness and brightness swell like waves (~11 s per wave)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const swell = ctx.createGain(); swell.gain.value = 0.55;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
      const depth = ctx.createGain(); depth.gain.value = 0.42;
      const bright = ctx.createGain(); bright.gain.value = 500;
      lfo.connect(depth).connect(swell.gain);
      lfo.connect(bright).connect(lp.frequency);
      out.gain.value = 1;
      src.connect(lp).connect(swell).connect(out);
      lfo.start();
      this.sources.push(lfo);
      this.nodes.push(lp, swell, depth, bright);
    }
    out.connect(master);
    this.nodes.push(out);
    src.start();
    this.sources.push(src);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(this.volume * 0.5, ctx.currentTime, 0.6);
    this.current = kind;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.master && this.current) this.master.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.15);
  }

  stop() { this.teardown(1.2); this.current = null; }

  private teardown(fade: number) {
    const ctx = this.ctx, master = this.master;
    const sources = this.sources, nodes = this.nodes;
    this.sources = []; this.nodes = [];
    if (!ctx || !master || !sources.length) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
    setTimeout(() => { for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } } for (const n of nodes) n.disconnect(); }, fade * 1000 + 50);
  }
}

export const soundscape = new Soundscape();
