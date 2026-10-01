<script lang="ts">
  // Insights: patterns from your own records. Only things the data genuinely supports appear; the rest
  // show how much more is needed ("still learning") instead of a guess.
  import { LineChart, Sparkles } from '../../lib/navicons';
  import Skeleton from '../../lib/ui/Skeleton.svelte';
  import ProgressRing from '../../lib/ui/ProgressRing.svelte';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { computeInsights, loadInsightsData, type Insight, type InsightsResult, type SeriesFormat } from '../../lib/domain/insights';
  import { formatMinutes } from '../../lib/domain/focus';
  import { formatMoney } from '../../lib/util/money';

  let result = $state.raw<InsightsResult | null>(null);

  $effect(() => {
    const v = changes.version;
    const ws = app.workspace, st = app.settings;
    if (!ws || !st) return;
    void loadInsightsData({ today: clock.today, weekStartsOn: st.weekStartsOn, enabled: ws.enabledModules, currency: st.currency }).then((d) => {
      if (v === changes.version) result = computeInsights(d);
    });
  });

  const COLOR: Record<Insight['area'], string> = {
    tasks: 'var(--mod-tasks)', habits: 'var(--mod-habits)', focus: 'var(--mod-focus)', goals: 'var(--mod-goals)',
    spending: 'var(--mod-finance)', wellness: 'var(--mod-wellness)', patterns: 'var(--accent-2)',
  };
  const AREA: Record<Insight['area'], string> = { tasks: 'Tasks', habits: 'Habits', focus: 'Focus', goals: 'Goals', spending: 'Spending', wellness: 'Wellness', patterns: 'Patterns' };

  function fmt(v: number, f: SeriesFormat = 'count'): string {
    if (f === 'minutes') return formatMinutes(v);
    if (f === 'percent') return `${v}%`;
    if (f === 'money') return formatMoney(Math.round(v * 100), app.settings?.currency ?? 'USD');
    return String(v);
  }
  const overall = $derived(result ? Math.min(1, result.daysOfData / 14) : 0);
  let tip = $state<{ id: string; i: number } | null>(null);
</script>

<header class="ph">
  <span class="ico" aria-hidden="true"><LineChart size={24} /></span>
  <div class="t"><h1>Insights</h1><p class="muted">Patterns found in your own data — never guesses.</p></div>
</header>

{#if !result}
  <div class="grid"><Skeleton lines={4} /><Skeleton lines={4} /></div>
{:else}
  {#if result.ready.length === 0}
    <section class="learn glass-strong" aria-label="Still learning">
      <ProgressRing value={Math.round(overall * 100)} size={96} stroke={9} label="Learning progress" color="var(--accent)" />
      <div>
        <h2>We're still learning your patterns.</h2>
        <p class="muted">{result.daysOfData === 0 ? 'Use Life OS for a few days — add tasks, check in habits, run a focus session — and insights start to appear here.' : `Day ${result.daysOfData} of about 14. Keep going and this page fills in by itself.`}</p>
      </div>
    </section>
  {:else}
    <p class="count"><Sparkles size={15} aria-hidden="true" />{result.ready.length} insight{result.ready.length === 1 ? '' : 's'} from {result.daysOfData} days of data</p>
  {/if}

  {#if result.ready.length}
    <div class="grid">
      {#each result.ready as ins, n (ins.id)}
        {@const max = Math.max(1, ...(ins.series ?? []).map((s) => s.value))}
        <article class="card solid" style="--c:{COLOR[ins.area]};--n:{n}">
          <p class="area"><span class="dot" aria-hidden="true"></span>{AREA[ins.area]} · {ins.title}</p>
          <h2>{ins.headline}</h2>
          {#if ins.detail}<p class="detail">{ins.detail}</p>{/if}
          {#if ins.series?.length}
            <figure class="chart" aria-label={ins.note ?? ins.title}>
              <div class="bars" style="--cols:{ins.series.length}">
                {#each ins.series as s, i (s.label + i)}
                  <div class="col" class:top={s.value === max && max > 0}
                    onpointerenter={() => (tip = { id: ins.id, i })} onpointerleave={() => (tip = null)} role="presentation">
                    <span class="bar" style="height:{Math.max(3, (s.value / max) * 100)}%;animation-delay:{i * 40 + 150}ms"></span>
                    {#if tip?.id === ins.id && tip.i === i}<span class="tip">{fmt(s.value, ins.format)}</span>{/if}
                    <span class="lbl">{s.label}</span>
                  </div>
                {/each}
              </div>
              <table class="sr-only"><caption>{ins.note ?? ins.title}</caption><tbody>{#each ins.series as s (s.label)}<tr><th scope="row">{s.label}</th><td>{fmt(s.value, ins.format)}</td></tr>{/each}</tbody></table>
            </figure>
          {/if}
          {#if ins.note}<p class="note">{ins.note}</p>{/if}
        </article>
      {/each}
    </div>
  {/if}

  {#if result.learning.length}
    <section class="soon" aria-labelledby="sl">
      <h2 id="sl">On the way</h2>
      <ul>
        {#each result.learning as l (l.id)}
          <li style="--c:{COLOR[l.area]}">
            <span class="ar">{AREA[l.area]} · {l.title}</span>
            <span class="need">{l.need}</span>
            <span class="meter" role="progressbar" aria-label="{l.title} data collected" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(l.progress * 100)}><i style="width:{Math.round(l.progress * 100)}%"></i></span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/if}

<style>
  .ph { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
  .ico { width: 52px; height: 52px; border-radius: var(--radius-lg); display: grid; place-items: center; color: var(--mod-insights); background: color-mix(in srgb, var(--mod-insights) 14%, transparent); box-shadow: var(--glow); flex: none; }
  .t { flex: 1; min-width: 200px; }
  .count { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-4); }
  .learn { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-7); border-radius: var(--radius-2xl); margin-bottom: var(--space-6); flex-wrap: wrap; }
  .learn h2 { font-size: var(--text-xl); margin-bottom: var(--space-2); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: var(--space-4); align-items: start; }
  .card { padding: var(--space-5); border-radius: var(--radius-xl); display: grid; gap: var(--space-3); animation: rise var(--dur-slow) var(--ease-glide) both; animation-delay: calc(var(--n) * 70ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  .area { display: flex; align-items: center; gap: 8px; font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px color-mix(in srgb, var(--c) 70%, transparent); }
  .card h2 { font-size: var(--text-xl); line-height: 1.2; }
  .detail { color: var(--text-2); font-size: var(--text-sm); }
  .note { color: var(--text-3); font-size: var(--text-xs); }

  .chart { margin: var(--space-2) 0 0; }
  .bars { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 5px; align-items: end; height: 130px; padding-bottom: 20px; }
  .col { position: relative; height: 100%; display: flex; align-items: flex-end; justify-content: center; }
  .bar { width: 100%; max-width: 26px; border-radius: 7px 7px 3px 3px; background: linear-gradient(to top, color-mix(in srgb, var(--c) 40%, transparent), var(--c)); opacity: .7; transform-origin: bottom; animation: grow 700ms var(--ease-glide) both; transition: opacity var(--dur) var(--ease-out); }
  .col.top .bar { opacity: 1; box-shadow: 0 0 16px color-mix(in srgb, var(--c) 45%, transparent); }
  .col:hover .bar { opacity: 1; }
  @keyframes grow { from { transform: scaleY(0); } }
  .lbl { position: absolute; bottom: -20px; font-size: 10px; color: var(--text-3); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .tip { position: absolute; bottom: calc(100% + 4px); z-index: 2; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; background: var(--text); color: var(--bg); white-space: nowrap; pointer-events: none; }

  .soon { margin-top: var(--space-7); }
  .soon h2 { font-size: var(--text-lg); margin-bottom: var(--space-3); }
  .soon ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: var(--space-3); }
  .soon li { display: grid; gap: 6px; padding: var(--space-4); border-radius: var(--radius-lg); border: 1px dashed var(--border-strong); }
  .ar { font-size: var(--text-xs); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--c); }
  .need { font-size: var(--text-sm); color: var(--text-2); }
  .meter { height: 5px; border-radius: 99px; background: var(--ring-track); overflow: hidden; margin-top: 4px; }
  .meter i { display: block; height: 100%; border-radius: inherit; background: var(--c); transition: width var(--dur-xslow) var(--ease-glide); }
</style>
