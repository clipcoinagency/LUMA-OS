<script lang="ts">
  // "Who is this for?" — pick a starting point; the next step lets you fine-tune every area.
  import { Check } from '@lucide/svelte';
  import { PERSONAS, type Persona } from '../../lib/personas';
  import { MODULES } from '../../lib/modules';

  interface Props { value: string | null; onchange: (p: Persona) => void }
  let { value, onchange }: Props = $props();
</script>

<div class="grid" role="radiogroup" aria-label="Starting point">
  {#each PERSONAS as p, i (p.id)}
    {@const on = value === p.id}
    <button type="button" role="radio" aria-checked={on} class="card" class:on style="--c:{p.color};--i:{i}" onclick={() => onchange(p)}>
      <span class="ico" aria-hidden="true"><p.icon size={24} /></span>
      <span class="name">{p.name}</span>
      <span class="tag">{p.tagline}</span>
      <span class="chips" aria-hidden="true">{#each p.modules.slice(0, 5) as m (m)}<i style="--c:{MODULES[m].color}"></i>{/each}{#if p.modules.length > 5}<small>+{p.modules.length - 5}</small>{/if}</span>
      <span class="tick" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
    </button>
  {/each}
</div>

<style>
  .grid { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 270px), 1fr)); }
  .card {
    position: relative; display: grid; gap: 6px; align-content: start; text-align: left; cursor: pointer; padding: var(--space-5); min-height: 168px;
    border-radius: var(--radius-xl); border: 1.5px solid var(--glass-border); background: var(--glass-bg); color: var(--text); box-shadow: var(--glass-highlight);
    -webkit-backdrop-filter: blur(var(--glass-blur)); backdrop-filter: blur(var(--glass-blur));
    animation: rise var(--dur-slow) var(--ease-glide) both; animation-delay: calc(var(--i) * 55ms);
    transition: border-color var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  .card:hover { border-color: color-mix(in srgb, var(--c) 55%, var(--glass-border)); transform: translateY(-2px); }
  .card:active { transform: scale(.985); }
  .card.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 9%, var(--glass-bg)); box-shadow: 0 0 0 1px var(--c), 0 10px 40px color-mix(in srgb, var(--c) 22%, transparent); }
  .ico { width: 48px; height: 48px; border-radius: var(--radius-md); display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent); margin-bottom: 4px; transition: transform var(--dur) var(--ease-emphasis); }
  .on .ico { transform: scale(1.08) rotate(-4deg); }
  .name { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-lg); }
  .tag { font-size: var(--text-sm); color: var(--text-2); line-height: 1.35; }
  .chips { display: flex; align-items: center; gap: 5px; margin-top: auto; padding-top: var(--space-2); }
  .chips i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); box-shadow: 0 0 8px color-mix(in srgb, var(--c) 55%, transparent); }
  .chips small { font-size: var(--text-xs); color: var(--text-3); font-weight: 700; }
  .tick { position: absolute; top: var(--space-4); right: var(--space-4); width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--border-strong); color: transparent; transition: all var(--dur) var(--ease-emphasis); }
  .on .tick { background: var(--c); border-color: var(--c); color: var(--bg); transform: scale(1.06); }
</style>
