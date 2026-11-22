<script lang="ts">
  // A quiet closing line for the day — one short, original sentence, picked by the date so it
  // stays the same all day and changes tomorrow. Purely a touch of tone; nothing depends on it.
  import { Sparkles } from '@lucide/svelte';
  import { clock } from '../../lib/clock.svelte';

  const LINES = [
    'Small steps still count.', 'Begin where you are.', 'Make it easy to start.', 'Rest is part of the plan.', 'One clear thing beats ten vague ones.',
    'Progress, not perfection.', 'Today only needs your next step.', 'Protect your focus; it is your best asset.', 'Done is a good place to begin.',
    'Gentle consistency wins.', 'Do the hard thing first, then breathe.', 'You are building something quietly.', 'Plan lightly, act kindly.',
    'A calm mind sees the next move.', 'Finish one thing and feel it.', 'Your pace is allowed.', 'Show up, even a little.', 'Clear space, clear mind.',
    'Choose what matters; let the rest wait.', 'Today is a fresh page.', 'Look how far a few weeks have taken you.', 'Slow is smooth, smooth is steady.',
    'Do one kind thing for future you.', 'Energy follows attention.', 'Keep the promise you made to yourself.', 'Make today a little lighter than yesterday.',
    'Focus is a gift you give your work.', 'Every habit starts as a single day.', 'Trust the small, daily version of you.', 'End the day knowing what is next.',
  ];
  const line = $derived.by(() => {
    const [y, m, d] = clock.today.split('-').map(Number) as [number, number, number];
    const n = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
    return LINES[n % LINES.length]!;
  });
</script>

<p class="line"><Sparkles size={15} aria-hidden="true" /><span>{line}</span></p>
<p class="colo kicker" aria-hidden="true">End of today's page</p>

<style>
  .line { display: flex; align-items: center; justify-content: center; gap: var(--space-2); margin: var(--space-7) auto var(--space-2); padding: var(--space-3) var(--space-5); width: fit-content; max-width: 100%;
    border-radius: 999px; color: var(--text-2); font-size: var(--text-sm); font-style: italic;
    background: var(--glass-bg); border: 1px solid var(--glass-border); box-shadow: var(--glass-highlight);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)); }
  .line :global(svg) { color: var(--accent); flex: none; }

  /* ---- Almanac: an epigraph under a fleuron, then a typewriter colophon ---- */
  .colo { display: none; }
  :global(:root[data-style='almanac']) .line {
    flex-direction: column; gap: var(--space-3); margin: var(--space-10) auto var(--space-2); padding: 0; background: none; border: 0; border-radius: 0; box-shadow: none;
    -webkit-backdrop-filter: none; backdrop-filter: none; font-family: var(--font-display); font-size: clamp(22px, 2.4vw, 30px); font-weight: 340; color: var(--text); text-align: center;
  }
  :global(:root[data-style='almanac']) .line :global(svg) { display: none; }
  :global(:root[data-style='almanac']) .line::before { content: '⁂'; font-style: normal; font-size: 20px; color: var(--accent); }
  :global(:root[data-style='almanac']) .line span::before { content: '“'; } :global(:root[data-style='almanac']) .line span::after { content: '”'; }
  :global(:root[data-style='almanac']) .colo { display: flex; align-items: center; justify-content: center; gap: var(--space-3); margin: var(--space-4) auto 0; max-width: 420px; color: var(--text-3); font-size: 9.5px; }
  :global(:root[data-style='almanac']) .colo::before, :global(:root[data-style='almanac']) .colo::after { content: ''; flex: 1; height: 1px; background: var(--border-strong); }
</style>
