<script lang="ts">
  // Each option is a miniature of the real UI rendered IN that theme (data-theme scoped), so the
  // preview is honest. Selecting applies the theme to the whole app immediately.
  import { Check } from '@lucide/svelte';
  import type { ThemeId } from '../../lib/db/schema';

  interface Props { value: ThemeId; onchange: (t: ThemeId) => void }
  let { value, onchange }: Props = $props();

  const options: { id: ThemeId; name: string; mood: string }[] = [
    { id: 'soft', name: 'Soft', mood: 'Calm cream and dusty rose. Elegant and warm.' },
    { id: 'dark', name: 'Dark', mood: 'Deep navy with cyan light. Focused and modern.' },
  ];
</script>

<div class="grid" role="radiogroup" aria-label="Theme">
  {#each options as o (o.id)}
    <button type="button" role="radio" aria-checked={value === o.id} class="opt" class:on={value === o.id} onclick={() => onchange(o.id)}>
      <div class="preview" data-theme={o.id} aria-hidden="true">
        <div class="pv-top"><span class="pv-dot"></span><span class="pv-title">Good morning</span></div>
        <div class="pv-cards">
          <div class="pv-card">
            <span class="pv-h"></span>
            <span class="pv-row"><span class="pv-check done"></span><span class="pv-line"></span></span>
            <span class="pv-row"><span class="pv-check"></span><span class="pv-line short"></span></span>
          </div>
          <div class="pv-card ring"><span class="pv-ring"></span></div>
        </div>
        <span class="pv-btn">Add task</span>
      </div>
      <div class="info">
        <span class="name">{o.name}</span>
        <span class="mood">{o.mood}</span>
      </div>
      <span class="tick" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
    </button>
  {/each}
</div>

<style>
  .grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); }
  .opt {
    position: relative; text-align: left; padding: var(--space-3); border-radius: var(--radius-xl); cursor: pointer;
    border: 2px solid var(--border); background: var(--surface); color: var(--text); box-shadow: var(--shadow-1);
    transition: border-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .opt:hover { box-shadow: var(--shadow-2); }
  .opt:active { transform: scale(.985); }
  .opt:focus-visible { border-radius: var(--radius-xl); }
  .opt.on { border-color: var(--accent); box-shadow: var(--shadow-2), var(--glow); }

  /* the miniature uses the scoped theme's own tokens */
  .preview {
    background: var(--bg-accent), var(--bg); color: var(--text); border-radius: var(--radius-lg); padding: 14px;
    display: grid; gap: 10px; border: 1px solid var(--border); font-family: var(--font-body); overflow: hidden;
  }
  .pv-top { display: flex; align-items: center; gap: 8px; }
  .pv-dot { width: 18px; height: 18px; border-radius: 30%; background: conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent)); }
  .pv-title { font-family: var(--font-display); font-weight: var(--display-weight); letter-spacing: var(--display-tracking); font-size: 17px; }
  .pv-cards { display: grid; grid-template-columns: 1.6fr 1fr; gap: 8px; }
  .pv-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px; display: grid; gap: 7px; box-shadow: var(--shadow-1); }
  .pv-card.ring { place-items: center; }
  .pv-h { width: 50%; height: 7px; border-radius: 4px; background: var(--text); opacity: .75; }
  .pv-row { display: flex; align-items: center; gap: 6px; }
  .pv-check { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid var(--border-strong); flex: none; }
  .pv-check.done { background: var(--accent); border-color: var(--accent); }
  .pv-line { height: 6px; border-radius: 3px; background: var(--surface-3); flex: 1; }
  .pv-line.short { flex: .6; }
  .pv-ring { width: 40px; height: 40px; border-radius: 50%; background: conic-gradient(var(--accent) 0 68%, var(--surface-3) 68% 100%); -webkit-mask: radial-gradient(circle, transparent 12px, #000 13px); mask: radial-gradient(circle, transparent 12px, #000 13px); box-shadow: var(--glow); }
  .pv-btn { justify-self: start; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: var(--radius-btn); background: var(--accent); color: var(--on-accent); box-shadow: var(--glow); }

  .info { display: grid; gap: 2px; padding: var(--space-3) var(--space-2) var(--space-1); }
  .name { font-weight: 700; font-size: var(--text-md); }
  .mood { color: var(--text-2); font-size: var(--text-sm); }
  .tick {
    position: absolute; top: 20px; right: 20px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
    background: var(--accent); color: var(--on-accent); opacity: 0; transform: scale(.6); transition: opacity var(--dur), transform var(--dur) var(--ease-emphasis);
  }
  .on .tick { opacity: 1; transform: scale(1); }
</style>
