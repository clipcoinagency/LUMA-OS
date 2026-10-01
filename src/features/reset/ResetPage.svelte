<script lang="ts">
  // Reflect → Weekly Reset: where you start the guided reset, see whether this week's is done, and look
  // back at every reset you've completed.
  import { RefreshCcw, ArrowRight, Check, Timer, Sparkles } from '../../lib/navicons';
  import Button from '../../lib/ui/Button.svelte';
  import { reset } from '../../lib/reset.svelte';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { getAll } from '../../lib/db/idb';
  import { weekToReview, resetNudge } from '../../lib/domain/review';
  import { addDays, formatDateKey, type DateKey } from '../../lib/util/dates';
  import { formatMinutes } from '../../lib/domain/focus';
  import type { WeeklyReview } from '../../lib/db/schema';

  let reviews = $state<WeeklyReview[] | null>(null);
  $effect(() => {
    void changes.version;
    void getAll('reviews').then((r) => { reviews = r.sort((a, b) => b.date.localeCompare(a.date)); });
  });

  const ws = $derived(app.settings?.weekStartsOn ?? 1);
  const pair = $derived(weekToReview(clock.today, ws));
  const done = $derived(reviews?.find((r) => r.date === pair.reviewWeek) ?? null);
  const nudge = $derived(resetNudge(clock.today, ws, new Set((reviews ?? []).map((r) => r.date))));
  const wk = (d: DateKey) => formatDateKey(d, { day: 'numeric', month: 'short' });
  const range = (r: WeeklyReview) => `${wk(r.date)} – ${wk(addDays(r.date, 6))}`;

  const STEPS = [
    ['Look back', 'The real numbers from last week'],
    ['Celebrate', 'Pick the wins worth keeping'],
    ['Clear loose ends', 'Carry, move or drop what slipped'],
    ['Check goals & habits', 'Update progress, pause what is not working'],
    ['Choose priorities', 'Up to three things for next week'],
    ['Plan the week', 'See it laid out, then lock it in'],
  ];
  let open = $state<string | null>(null);
</script>

<header class="ph">
  <span class="ico" aria-hidden="true"><RefreshCcw size={24} /></span>
  <div class="t"><h1>Weekly Reset</h1><p class="muted">Look back, clear the decks, and plan the week ahead — about ten minutes.</p></div>
</header>

<section class="hero glass-strong" aria-label="This week's reset">
  <div class="copy">
    {#if done}
      <span class="chip ok"><Check size={14} aria-hidden="true" />Reset done for {range(done)}</span>
      <h2>Your week is planned.</h2>
      <p class="muted">Next up: <strong>{wk(done.planWeek)} – {wk(addDays(done.planWeek, 6))}</strong>{done.priorities.length ? `, with ${done.priorities.length} priorit${done.priorities.length === 1 ? 'y' : 'ies'}` : ''}.</p>
      {#if done.reflection}<blockquote>“{done.reflection}”</blockquote>{/if}
      <div class="cta"><Button onclick={() => reset.begin({ startOver: true })}>Redo this reset</Button></div>
    {:else}
      <span class="chip" class:soon={!!nudge}>{nudge === 'ready' ? 'Your week is wrapping up' : nudge === 'catch-up' ? 'Last week was not reset yet' : 'Best at the end of the week — start any time'}</span>
      <h2>{nudge ? 'Ready to reset?' : 'A fresh start, whenever you want it.'}</h2>
      <p class="muted">Reviewing <strong>{wk(pair.reviewWeek)} – {wk(addDays(pair.reviewWeek, 6))}</strong> and planning <strong>{wk(pair.planWeek)} – {wk(addDays(pair.planWeek, 6))}</strong>. Nothing changes until the very last step.</p>
      <div class="cta"><Button variant="primary" size="lg" onclick={() => reset.begin()}>{reset.started ? 'Resume your reset' : 'Start Weekly Reset'}{#snippet icon()}<ArrowRight />{/snippet}</Button><span class="time"><Timer size={15} aria-hidden="true" />~10 min</span></div>
    {/if}
  </div>
  <ol class="steps" aria-label="What the reset covers">
    {#each STEPS as [a, b], i (a)}<li style="--i:{i}"><span class="n">{i + 1}</span><span><strong>{a}</strong><small>{b}</small></span></li>{/each}
  </ol>
</section>

<section class="hist" aria-labelledby="hh">
  <h2 id="hh">Past resets</h2>
  {#if reviews === null}
    <p class="muted">Loading…</p>
  {:else if reviews.length === 0}
    <div class="empty"><Sparkles size={22} aria-hidden="true" /><p>Your completed resets will collect here — a running record of your weeks.</p></div>
  {:else}
    <ul>
      {#each reviews as r (r.id)}
        <li>
          <button type="button" class="row" aria-expanded={open === r.id} onclick={() => (open = open === r.id ? null : r.id)}>
            <span class="w"><strong>{range(r)}</strong><small>{r.snapshot.tasksDone} tasks · {formatMinutes(r.snapshot.focusMin)} focus{r.snapshot.habitRate !== null ? ` · ${Math.round(r.snapshot.habitRate * 100)}% habits` : ''}</small></span>
            <span class="pc">{r.priorities.length} priorit{r.priorities.length === 1 ? 'y' : 'ies'}</span>
          </button>
          {#if open === r.id}
            <div class="det">
              {#if r.wins.length}<h3>Wins</h3><ul class="plain">{#each r.wins as w (w)}<li>{w}</li>{/each}</ul>{/if}
              {#if r.priorities.length}<h3>Priorities</h3><ul class="plain">{#each r.priorities as p (p.title)}<li>{p.title}{#if p.day} <em>· {formatDateKey(p.day, { weekday: 'short' })}</em>{/if}</li>{/each}</ul>{/if}
              {#if r.reflection}<blockquote>“{r.reflection}”</blockquote>{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .ph { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
  .ico { width: 52px; height: 52px; border-radius: var(--radius-lg); display: grid; place-items: center; color: var(--mod-reset); background: color-mix(in srgb, var(--mod-reset) 14%, transparent); box-shadow: var(--glow); flex: none; }
  .t { flex: 1; min-width: 200px; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: var(--space-6); align-items: center; padding: var(--space-7); border-radius: var(--radius-2xl); overflow: hidden; position: relative; }
  .hero::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(135deg, color-mix(in srgb, var(--mod-reset) 9%, transparent), transparent 55%); }
  .copy, .steps { position: relative; z-index: 1; }
  .copy { display: grid; gap: var(--space-3); justify-items: start; }
  h2 { font-size: var(--text-2xl); }
  .chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 var(--space-3); border-radius: 999px; font-size: var(--text-xs); font-weight: 700; letter-spacing: .04em; color: var(--text-2); background: color-mix(in srgb, var(--text) 6%, transparent); border: 1px solid var(--glass-edge); }
  .chip.soon { color: var(--warning); border-color: color-mix(in srgb, var(--warning) 40%, transparent); background: color-mix(in srgb, var(--warning) 10%, transparent); }
  .chip.ok { color: var(--success); border-color: color-mix(in srgb, var(--success) 40%, transparent); background: color-mix(in srgb, var(--success) 10%, transparent); }
  .cta { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; margin-top: var(--space-2); }
  .time { display: inline-flex; align-items: center; gap: 6px; color: var(--text-3); font-size: var(--text-sm); font-weight: 600; }
  blockquote { margin: 0; font-style: italic; color: var(--text-2); }
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .steps li { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: color-mix(in srgb, var(--text) 4%, transparent); animation: rise var(--dur-slow) var(--ease-glide) both; animation-delay: calc(var(--i) * 60ms + 150ms); }
  @keyframes rise { from { opacity: 0; transform: translateX(10px); } }
  .n { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; flex: none; font-size: var(--text-sm); font-weight: 800; color: var(--mod-reset); background: color-mix(in srgb, var(--mod-reset) 16%, transparent); }
  .steps strong { display: block; font-size: var(--text-sm); } .steps small { color: var(--text-3); font-size: var(--text-xs); }
  @media (max-width: 880px) { .hero { grid-template-columns: 1fr; padding: var(--space-5); } }

  .hist { margin-top: var(--space-7); }
  .hist h2 { font-size: var(--text-lg); margin-bottom: var(--space-3); }
  .hist > ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .hist > ul > li { border-radius: var(--radius-lg); background: var(--surface); border: var(--card-border); box-shadow: var(--solid-highlight), var(--shadow-1); overflow: hidden; }
  .row { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 60px; padding: var(--space-3) var(--space-4); background: none; border: 0; cursor: pointer; color: var(--text); text-align: left; }
  .w { display: grid; gap: 2px; } .w small { color: var(--text-3); } .pc { color: var(--text-2); font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }
  .det { padding: 0 var(--space-4) var(--space-4); display: grid; gap: var(--space-2); animation: fade var(--dur) var(--ease-out); }
  @keyframes fade { from { opacity: 0; } }
  .det h3 { font-family: var(--font-body); font-size: var(--text-xs); letter-spacing: .1em; text-transform: uppercase; color: var(--text-3); }
  .plain { list-style: disc; margin: 0; padding-left: 1.1rem; display: grid; gap: 2px; } .plain em { font-style: normal; color: var(--text-3); }
  .empty { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-5); border-radius: var(--radius-lg); border: 1px dashed var(--border-strong); color: var(--text-2); }
</style>
