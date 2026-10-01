<script lang="ts">
  // A friendlier time picker: the field reads "9:30 AM · Morning"; tapping it opens one-tap shortcuts and
  // a three-column wheel (hour · minute · AM/PM, or 24-hour to match the device). As with DateField, a real
  // <input type="time"> stays in the DOM (visually hidden) as the source of truth.
  import { Clock3, ChevronDown, X } from '@lucide/svelte';
  import Popover from './Popover.svelte';
  import WheelColumn from './WheelColumn.svelte';
  import { app } from '../app.svelte';

  interface Props { label: string; value?: string; hint?: string; error?: string; optional?: boolean; id?: string; oninput?: (v: string) => void }
  let { label, value = $bindable(''), hint, error, optional = false, id, oninput }: Props = $props();
  const fallback = `tf-${Math.random().toString(36).slice(2, 8)}`;
  const uid = $derived(id ?? fallback);

  const locale = $derived(app.settings?.locale ?? undefined);
  const is12 = $derived(new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ?? false);
  const pad = (n: number) => String(n).padStart(2, '0');
  const parse = (v: string): [number, number] | null => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v); return m ? [Number(m[1]), Number(m[2])] : null; };
  const fmt = (h: number, m: number) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h, m));

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let h = $state(9);
  let m = $state(0);

  const parsed = $derived(parse(value));
  const word = $derived(parsed ? fmt(parsed[0], parsed[1]) : '');
  const part = $derived(!parsed ? '' : parsed[0] < 5 ? 'Night' : parsed[0] < 12 ? 'Morning' : parsed[0] < 17 ? 'Afternoon' : parsed[0] < 21 ? 'Evening' : 'Night');

  function show() {
    const p = parsed ?? [9, 0];
    h = p[0]; m = p[1]; open = true;
  }
  function commit() { value = `${pad(h)}:${pad(m)}`; oninput?.(value); }
  function setTime(nh: number, nm: number, close = false) { h = nh; m = nm; commit(); if (close) { open = false; trigger?.focus(); } }
  function clear() { value = ''; oninput?.(''); open = false; trigger?.focus(); }
  function nowRounded(): [number, number] {
    const d = new Date(); let mm = Math.ceil(d.getMinutes() / 5) * 5, hh = d.getHours();
    if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
    return [hh, mm];
  }
  const chips = $derived([
    { k: 'Now', t: nowRounded() }, { k: fmt(8, 0), t: [8, 0] as [number, number] }, { k: fmt(12, 0), t: [12, 0] as [number, number] }, { k: fmt(15, 0), t: [15, 0] as [number, number] },
    { k: fmt(18, 0), t: [18, 0] as [number, number] }, { k: fmt(21, 0), t: [21, 0] as [number, number] },
  ]);

  // wheel data
  const hourItems = $derived(is12 ? Array.from({ length: 12 }, (_, i) => String(i + 1)) : Array.from({ length: 24 }, (_, i) => pad(i)));
  const hIdx = $derived(is12 ? (h % 12 || 12) - 1 : h);
  const minuteVals = $derived(Array.from(new Set([...Array.from({ length: 12 }, (_, i) => i * 5), m])).sort((a, b) => a - b));
  const mIdx = $derived(minuteVals.indexOf(m));
  const pm = $derived(h >= 12);
  function pickHour(i: number) { const nh = is12 ? ((i + 1) % 12) + (pm ? 12 : 0) : i; setTime(nh, m); }
  const pickMinute = (i: number) => setTime(h, minuteVals[i]!);
  const pickPeriod = (i: number) => setTime((h % 12) + (i === 1 ? 12 : 0), m);
</script>

<div class="field" class:invalid={!!error}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <label for={uid} onclick={(e) => { e.preventDefault(); show(); }}>{label}</label>
  <div class="wrap">
    <button type="button" class="trigger" bind:this={trigger} onclick={show} aria-haspopup="dialog" aria-expanded={open} aria-label="Open time picker">
      <span class="ico" aria-hidden="true"><Clock3 size={17} /></span>
      <span class="txt">{#if parsed}<strong class="num">{word}</strong><em>{part}</em>{:else}<span class="ph">{optional ? 'No time' : 'Choose a time'}</span>{/if}</span>
      <ChevronDown size={16} class="chev" aria-hidden="true" />
    </button>
    <input id={uid} class="native" type="time" bind:value tabindex="-1" aria-invalid={!!error} oninput={() => oninput?.(value)} />
  </div>
  {#if error}<p class="err" role="alert">{error}</p>{:else if hint}<p class="hint">{hint}</p>{/if}
</div>

<Popover bind:open anchor={trigger} label="Time picker" width={320}>
  <div class="tp">
    <div class="chips" role="group" aria-label="Quick times">
      {#each chips as c (c.k)}<button type="button" class="chip" onclick={() => setTime(c.t[0], c.t[1], true)}>{c.k}</button>{/each}
    </div>
    <div class="wheels" role="group" aria-label="Choose hour and minute">
      <WheelColumn items={hourItems} index={hIdx} label="Hour" onpick={pickHour} />
      <span class="colon" aria-hidden="true">:</span>
      <WheelColumn items={minuteVals.map(pad)} index={mIdx} label="Minute" onpick={pickMinute} />
      {#if is12}<WheelColumn items={['AM', 'PM']} index={pm ? 1 : 0} label="AM or PM" circular={false} onpick={pickPeriod} />{/if}
    </div>
    <div class="foot">
      {#if optional && parsed}<button type="button" class="clear" onclick={clear}><X size={14} aria-hidden="true" />Clear</button>{:else}<span></span>{/if}
      <button type="button" class="done" onclick={() => { if (!parsed) commit(); open = false; trigger?.focus(); }}>Done</button>
    </div>
  </div>
</Popover>

<style>
  .field { display: grid; gap: 6px; min-width: 0; }
  label { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); cursor: pointer; }
  .wrap { position: relative; }
  .trigger {
    width: 100%; min-height: var(--touch); display: flex; align-items: center; gap: var(--space-3); text-align: left; padding: 6px 12px 6px 8px; border-radius: var(--radius-sm); cursor: pointer;
    border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font: inherit;
    transition: border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  }
  .trigger:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border-strong)); }
  .trigger:active { transform: scale(.992); }
  .trigger:focus-visible, .trigger[aria-expanded='true'] { border-color: var(--accent); box-shadow: var(--focus); }
  .ico { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; color: var(--on-accent); background: linear-gradient(135deg, var(--accent-2), var(--accent)); box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .ico { color: #fff; }
  .txt { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: var(--space-2); flex-wrap: wrap; }
  .txt strong { font-weight: 650; }
  .txt em { font-style: normal; font-size: var(--text-xs); font-weight: 700; color: var(--accent-ink); padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); }
  .ph { color: var(--text-3); }
  .trigger :global(.chev) { color: var(--text-3); flex: none; }
  .native { position: absolute; left: 0; bottom: 0; width: 1px; height: 1px; padding: 0; border: 0; opacity: 0; pointer-events: none; overflow: hidden; }
  .invalid .trigger { border-color: var(--danger); }
  .hint { font-size: var(--text-xs); color: var(--text-3); } .err { font-size: var(--text-xs); color: var(--danger); font-weight: 600; }

  .tp { padding: var(--space-4); display: grid; gap: var(--space-3); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { flex: none; height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: var(--text-xs); font-weight: 700; cursor: pointer; transition: background-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  .chip:hover { background: var(--accent-soft); } .chip:active { transform: scale(.94); }
  .wheels { display: flex; align-items: center; gap: var(--space-2); }
  .colon { font-weight: 800; font-size: var(--text-xl); color: var(--text-3); padding-bottom: 2px; }
  .foot { display: flex; align-items: center; justify-content: space-between; }
  .done { min-height: 38px; padding: 0 var(--space-5); border: 0; border-radius: 999px; cursor: pointer; font-weight: 700; color: var(--on-accent); background: var(--accent-grad); box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 32%, transparent); transition: transform var(--dur-fast) var(--ease-out); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .done { color: #fff; }
  .done:active { transform: scale(.95); }
  .clear { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--danger); font-weight: 700; font-size: var(--text-xs); cursor: pointer; padding: 6px 8px; border-radius: 8px; }
  .clear:hover { background: var(--danger-soft); }
</style>
