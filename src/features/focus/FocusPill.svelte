<script lang="ts">
  // A running focus session while the full-screen room is minimised: a small floating glass pill with a
  // live ring + clock. One tap returns to the session.
  import { focus } from '../../lib/focus.svelte';
  const R = 11, C = 2 * Math.PI * R;
</script>

{#if focus.active && !focus.open}
  <button type="button" class="pill glass-strong" onclick={() => focus.show()} aria-label="Focus session in progress: {focus.reached ? 'complete' : focus.clock + ' remaining'}. Open.">
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <circle cx="14" cy="14" r={R} class="t" />
      <circle cx="14" cy="14" r={R} class="a" stroke-dasharray={C} stroke-dashoffset={C * (1 - focus.progress)} transform="rotate(-90 14 14)" />
    </svg>
    <span class="clock num">{focus.reached ? 'Done' : focus.clock}</span>
    <span class="lbl">{focus.active.label}</span>
  </button>
{/if}

<style>
  .pill {
    position: fixed; z-index: var(--z-overlay); left: 50%; translate: -50% 0; bottom: calc(92px + env(safe-area-inset-bottom)); display: inline-flex; align-items: center; gap: var(--space-2);
    height: 48px; padding: 0 var(--space-4) 0 var(--space-3); max-width: min(92vw, 360px); border-radius: 999px; cursor: pointer; color: var(--text);
    animation: up var(--dur-slow) var(--ease-emphasis); transition: transform var(--dur-fast) var(--ease-out);
  }
  .pill:active { transform: scale(.97); }
  .t { fill: none; stroke: var(--ring-track); stroke-width: 3; }
  .a { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset 300ms linear; }
  .clock { font-family: var(--font-display); font-weight: 600; font-size: var(--text-md); }
  .lbl { color: var(--text-2); font-size: var(--text-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  @keyframes up { from { opacity: 0; transform: translateY(12px); } }
  @media (min-width: 1024px) { .pill { bottom: 24px; } }
</style>
