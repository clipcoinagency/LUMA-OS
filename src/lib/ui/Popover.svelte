<script lang="ts">
  // An anchored panel in the browser's top layer (native Popover API): never clipped by a dialog or a
  // scrolling card, light-dismisses on outside click / Esc, and hands focus back to its trigger.
  // Wide screens: floats under (or above) the trigger. Phones: slides up as a bottom sheet.
  import type { Snippet } from 'svelte';

  interface Props { open?: boolean; anchor: HTMLElement | undefined; label: string; width?: number; children: Snippet }
  let { open = $bindable(false), anchor, label, width = 340, children }: Props = $props();
  let el: HTMLDivElement | undefined = $state();
  let side = $state<'below' | 'above'>('below');

  function place() {
    if (!el || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - 16);
    const h = el.offsetHeight || 380;
    const roomBelow = window.innerHeight - r.bottom - 12;
    side = roomBelow < h && r.top > roomBelow ? 'above' : 'below';
    const top = side === 'below' ? r.bottom + 8 : Math.max(8, r.top - h - 8);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    el.style.setProperty('--pw', `${w}px`);
    el.style.setProperty('--pt', `${top}px`);
    el.style.setProperty('--pl', `${left}px`);
  }

  $effect(() => {
    if (!el) return;
    const shown = el.matches(':popover-open');
    if (open && !shown) { place(); el.showPopover(); requestAnimationFrame(place); }
    else if (!open && shown) el.hidePopover();
  });
  function sync(e: Event) { open = (e as ToggleEvent).newState === 'open'; }
  function onresize() { if (open) place(); }
</script>

<svelte:window onresize={onresize} />

<div bind:this={el} class="pop {side}" popover="auto" role="dialog" aria-label={label} ontoggle={sync}>
  {@render children()}
</div>

<style>
  .pop {
    position: fixed; inset: auto; margin: 0; top: var(--pt, 0); left: var(--pl, 0); width: var(--pw, 340px); max-height: min(560px, calc(100vh - 16px)); overflow: auto;
    padding: 0; color: var(--text); border: 1px solid var(--glass-border); border-radius: var(--radius-xl);
    background: var(--glass-bg-strong); box-shadow: var(--glass-highlight), var(--shadow-3);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
    transform-origin: var(--origin, top left);
  }
  .pop.above { --origin: bottom left; }
  .pop:popover-open { animation: pop-in .32s var(--ease-glide); }
  @keyframes pop-in { from { opacity: 0; transform: translateY(-8px) scale(.96); } }
  .pop.above:popover-open { animation-name: pop-in-up; }
  @keyframes pop-in-up { from { opacity: 0; transform: translateY(8px) scale(.96); } }
  @media (max-width: 600px) {
    .pop, .pop.above { top: auto; left: 0; right: 0; bottom: 0; width: 100%; max-height: 82vh; border-radius: 26px 26px 0 0; padding-bottom: env(safe-area-inset-bottom); --origin: bottom center; }
    .pop:popover-open, .pop.above:popover-open { animation: sheet-in .38s var(--ease-glide); }
    .pop::backdrop { background: var(--scrim); }
    @keyframes sheet-in { from { transform: translateY(40%); opacity: 0; } }
  }
  @media (prefers-reduced-transparency: reduce) { .pop { -webkit-backdrop-filter: none; backdrop-filter: none; background: var(--surface); } }
</style>
