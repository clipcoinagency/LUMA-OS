<script lang="ts">
  // Daily log for any day (history stays per-day), workouts, and 30-day trends. Lifestyle tracking only.
  import { Plus, ChevronLeft, ChevronRight, Droplet, Moon, Footprints, Scale, Dumbbell, Minus } from '@lucide/svelte';
  import { MOODS } from '../../../lib/moods';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Sparkline from '../../../lib/ui/Sparkline.svelte';
  import BarChart from '../../../lib/ui/BarChart.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import WorkoutForm from '../../quick/WorkoutForm.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { getWellness, updateWellness, wellnessRange, workoutsRange } from '../../../lib/domain/daily';
  import { addDays, eachDay, formatDateKey, startOfMonth, type DateKey } from '../../../lib/util/dates';
  import type { WellnessDay, Workout } from '../../../lib/db/schema';

  let day = $state<DateKey>(clock.today);
  let entry = $state.raw<WellnessDay | null>(null);
  let range = $state.raw<WellnessDay[]>([]);
  let workouts = $state.raw<Workout[]>([]);
  let formOpen = $state(false);
  let editing = $state.raw<Workout | null>(null);

  $effect(() => { void changes.version; const d = day; void getWellness(d).then((w) => { entry = w; }); });
  $effect(() => {
    void changes.version;
    const end = clock.today;
    void wellnessRange(addDays(end, -29), end).then((r) => { range = r; });
    void workoutsRange(addDays(end, -59), end).then((w) => { workouts = w.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)); });
  });

  const units = $derived(app.settings?.units ?? { weight: 'kg', water: 'glasses' });
  const step = $derived(units.water === 'ml' ? 250 : units.water === 'oz' ? 8 : 1);

  const days30 = $derived(eachDay(addDays(clock.today, -29), clock.today));
  const by = $derived(new Map(range.map((r) => [r.date, r])));
  const series = (f: (w: WellnessDay) => number | null) => days30.map((d) => { const w = by.get(d); return w ? f(w) : null; });
  const avg = (vals: (number | null)[]) => { const n = vals.filter((v): v is number => v !== null); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null; };
  const sleep = $derived(series((w) => w.sleepHours));
  const weight = $derived(series((w) => w.weight));
  const water = $derived(series((w) => w.water));
  const mood = $derived(series((w) => w.mood));
  const steps14 = $derived(days30.slice(-14).map((d) => ({ label: formatDateKey(d, { day: 'numeric' }), value: by.get(d)?.steps ?? 0 })));
  const latestWeight = $derived([...weight].reverse().find((v) => v !== null) ?? null);
  const monthWorkouts = $derived(workouts.filter((w) => w.date >= startOfMonth(clock.today)));
  const monthMinutes = $derived(monthWorkouts.reduce((a, w) => a + w.durationMin, 0));
  const f1 = (n: number | null, d = 1) => (n === null ? '—' : n.toFixed(d).replace(/\.0$/, ''));

  function num(v: string, max: number): number | null {
    const n = Number(v.replace(',', '.'));
    return v.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.min(n, max);
  }
  const set = (patch: Partial<WellnessDay>) => updateWellness(day, patch);
  const dayLabel = $derived(day === clock.today ? 'Today' : day === addDays(clock.today, -1) ? 'Yesterday' : formatDateKey(day, { weekday: 'long', day: 'numeric', month: 'short' }));
</script>

<PageHeader module="wellness" subtitle="Personal lifestyle tracking — not medical advice.">
  {#snippet actions()}<Button variant="primary" onclick={() => { editing = null; formOpen = true; }}>{#snippet icon()}<Plus />{/snippet}Log workout</Button>{/snippet}
</PageHeader>

<div class="grid">
  <section class="card log" aria-labelledby="log-h">
    <header class="lh">
      <button type="button" class="nav" aria-label="Previous day" onclick={() => (day = addDays(day, -1))}><ChevronLeft size={18} /></button>
      <h2 id="log-h">{dayLabel}</h2>
      <button type="button" class="nav" aria-label="Next day" disabled={day >= clock.today} onclick={() => (day = addDays(day, 1))}><ChevronRight size={18} /></button>
    </header>
    {#if entry}
      <div class="fields">
        <div class="f"><span class="fl"><Droplet size={16} aria-hidden="true" />Water ({units.water})</span>
          <div class="stepper">
            <button type="button" aria-label="Less water" disabled={!entry.water} onclick={() => set({ water: Math.max(0, (entry?.water ?? 0) - step) || null })}><Minus size={16} /></button>
            <span class="big num" aria-live="polite">{entry.water ?? 0}</span>
            <button type="button" aria-label="More water" onclick={() => set({ water: (entry?.water ?? 0) + step })}><Plus size={16} /></button>
          </div>
        </div>
        <label class="f"><span class="fl"><Moon size={16} aria-hidden="true" />Sleep (hours)</span><input class="in num" inputmode="decimal" value={entry.sleepHours ?? ''} placeholder="—" onchange={(e) => set({ sleepHours: num(e.currentTarget.value, 24) })} /></label>
        <label class="f"><span class="fl"><Footprints size={16} aria-hidden="true" />Steps</span><input class="in num" inputmode="numeric" value={entry.steps ?? ''} placeholder="—" onchange={(e) => { const n = num(e.currentTarget.value, 200000); set({ steps: n === null ? null : Math.round(n) }); }} /></label>
        <label class="f"><span class="fl"><Scale size={16} aria-hidden="true" />Weight ({units.weight})</span><input class="in num" inputmode="decimal" value={entry.weight ?? ''} placeholder="—" onchange={(e) => set({ weight: num(e.currentTarget.value, 700) })} /></label>
      </div>
      <div class="mood" role="radiogroup" aria-label="Mood">
        {#each MOODS as m (m.value)}
          <button type="button" role="radio" aria-checked={entry.mood === m.value} aria-label={m.label} class:on={entry.mood === m.value} style="--m:{m.color}" onclick={() => set({ mood: entry?.mood === m.value ? null : m.value })}><m.icon size={22} aria-hidden="true" /><span>{m.label}</span></button>
        {/each}
      </div>
      <label class="note"><span class="fl">Note</span><textarea rows="2" value={entry.note} placeholder="How did the day feel?" onchange={(e) => set({ note: e.currentTarget.value.slice(0, 500) })}></textarea></label>
    {/if}
  </section>

  <section class="card" aria-labelledby="wo-h">
    <header class="sh"><h2 id="wo-h">Workouts</h2><span class="meta">{monthWorkouts.length} this month · {monthMinutes} min</span></header>
    {#if workouts.length === 0}
      <EmptyState compact title="No workouts yet" body="Walks count too. Log anything that got you moving.">{#snippet icon()}<Dumbbell />{/snippet}</EmptyState>
    {:else}
      <ul class="wos">
        {#each workouts.slice(0, 8) as w (w.id)}
          <li><button type="button" onclick={() => { editing = $state.snapshot(w) as Workout; formOpen = true; }}>
            <span class="wt">{w.type}</span><span class="meta">{w.durationMin} min{w.intensity ? ` · ${w.intensity}` : ''}</span>
            <span class="wd meta">{w.date === clock.today ? 'Today' : formatDateKey(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </button></li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card trends" aria-labelledby="tr-h">
    <header class="sh"><h2 id="tr-h">Last 30 days</h2></header>
    <div class="tgrid">
      <div class="t"><span class="tl">Average sleep</span><span class="tv num">{f1(avg(sleep))} h</span><Sparkline values={sleep} label="Sleep, last 30 days" color="var(--mod-wellness)" height={40} /></div>
      <div class="t"><span class="tl">Weight</span><span class="tv num">{f1(latestWeight)} {units.weight}</span><Sparkline values={weight} label="Weight, last 30 days" color="var(--accent-2)" height={40} /></div>
      <div class="t"><span class="tl">Average water</span><span class="tv num">{f1(avg(water))} {units.water}</span><Sparkline values={water} label="Water, last 30 days" color="var(--info)" height={40} /></div>
      <div class="t"><span class="tl">Average mood</span><span class="tv num">{avg(mood) === null ? '—' : MOODS[Math.round(avg(mood)!) - 1]?.label}</span><Sparkline values={mood} label="Mood, last 30 days" color="var(--success)" height={40} /></div>
    </div>
    <h3 class="sub">Steps, last 14 days</h3>
    <BarChart data={steps14} label="Steps per day, last 14 days" height={120} format={(v) => `${v.toLocaleString()} steps`} highlight={13} />
  </section>
</div>

<WorkoutForm bind:open={formOpen} workout={editing} date={day} />

<style>
  .grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); align-items: start; }
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4) var(--space-5) var(--space-5); }
  .trends { grid-column: 1 / -1; }
  .lh { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-4); }
  .lh h2 { font-size: var(--text-lg); text-align: center; flex: 1; }
  .nav { width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; }
  .nav:disabled { opacity: .3; cursor: default; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .f { display: grid; gap: 6px; padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); }
  .fl { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 650; color: var(--text-2); }
  .fl :global(svg) { color: var(--mod-wellness); }
  .in { border: 0; background: none; font-size: var(--text-lg); font-weight: 700; color: var(--text); min-height: 36px; width: 100%; padding: 0; }
  .in:focus-visible { box-shadow: var(--focus); }
  .stepper { display: flex; align-items: center; justify-content: space-between; }
  .stepper button { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--border-strong); background: var(--surface); display: grid; place-items: center; color: var(--text-2); cursor: pointer; }
  .stepper button:disabled { opacity: .35; }
  .big { font-size: var(--text-lg); font-weight: 700; }
  .mood { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: var(--space-4); }
  .mood button { display: grid; justify-items: center; gap: 2px; min-height: 60px; padding: 6px 2px; border-radius: var(--radius-sm); border: 1px solid transparent; background: var(--surface-2); color: var(--text-3); cursor: pointer; font-size: var(--text-xs); font-weight: 600; transition: all var(--dur) var(--ease-out); }
  .mood button:hover { color: var(--m); }
  .mood button.on { color: var(--m); border-color: var(--m); background: color-mix(in srgb, var(--m) 14%, var(--surface)); }
  .note { display: grid; gap: 6px; margin-top: var(--space-4); }
  .note textarea { border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); padding: 10px 12px; resize: vertical; }
  .sh { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); margin-bottom: var(--space-3); flex-wrap: wrap; }
  .sh h2 { font-size: var(--text-md); }
  .wos { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .wos button { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px var(--space-3); text-align: left; padding: var(--space-3); border-radius: var(--radius-md); border: 0; border-left: 3px solid var(--mod-wellness); background: var(--surface-2); color: var(--text); cursor: pointer; }
  .wos button:hover { background: var(--surface-3); }
  .wt { font-weight: 650; }
  .wd { grid-row: 1 / 3; grid-column: 2; align-self: center; }
  .tgrid { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: var(--space-5); }
  .t { display: grid; gap: 4px; padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); }
  .tl { font-size: var(--text-xs); font-weight: 650; color: var(--text-2); }
  .tv { font-size: var(--text-lg); font-weight: 700; }
  .sub { font-family: var(--font-body); font-size: var(--text-sm); font-weight: 700; color: var(--text-2); letter-spacing: 0; margin-bottom: var(--space-3); }
  @media (max-width: 420px) { .mood span { display: none; } .mood button { min-height: 48px; } }
</style>
