<script lang="ts">
  // New looks: one minute of guided breathing. A circle grows as you breathe in, rests while you hold,
  // and softens as you breathe out. Box (4·4·4·4) or Calm (4·7·8). With reduced motion the circle
  // stays still and only the words and the count change.
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import { reducedMotion } from '../../lib/motion';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const PATTERNS = {
    box: { label: 'Box · 4-4-4-4', steps: [['in', 4], ['hold', 4], ['out', 4], ['rest', 4]] },
    calm: { label: 'Calm · 4-7-8', steps: [['in', 4], ['hold', 7], ['out', 8]] },
  } as const;
  type Pat = keyof typeof PATTERNS;
  const WORDS = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', rest: 'Rest' } as const;
  const TOTAL = 60;

  let pattern = $state<Pat>('box');
  let running = $state(false);
  let phase = $state<'in' | 'hold' | 'out' | 'rest'>('in');
  let count = $state(4);
  let phaseSecs = $state(4);
  let left = $state(TOTAL);
  let finished = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  function start() {
    finished = false; running = true; left = TOTAL;
    const steps = PATTERNS[pattern].steps;
    let i = 0, inStep = 0;
    const enter = () => { phase = steps[i]![0]; phaseSecs = steps[i]![1]; count = phaseSecs; inStep = 0; };
    enter();
    clearInterval(timer);
    timer = setInterval(() => {
      left -= 1; inStep += 1; count = phaseSecs - inStep;
      if (inStep >= phaseSecs) { i = (i + 1) % steps.length; enter(); }
      if (left <= 0) { stop(); finished = true; }
    }, 1000);
  }
  function stop() { clearInterval(timer); timer = undefined; running = false; }
  $effect(() => { if (!open) { stop(); finished = false; } });
  $effect(() => () => clearInterval(timer));

  const scale = $derived(!running || reducedMotion() ? 1 : phase === 'in' ? 1.45 : phase === 'hold' ? 1.45 : 0.85);
</script>

<Modal bind:open title="Breathe" size="sm">
  <div class="br">
    <div class="stage" aria-hidden="true">
      <div class="halo" style="transform:scale({scale});transition-duration:{running ? phaseSecs : 0.6}s"></div>
      <div class="core" style="transform:scale({scale * 0.82});transition-duration:{running ? phaseSecs : 0.6}s"></div>
    </div>
    <p class="word" aria-live="polite">{#if running}{WORDS[phase]}{:else if finished}Well done.{:else}One quiet minute.{/if}</p>
    <p class="count num">{#if running}{count > 0 ? count : ''}{:else if finished}Notice how you feel.{:else}Follow the circle.{/if}</p>
    {#if !running}
      <Segmented label="Pattern" value={pattern} options={Object.entries(PATTERNS).map(([value, p]) => ({ value, label: p.label }))} onchange={(v) => (pattern = v as Pat)} size="sm" />
      <Button variant="primary" full onclick={start}>{finished ? 'Again' : 'Start · 1 minute'}</Button>
    {:else}
      <p class="left">{left}s left</p>
      <Button variant="ghost" full onclick={stop}>Stop</Button>
    {/if}
  </div>
</Modal>

<style>
  .br { display: grid; justify-items: center; gap: var(--space-3); text-align: center; }
  .stage { position: relative; width: 220px; height: 220px; display: grid; place-items: center; margin: var(--space-2) 0; }
  .halo, .core { position: absolute; border-radius: 50%; transition-property: transform; transition-timing-function: cubic-bezier(.45, 0, .55, 1); }
  .halo { width: 120px; height: 120px; background: radial-gradient(circle, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%); }
  .core { width: 120px; height: 120px; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, #fff 35%, var(--accent)), var(--accent) 70%); box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 45%, transparent); }
  .word { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-xl); letter-spacing: var(--display-tracking); min-height: 1.4em; }
  .count { color: var(--text-2); min-height: 1.4em; font-size: var(--text-md); }
  .left { color: var(--text-3); font-size: var(--text-sm); }
  :global(:root[data-style='almanac']) .core { background: var(--text); box-shadow: none; }
  :global(:root[data-style='almanac']) .halo { background: none; border: 1px solid var(--text); }
  :global(:root[data-style='almanac']) .word { font-style: italic; font-weight: 360; font-size: 30px; }
  :global(:root[data-style='nebula']) .core { background: radial-gradient(circle at 35% 30%, #fff, #c9a6ff 30%, #7b61ff 70%, #ff71c8); box-shadow: 0 0 60px rgba(183, 140, 255, .6), 0 0 120px rgba(255, 113, 200, .25); }
</style>
