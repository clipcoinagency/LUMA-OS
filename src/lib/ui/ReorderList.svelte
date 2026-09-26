<script lang="ts" generics="T extends { id: string; label: string; description?: string; color?: string }">
  // Accessible reordering: move up/down buttons (touch + keyboard friendly), optional on/off
  // toggles, animated with flip, and moves announced to screen readers.
  import type { Component } from 'svelte';
  import { flip } from 'svelte/animate';
  import { ChevronUp, ChevronDown } from '@lucide/svelte';

  interface Props {
    items: T[];
    label: string;
    icons?: Record<string, Component>;
    enabled?: string[];                 // when provided, rows get a toggle
    onreorder: (ids: string[]) => void;
    ontoggle?: (id: string, on: boolean) => void;
  }
  let { items, label, icons = {}, enabled, onreorder, ontoggle }: Props = $props();
  let announce = $state('');

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const ids = items.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    onreorder(ids);
    announce = `${items[i]!.label} moved to position ${j + 1} of ${items.length}`;
    // keep focus on the same control of the moved row
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>(`[data-reorder="${items[i]!.id}"][data-dir="${dir}"]`);
      (btn && !btn.disabled ? btn : document.querySelector<HTMLButtonElement>(`[data-reorder="${items[i]!.id}"]:not(:disabled)`))?.focus();
    });
  }
</script>

<ul class="list" aria-label={label}>
  {#each items as item, i (item.id)}
    {@const Icon = icons[item.id]}
    {@const on = enabled ? enabled.includes(item.id) : true}
    <li animate:flip={{ duration: 220 }} class:off={!on}>
      {#if Icon}<span class="ico" style="--c:{item.color ?? 'var(--accent)'}" aria-hidden="true"><Icon size={18} /></span>{/if}
      <span class="text">
        <span class="lbl">{item.label}</span>
        {#if item.description}<span class="desc">{item.description}</span>{/if}
      </span>
      {#if enabled}
        <button type="button" role="switch" aria-checked={on} aria-label="Show {item.label}" class="sw" class:on onclick={() => ontoggle?.(item.id, !on)}>
          <span class="thumb"></span>
        </button>
      {/if}
      <span class="moves">
        <button type="button" data-reorder={item.id} data-dir="-1" aria-label="Move {item.label} up" disabled={i === 0} onclick={() => move(i, -1)}><ChevronUp size={18} /></button>
        <button type="button" data-reorder={item.id} data-dir="1" aria-label="Move {item.label} down" disabled={i === items.length - 1} onclick={() => move(i, 1)}><ChevronDown size={18} /></button>
      </span>
    </li>
  {/each}
</ul>
<p class="sr-only" aria-live="polite">{announce}</p>

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  li {
    display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
    border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface);
    transition: opacity var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out);
  }
  li.off { opacity: .6; }
  .ico { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: var(--radius-sm); color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
  .text { flex: 1; min-width: 0; display: grid; }
  .lbl { font-weight: 600; }
  .desc { font-size: var(--text-sm); color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .moves { display: flex; flex: none; }
  .moves button {
    width: 40px; height: 40px; display: grid; place-items: center; border: 0; background: none; border-radius: var(--radius-sm);
    color: var(--text-2); cursor: pointer;
  }
  .moves button:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
  .moves button:disabled { opacity: .25; cursor: default; }
  .sw { position: relative; flex: none; width: 44px; height: 26px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface-3); cursor: pointer; padding: 0; transition: background-color var(--dur), border-color var(--dur); }
  .sw .thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform var(--dur) var(--ease-emphasis); }
  .sw.on { background: var(--accent); border-color: var(--accent); }
  .sw.on .thumb { transform: translateX(18px); }
  :global([data-theme='dark']) .sw.on .thumb { background: var(--on-accent); }
  .sw:focus-visible { border-radius: 999px; }
</style>
