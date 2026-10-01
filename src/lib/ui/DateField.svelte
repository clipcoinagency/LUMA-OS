<script lang="ts">
  // A friendlier date picker. The field shows the date in words ("Thu, 2 Oct · Today"); tapping it opens a
  // small calendar with one-tap shortcuts (Today, Tomorrow, Next week…), month paging and full keyboard
  // support. A real <input type="date"> stays in the DOM (visually hidden) as the source of truth, so
  // typing, autofill, screen readers and tests keep working exactly like a native date field.
  import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, X } from '@lucide/svelte';
  import Popover from './Popover.svelte';
  import { app } from '../app.svelte';
  import { addDays, addMonths, diffDays, formatDateKey, fromDateKey, isDateKey, startOfMonth, startOfWeek, today, weekday, type DateKey } from '../util/dates';

  interface Props { label: string; value?: string; hint?: string; error?: string; optional?: boolean; id?: string; min?: string; oninput?: (v: string) => void; compact?: boolean }
  let { label, value = $bindable(''), hint, error, optional = false, id, min, oninput, compact = false }: Props = $props();
  const fallback = `df-${Math.random().toString(36).slice(2, 8)}`;
  const uid = $derived(id ?? fallback);

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let view = $state<DateKey>(startOfMonth(today()));   // first of the month being shown
  let focusDay = $state<DateKey>(today());
  let dir = $state(1);

  const wso = $derived((app.settings?.weekStartsOn ?? 1) as 0 | 1);
  const t = $derived(today());
  const valid = $derived(isDateKey(value));
  const word = $derived(valid ? formatDateKey(value, { weekday: 'short', day: 'numeric', month: 'short', year: value.slice(0, 4) === t.slice(0, 4) ? undefined : 'numeric' }) : '');
  const rel = $derived.by(() => {
    if (!valid) return '';
    const n = diffDays(t, value);
    return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 1 && n < 14 ? `In ${n} days` : n < -1 && n > -14 ? `${-n} days ago` : '';
  });

  const monthTitle = $derived(formatDateKey(view, { month: 'long', year: 'numeric' }));
  const heads = $derived(Array.from({ length: 7 }, (_, i) => formatDateKey(addDays(startOfWeek(t, wso), i), { weekday: 'narrow' })));
  const days = $derived.by(() => {
    const first = startOfWeek(view, wso);
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  });
  const nextMon = $derived(addDays(t, ((8 - weekday(t)) % 7) || 7));
  const chips = $derived([
    { k: 'Today', v: t }, { k: 'Tomorrow', v: addDays(t, 1) }, { k: 'Next week', v: addDays(t, 7) }, { k: 'Next Monday', v: nextMon }, { k: 'In a month', v: addMonths(t, 1) },
  ].filter((c, i, a) => a.findIndex((x) => x.v === c.v) === i));

  function show() {
    const base = valid ? (value as DateKey) : t;
    view = startOfMonth(base); focusDay = base; open = true;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${uid}-grid [data-day="${focusDay}"]`)?.focus());
  }
  function pick(d: DateKey) {
    if (min && d < min) return;
    value = d; oninput?.(d); open = false; trigger?.focus();
  }
  function clear() { value = ''; oninput?.(''); open = false; trigger?.focus(); }
  function page(n: number) { dir = n; view = addMonths(view, n); focusDay = addMonths(focusDay, n); }
  function key(e: KeyboardEvent) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: DateKey | null = null;
    if (e.key in step) next = addDays(focusDay, step[e.key]!);
    else if (e.key === 'PageDown') next = addMonths(focusDay, e.shiftKey ? 12 : 1);
    else if (e.key === 'PageUp') next = addMonths(focusDay, e.shiftKey ? -12 : -1);
    else if (e.key === 'Home') next = startOfWeek(focusDay, wso);
    else if (e.key === 'End') next = addDays(startOfWeek(focusDay, wso), 6);
    if (!next) return;
    e.preventDefault();
    focusDay = next; view = startOfMonth(next);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${uid}-grid [data-day="${next}"]`)?.focus());
  }
</script>

<div class="field" class:invalid={!!error} class:compact>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <label for={uid} onclick={(e) => { e.preventDefault(); show(); }}>{label}</label>
  <div class="wrap">
    <button type="button" class="trigger" bind:this={trigger} onclick={show} aria-haspopup="dialog" aria-expanded={open} aria-label="Open calendar">
      <span class="ico" aria-hidden="true"><CalendarDays size={17} /></span>
      <span class="txt">{#if valid}<strong>{word}</strong>{#if rel}<em>{rel}</em>{/if}{:else}<span class="ph">{optional ? 'No date' : 'Choose a date'}</span>{/if}</span>
      <ChevronDown size={16} class="chev" aria-hidden="true" />
    </button>
    <input id={uid} class="native" type="date" bind:value {min} tabindex="-1" aria-label={compact ? label : undefined} aria-invalid={!!error} oninput={() => oninput?.(value)} />
  </div>
  {#if error}<p class="err" role="alert">{error}</p>{:else if hint}<p class="hint">{hint}</p>{/if}
</div>

<Popover bind:open anchor={trigger} label="Calendar" width={332}>
  <div class="cal">
    <div class="chips" role="group" aria-label="Quick dates">
      {#each chips as c (c.k)}<button type="button" class="chip" class:on={value === c.v} onclick={() => pick(c.v)}>{c.k}</button>{/each}
    </div>
    <div class="nav">
      <button type="button" class="nb" aria-label="Previous month" onclick={() => page(-1)}><ChevronLeft size={18} /></button>
      {#key view}<h3 class="mt" style="--d:{dir}" aria-live="polite">{monthTitle}</h3>{/key}
      <button type="button" class="nb" aria-label="Next month" onclick={() => page(1)}><ChevronRight size={18} /></button>
    </div>
    <div class="grid heads" aria-hidden="true">{#each heads as h, i (i)}<span>{h}</span>{/each}</div>
    {#key view}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="grid days" id="{uid}-grid" role="group" aria-label={monthTitle} onkeydown={key} style="--d:{dir}">
        {#each days as d (d)}
          {@const inMonth = d.slice(0, 7) === view.slice(0, 7)}
          {@const dis = !!min && d < min}
          <button type="button" class="day" class:out={!inMonth} class:today={d === t} class:sel={d === value} disabled={dis}
            data-day={d} tabindex={d === focusDay ? 0 : -1} aria-pressed={d === value} aria-current={d === t ? 'date' : undefined} aria-label={formatDateKey(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} onclick={() => pick(d)}>
            {fromDateKey(d).getDate()}
          </button>
        {/each}
      </div>
    {/key}
    <div class="foot">
      <span class="sel-txt">{valid ? formatDateKey(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'No date chosen'}</span>
      {#if optional && valid}<button type="button" class="clear" onclick={clear}><X size={14} aria-hidden="true" />Clear</button>{/if}
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
  .ico { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; color: var(--on-accent); background: var(--accent-grad); box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .ico { color: #fff; }
  .txt { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: var(--space-2); flex-wrap: wrap; }
  .txt strong { font-weight: 650; }
  .txt em { font-style: normal; font-size: var(--text-xs); font-weight: 700; color: var(--accent-ink); padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); }
  .ph { color: var(--text-3); }
  .trigger :global(.chev) { color: var(--text-3); flex: none; }
  /* the real input: present for typing, autofill, assistive tech and tests — just not drawn */
  .native { position: absolute; left: 0; bottom: 0; width: 1px; height: 1px; padding: 0; border: 0; opacity: 0; pointer-events: none; overflow: hidden; }
  .invalid .trigger { border-color: var(--danger); }
  .hint { font-size: var(--text-xs); color: var(--text-3); } .err { font-size: var(--text-xs); color: var(--danger); font-weight: 600; }
  .compact label { display: none; } .compact .trigger { min-height: 38px; }

  .cal { padding: var(--space-4); display: grid; gap: var(--space-3); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { flex: none; height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: var(--text-xs); font-weight: 700; cursor: pointer; transition: background-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  .chip:hover { background: var(--accent-soft); } .chip:active { transform: scale(.94); }
  .chip.on { background: var(--accent-grad); color: var(--on-accent); border-color: transparent; }
  :global(:is([data-theme='soft'], [data-theme='light'])) .chip.on { color: #fff; }
  .nav { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); overflow: hidden; }
  .mt { font-size: var(--text-md); font-weight: 700; flex: 1; text-align: center; animation: slide .35s var(--ease-glide); }
  @keyframes slide { from { opacity: 0; transform: translateX(calc(var(--d) * 18px)); } }
  .nb { width: 36px; height: 36px; border-radius: 12px; border: 0; background: var(--surface-2); color: var(--text); display: grid; place-items: center; cursor: pointer; transition: background-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  .nb:hover { background: var(--accent-soft); } .nb:active { transform: scale(.9); }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .heads span { text-align: center; font-size: var(--text-xs); font-weight: 700; color: var(--text-3); padding: 4px 0; }
  .days { animation: slide .35s var(--ease-glide); }
  .day {
    aspect-ratio: 1; border-radius: 50%; border: 0; background: none; color: var(--text); font: inherit; font-size: var(--text-sm); font-weight: 600; cursor: pointer; position: relative;
    transition: background-color var(--dur-fast) var(--ease-out), transform .25s var(--ease-emphasis), box-shadow var(--dur) var(--ease-out);
  }
  .day:hover:not(:disabled) { background: var(--accent-soft); transform: scale(1.1); }
  .day.out { color: var(--text-3); font-weight: 500; }
  .day.today { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent); }
  .day.sel { background: var(--accent-grad); color: var(--on-accent); transform: scale(1.06); box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 40%, transparent); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .day.sel { color: #fff; }
  .day:disabled { opacity: .3; cursor: not-allowed; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border); min-height: 36px; }
  .sel-txt { font-size: var(--text-xs); color: var(--text-2); font-weight: 600; }
  .clear { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--danger); font-weight: 700; font-size: var(--text-xs); cursor: pointer; padding: 6px 8px; border-radius: 8px; }
  .clear:hover { background: var(--danger-soft); }
</style>
