<script lang="ts">
  // Round "complete" check used for tasks and habits: animated tick, announced as a checkbox.
  interface Props { checked?: boolean; label: string; hideLabel?: boolean; color?: string; size?: number; id?: string; onchange?: (v: boolean) => void }
  let { checked = $bindable(false), label, hideLabel = true, color, size = 26, id, onchange }: Props = $props();
  let stamped = $state(false); // Almanac: a DONE stamp lands when you tick something off (not on load)
  let stampTimer: ReturnType<typeof setTimeout> | undefined;
  function toggle() {
    checked = !checked;
    if (checked) { stamped = true; clearTimeout(stampTimer); stampTimer = setTimeout(() => (stamped = false), 1500); }
    onchange?.(checked);
  }
</script>

<button type="button" {id} role="checkbox" aria-checked={checked} class="cb" class:on={checked} class:stamp={stamped}
  style="--c:{color ?? 'var(--accent)'};--s:{size}px" onclick={toggle} aria-label={hideLabel ? label : undefined}>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" /></svg>
  {#if !hideLabel}<span>{label}</span>{/if}
</button>

<style>
  .cb {
    position: relative; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); background: none; border: 0; padding: 0;
    cursor: pointer; min-height: var(--touch); min-width: var(--touch); color: var(--text);
  }
  svg {
    width: var(--s); height: var(--s); border-radius: 50%; border: 2px solid var(--border-strong); padding: 3px; flex: none; position: relative; z-index: 1;
    transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  }
  path {
    fill: none; stroke: transparent; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 20; stroke-dashoffset: 20;
    transition: stroke-dashoffset var(--dur-slow) var(--ease-out) 60ms, stroke var(--dur-fast);
  }
  .cb:hover svg { border-color: var(--c); }
  .cb:active svg { transform: scale(.9); }
  .on svg { background: var(--c); border-color: var(--c); animation: pop 420ms var(--ease-emphasis); }
  .on path { stroke: var(--on-accent); stroke-dashoffset: 0; }
  @keyframes pop { 0% { transform: scale(.7); } 55% { transform: scale(1.16); } 100% { transform: scale(1); } }

  /* a quick outward ring on the moment a task/habit is marked done — a small "nice" instead of a flat toggle */
  .cb::after {
    content: ''; position: absolute; inset: 0; margin: auto; width: var(--s); height: var(--s); border-radius: 50%;
    border: 2px solid var(--c, var(--accent)); opacity: 0; pointer-events: none;
  }
  .on::after { animation: burst 550ms var(--ease-out); }
  @keyframes burst { from { opacity: .6; transform: scale(1); } to { opacity: 0; transform: scale(1.9); } }

  /* ---- Almanac ---------------------------------------------------------------- */
  :global(:root[data-style='almanac']) .stamp::before {
  content: 'Done'; position: absolute; left: 30px; top: 50%; z-index: 2; pointer-events: none; white-space: nowrap;
  padding: 1px 6px; border: 2px solid var(--accent); border-radius: 3px; color: var(--accent);
  font: 700 11px/1.3 var(--font-mono); letter-spacing: .16em; text-transform: uppercase;
  background: color-mix(in srgb, var(--surface) 70%, transparent); mix-blend-mode: multiply;
  animation: alm-stamp 1.5s var(--ease-out) forwards;
  }
  @keyframes alm-stamp {
  0% { opacity: 0; transform: translateY(-50%) rotate(-14deg) scale(1.9); }
  12% { opacity: 1; transform: translateY(-50%) rotate(-9deg) scale(1); }
  70% { opacity: 1; transform: translateY(-50%) rotate(-9deg) scale(1); }
  100% { opacity: 0; transform: translateY(-50%) rotate(-9deg) scale(1); }
  }
  :global(:root[data-theme='ink']) .stamp::before { mix-blend-mode: normal; }
  :global(:root[data-style='almanac']) svg { border-radius: 3px; border: 1.5px solid var(--text); padding: 2px; }
  :global(:root[data-style='almanac']) .cb:hover svg { border-color: var(--c); }
  :global(:root[data-style='almanac']) .on svg { background: transparent; border-color: var(--text); animation: none; }
  :global(:root[data-style='almanac']) .on path { stroke: var(--c); stroke-width: 3.6; }
  :global(:root[data-style='almanac']) .cb::after { border-radius: 3px; border-color: var(--c, var(--accent)); }

  /* ---- Nebula (liquid glass) ---------------------------------------------------- */
  :global(:root[data-style='nebula']) .on svg { background: var(--accent-grad); border-color: transparent; box-shadow: 0 0 16px rgba(183, 140, 255, .55); }
  :global(:root[data-style='nebula']) .on path { stroke: #fff; }
  :global(:root[data-style='nebula']) .stamp::before {
  content: ''; position: absolute; inset: 0; margin: auto; width: 6px; height: 6px; border-radius: 50%; pointer-events: none; z-index: 2;
  box-shadow: 0 -18px 0 #ff71c8, 13px -13px 0 #b78cff, 18px 0 0 #5ee6e0, 13px 13px 0 #ffcc6b, 0 18px 0 #b78cff, -13px 13px 0 #ff71c8, -18px 0 0 #5ee6e0, -13px -13px 0 #ffcc6b;
  animation: nb-burst .7s var(--ease-out) forwards;
  }
  @keyframes nb-burst { 0% { opacity: 1; transform: scale(.3); } 70% { opacity: 1; } 100% { opacity: 0; transform: scale(1.35); } }
</style>
