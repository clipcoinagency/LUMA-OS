<script lang="ts">
  // Pick a currency by symbol, code or name: a searchable list with the popular ones up top.
  // Two looks: a labelled form field, or a small pill for page headers (Finance).
  import { Check, ChevronDown, Search } from '@lucide/svelte';
  import Popover from './Popover.svelte';
  import { CURRENCIES, POPULAR_CURRENCIES, currencyName, currencySymbol } from '../util/money';
  import { app } from '../app.svelte';

  interface Props { value?: string; label?: string; hint?: string; variant?: 'field' | 'pill'; onchange?: (v: string) => void; id?: string }
  let { value = $bindable('USD'), label = 'Currency', hint, variant = 'field', onchange, id }: Props = $props();
  const fallback = `cp-${Math.random().toString(36).slice(2, 8)}`;
  const uid = $derived(id ?? fallback);

  const locale = $derived(app.settings?.locale ?? undefined);
  let open = $state(false);
  let query = $state('');
  let trigger: HTMLButtonElement | undefined = $state();

  const all = $derived(CURRENCIES.map((c) => ({ code: c as string, sym: currencySymbol(c, locale), name: currencyName(c, locale) })));
  const q = $derived(query.trim().toLowerCase());
  const matches = $derived(q ? all.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.sym.toLowerCase() === q) : all);
  const popular = $derived(all.filter((c) => (POPULAR_CURRENCIES as readonly string[]).includes(c.code)));
  const cur = $derived(all.find((c) => c.code === value) ?? { code: value, sym: currencySymbol(value, locale), name: currencyName(value, locale) });

  function show() { query = ''; open = true; requestAnimationFrame(() => document.getElementById(`${uid}-q`)?.focus()); }
  function pick(code: string) { value = code; onchange?.(code); open = false; trigger?.focus(); }
</script>

{#if variant === 'pill'}
  <button type="button" class="pill" bind:this={trigger} onclick={show} aria-haspopup="dialog" aria-expanded={open} aria-label="{label}: {cur.code}. Change">
    <span class="sym" aria-hidden="true">{cur.sym}</span><span class="code">{cur.code}</span><ChevronDown size={14} aria-hidden="true" />
  </button>
{:else}
  <div class="field">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <label for={uid} onclick={(e) => { e.preventDefault(); show(); }}>{label}</label>
    <button type="button" id={uid} class="trigger" bind:this={trigger} onclick={show} aria-haspopup="dialog" aria-expanded={open}>
      <span class="disc" aria-hidden="true" style:font-size={cur.sym.length > 2 ? ".6rem" : undefined}>{cur.sym}</span>
      <span class="txt"><strong>{cur.code}</strong><span class="nm">{cur.name}</span></span>
      <ChevronDown size={16} class="chev" aria-hidden="true" />
    </button>
    {#if hint}<p class="hint">{hint}</p>{/if}
  </div>
{/if}

<Popover bind:open anchor={trigger} label="Choose a currency" width={360}>
  <div class="cp">
    <label class="search"><Search size={16} aria-hidden="true" /><span class="sr-only">Search currencies</span>
      <input id="{uid}-q" type="search" placeholder="Search by name, code or symbol…" bind:value={query} onkeydown={(e) => { if (e.key === 'Enter' && matches[0]) pick(matches[0].code); }} />
    </label>
    {#if !q}
      <p class="grp">Popular</p>
      <div class="pop" role="group" aria-label="Popular currencies">
        {#each popular as c (c.code)}
          <button type="button" class="tile" class:on={c.code === value} onclick={() => pick(c.code)} aria-label="{c.name} ({c.code})">
            <span class="disc" aria-hidden="true" style:font-size={c.sym.length > 2 ? ".6rem" : undefined}>{c.sym}</span><span class="tc">{c.code}</span>
          </button>
        {/each}
      </div>
      <p class="grp">All currencies</p>
    {/if}
    <ul class="list" aria-label="Currencies">
      {#each matches as c (c.code)}
        <li>
          <button type="button" class="item" class:on={c.code === value} onclick={() => pick(c.code)} aria-label="{c.name} ({c.code})">
            <span class="disc sm" aria-hidden="true" style:font-size={c.sym.length > 2 ? ".58rem" : undefined}>{c.sym}</span>
            <span class="nm2">{c.name}</span><span class="cd">{c.code}</span>
            {#if c.code === value}<Check size={16} aria-hidden="true" />{/if}
          </button>
        </li>
      {:else}<li class="none">No currency matches “{query}”.</li>{/each}
    </ul>
  </div>
</Popover>

<style>
  .field { display: grid; gap: 6px; min-width: 0; }
  label.search ~ *, .field > label { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .field > label { cursor: pointer; }
  .trigger {
    width: 100%; min-height: var(--touch); display: flex; align-items: center; gap: var(--space-3); text-align: left; padding: 6px 12px 6px 8px; border-radius: var(--radius-sm); cursor: pointer;
    border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font: inherit;
    transition: border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .trigger:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border-strong)); }
  .trigger:focus-visible, .trigger[aria-expanded='true'] { border-color: var(--accent); box-shadow: var(--focus); }
  .trigger :global(.chev) { color: var(--text-3); flex: none; }
  .txt { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: var(--space-2); }
  .nm { color: var(--text-2); font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .disc { width: 32px; height: 32px; border-radius: 11px; display: grid; place-items: center; flex: none; font-weight: 800; font-size: .95rem; color: var(--on-accent); background: var(--accent-grad); box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 28%, transparent); letter-spacing: -.02em; }
  :global(:is([data-theme='soft'], [data-theme='light'])) .disc { color: #fff; }
  .disc.sm { width: 28px; height: 28px; border-radius: 9px; font-size: .85rem; }
  .hint { font-size: var(--text-xs); color: var(--text-3); }

  .pill { display: inline-flex; align-items: center; gap: 6px; height: var(--touch); padding: 0 var(--space-3) 0 6px; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 700; color: var(--text);
    border: 1px solid var(--border-strong); background: var(--surface); transition: border-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
  .pill:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border-strong)); } .pill:active { transform: scale(.96); }
  .pill[aria-expanded='true'] { box-shadow: var(--focus); border-color: var(--accent); }
  .pill .sym { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; color: var(--on-accent); background: var(--accent-grad); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .pill .sym { color: #fff; }

  .cp { padding: var(--space-4); display: grid; gap: var(--space-3); }
  .search { display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-3); min-height: 42px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); }
  .search:focus-within { border-color: var(--accent); box-shadow: var(--focus); }
  .search input { flex: 1; min-width: 0; border: 0; background: none; color: var(--text); outline: none; box-shadow: none; font: inherit; min-height: 40px; }
  .search input:focus-visible { box-shadow: none; }
  .grp { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3); margin: var(--space-1) 0 0; }
  .pop { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); }
  .tile { display: grid; justify-items: center; gap: 4px; padding: var(--space-3) var(--space-1); border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--surface); cursor: pointer; color: var(--text);
    transition: transform .25s var(--ease-emphasis), background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out); }
  .tile:hover { transform: translateY(-2px); background: var(--accent-soft); } .tile:active { transform: scale(.95); }
  .tile.on { border-color: var(--accent); background: var(--accent-soft); }
  .tc { font-size: var(--text-xs); font-weight: 700; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 260px; overflow: auto; }
  .item { width: 100%; display: flex; align-items: center; gap: var(--space-3); padding: 6px 8px; border-radius: var(--radius-sm); border: 0; background: none; color: var(--text); cursor: pointer; text-align: left; font: inherit; transition: background-color var(--dur-fast) var(--ease-out); }
  .item:hover { background: var(--accent-soft); } .item.on { background: var(--accent-soft); font-weight: 650; }
  .nm2 { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cd { font-size: var(--text-xs); font-weight: 700; color: var(--text-2); }
  .none { padding: var(--space-4); text-align: center; color: var(--text-2); }
</style>
