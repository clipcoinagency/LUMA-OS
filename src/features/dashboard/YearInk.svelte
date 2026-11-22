<script lang="ts">
  // Almanac only: "The year in ink" — 53 weeks, one square per day, darker the more you did (tasks
  // finished, habits checked, focus, reading, notes). Hover or tap a day to read it back. Built only
  // from your own records; an empty day stays blank paper.
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { formatDateKey } from '../../lib/util/dates';
  import { loadYearInk, type InkDay } from '../../lib/domain/almanac';
  import { styleOf } from '../../lib/theme';
  const title = $derived(styleOf(app.settings?.theme ?? 'paper') === 'nebula' ? 'The year in light' : 'The year in ink');

  let days = $state.raw<InkDay[]>([]);
  let picked = $state<InkDay | null>(null);
  $effect(() => {
    const v = changes.version;
    const end = clock.today;
    const ws = app.settings?.weekStartsOn ?? 1;
    void loadYearInk(end, ws).then((r) => { if (v === changes.version) days = r.days; });
  });

  const CELL = 12, GAP = 3, TOP = 16;
  const weeks = $derived(Math.ceil(days.length / 7));
  const W = $derived(weeks * (CELL + GAP));
  const level = (s: number) => (s <= 0 ? 0 : s <= 2 ? 1 : s <= 5 ? 2 : s <= 9 ? 3 : 4);
  // a month's label sits above the week column that contains its 1st
  const months = $derived.by(() => {
    const out: { x: number; label: string }[] = [];
    for (let w = 0; w < weeks; w++) {
      const first = days.slice(w * 7, w * 7 + 7).find((d) => d.date.endsWith('-01'));
      if (first) out.push({ x: w * (CELL + GAP), label: formatDateKey(first.date, { month: 'short' }) });
    }
    return out;
  });

  const inked = $derived(days.filter((d) => d.score > 0).length);
  const streaks = $derived.by(() => {
    let best = 0, run = 0;
    for (const d of days) { run = d.score > 0 ? run + 1 : 0; best = Math.max(best, run); }
    let cur = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i]!.score > 0) cur++;
      else if (i === days.length - 1) continue; // today not inked yet doesn't break the run
      else break;
    }
    return { best, cur };
  });

  function describe(d: InkDay): string {
    const parts: string[] = [];
    if (d.tasks) parts.push(`${d.tasks} task${d.tasks === 1 ? '' : 's'} done`);
    if (d.habits) parts.push(`${d.habits} habit check-in${d.habits === 1 ? '' : 's'}`);
    if (d.focusMin) parts.push(`${d.focusMin} min focus`);
    if (d.reading) parts.push(`${d.reading} reading session${d.reading === 1 ? '' : 's'}`);
    if (d.notes) parts.push(`${d.notes} note${d.notes === 1 ? '' : 's'}`);
    return parts.length ? parts.join(' · ') : 'Nothing recorded — a blank page.';
  }
  // keyboard: ←/→ a week, ↑/↓ a day; the caption (aria-live) reads the day back
  function key(e: KeyboardEvent) {
    const step = ({ ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 } as Record<string, number>)[e.key];
    if (step === undefined || !days.length) return;
    e.preventDefault();
    const i = picked ? days.findIndex((d) => d.date === picked!.date) : days.length - 1;
    picked = days[Math.min(days.length - 1, Math.max(0, i + step))]!;
  }
  function pick(e: Event) {
    const i = Number((e.target as Element).getAttribute?.('data-i'));
    if (!Number.isNaN(i) && days[i]) picked = days[i]!;
  }
</script>

{#if days.length}
  <section class="yi gcard" aria-labelledby="yi-h">
    <header>
      <h2 id="yi-h">{title}</h2>
      <p class="kicker stats"><span><b>{inked}</b> days inked</span><span>Longest run <b>{streaks.best}</b></span><span>Current run <b>{streaks.cur}</b></span></p>
    </header>
    <!-- one keyboard stop: the arrow keys walk the days (a slider over the year), the caption reads it -->
    <div class="scroll" role="slider" tabindex="0" aria-label="{title} — {inked} days recorded, longest run {streaks.best} days. Arrow keys move between days."
      aria-valuemin={0} aria-valuemax={days.length - 1} aria-valuenow={picked ? days.findIndex((d) => d.date === picked!.date) : days.length - 1}
      aria-valuetext={picked ? `${formatDateKey(picked.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${describe(picked)}` : 'Today'}
      onpointerover={pick} onclick={pick} onkeydown={key}>
      <svg viewBox="0 0 {W} {TOP + 7 * (CELL + GAP)}" width={W} aria-hidden="true">
        {#each months as m (m.x)}<text x={m.x} y="10" class="mo">{m.label}</text>{/each}
        {#each days as d, i (d.date)}
          <rect data-i={i} x={Math.floor(i / 7) * (CELL + GAP)} y={TOP + (i % 7) * (CELL + GAP)} width={CELL} height={CELL} rx="1.5"
            class="c l{level(d.score)}" class:today={d.date === clock.today} class:on={picked?.date === d.date} />
        {/each}
      </svg>
    </div>
    <p class="cap" id="yi-cap" aria-live="polite">
      {#if picked}<b>{formatDateKey(picked.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b> — {describe(picked)}
      {:else}Each square is a day; the {title.endsWith('light') ? 'brighter the light' : 'darker the ink'}, the more you did. Point at a day to read it back.{/if}
    </p>
    <div class="legend kicker" aria-hidden="true">Less <i class="c l0"></i><i class="c l1"></i><i class="c l2"></i><i class="c l3"></i><i class="c l4"></i> More</div>
  </section>
{/if}

<style>
  .yi { margin-top: var(--space-8); padding: var(--space-5); --c: var(--accent); }
  :global(:root[data-style='almanac']) .yi { margin-top: var(--space-10); background: none; border: 0; border-top: 2px solid var(--text); border-radius: 0; padding: var(--space-3) 0 0; }
  :global(:root[data-style='nebula']) .c { fill: var(--accent); }
  :global(:root[data-style='nebula']) .l0 { fill: rgba(255, 255, 255, .03); stroke: rgba(214, 190, 255, .12); }
  :global(:root[data-style='nebula']) .l4 { fill: #ff9fe0; filter: drop-shadow(0 0 3px rgba(255, 113, 200, .8)); }
  :global(:root[data-style='nebula']) .legend i { background: var(--accent); }
  :global(:root[data-style='nebula']) .legend i:last-of-type { background: #ff9fe0; }
  :global(:root[data-style='nebula']) h2 { font-style: normal; font-weight: 640; font-size: var(--text-lg); letter-spacing: -0.02em; }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4); }
  h2 { font-size: clamp(26px, 2.6vw, 34px); font-weight: 340; font-style: italic; letter-spacing: -0.03em; }
  .stats { display: flex; gap: var(--space-5); flex-wrap: wrap; }
  .stats b { font-family: var(--font-display); font-size: 17px; font-weight: 400; letter-spacing: 0; color: var(--text); text-transform: none; margin-right: 2px; }
  .scroll { overflow-x: auto; padding-bottom: var(--space-2); scrollbar-width: thin; }
  svg { display: block; max-width: none; height: auto; }
  .scroll:focus-visible { box-shadow: var(--focus); border-radius: 2px; }
  .mo { font: 500 9.5px var(--font-mono); letter-spacing: .08em; fill: var(--text-3); text-transform: uppercase; }
  .c { fill: var(--text); stroke: none; transition: opacity var(--dur) var(--ease-out); cursor: pointer; }
  .l0 { fill: transparent; stroke: color-mix(in srgb, var(--text) 16%, transparent); stroke-width: 1; }
  .l1 { opacity: .22; } .l2 { opacity: .45; } .l3 { opacity: .7; } .l4 { opacity: 1; }
  .c.today { stroke: var(--accent); stroke-width: 2; }
  .c.on { stroke: var(--accent); stroke-width: 2.5; }
  rect.c:hover { stroke: var(--accent); stroke-width: 2; }
  .cap { margin-top: var(--space-3); font-size: var(--text-sm); color: var(--text-2); min-height: 1.5em; }
  .cap b { font-family: var(--font-display); font-style: italic; font-weight: 400; font-size: 16px; color: var(--text); }
  .legend { display: flex; align-items: center; gap: 4px; justify-content: flex-end; margin-top: var(--space-2); font-size: 9.5px; color: var(--text-3); }
  .legend i { display: inline-block; width: 11px; height: 11px; border-radius: 1.5px; background: var(--text); }
  .legend i.l0 { background: transparent; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 16%, transparent); }
  .legend i.l1 { opacity: .22; } .legend i.l2 { opacity: .45; } .legend i.l3 { opacity: .7; }
  .legend i:first-of-type { margin-left: 6px; } .legend i:last-of-type { margin-right: 6px; }
</style>
