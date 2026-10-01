<script lang="ts">
  // Home's graph tiles: Focus (ring + week), Wellbeing (mood curve), Progress (week bars).
  // Real data only — a tile with too little history says so and shows a labelled placeholder.
  import { Focus, HeartPulse, TrendingUp, Play, ArrowUpRight, ArrowDownRight, Minus } from '@lucide/svelte';
  import SmoothLine from '../../lib/ui/SmoothLine.svelte';
  import CountUp from '../../lib/ui/CountUp.svelte';
  import { spotlight } from '../../lib/ui/spotlight';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { router } from '../../lib/router.svelte';
  import { focus } from '../../lib/focus.svelte';
  import { MOODS } from '../../lib/moods';
  import { DEFAULT_FOCUS_TARGET_MIN } from '../../lib/domain/home';
  import { formatMinutes } from '../../lib/domain/focus';
  import { loadPulse, MIN_MOOD_POINTS, type Pulse } from '../../lib/domain/pulse';
  import { formatDateKey } from '../../lib/util/dates';

  let pulse = $state.raw<Pulse | null>(null);
  $effect(() => {
    const v = changes.version;
    const today = clock.today;
    const ws = app.workspace, st = app.settings;
    if (!ws || !st) return;
    void loadPulse({ enabled: ws.enabledModules, today, focusTargetMin: st.focusTargetMin ?? DEFAULT_FOCUS_TARGET_MIN }).then((p) => {
      if (v === changes.version) pulse = p;
    });
  });

  // focus ring
  const R = 44, CIRC = 2 * Math.PI * R;
  let shown = $state(false); // lets the ring sweep in once on first paint
  $effect(() => { const id = requestAnimationFrame(() => { shown = true; }); return () => cancelAnimationFrame(id); });
  const ringFrac = $derived(pulse && shown ? Math.min(1, pulse.focus.today / Math.max(1, pulse.focus.target)) : 0);
  const focusMax = $derived(pulse ? Math.max(1, pulse.focus.target / 2, ...pulse.focus.week.map((d) => d.value)) : 1);

  // wellbeing
  const mood = $derived(pulse?.mood ?? null);
  const enough = $derived(!!mood && mood.logged >= MIN_MOOD_POINTS);
  const moodWord = $derived(mood?.avg7 ? (MOODS[Math.min(5, Math.max(1, Math.round(mood.avg7))) - 1]?.label ?? '') : '');

  // progress
  const prog = $derived(pulse?.progress ?? null);
  const progMax = $derived(prog ? Math.max(1, ...prog.days.map((d) => d.value)) : 1);
  const todayKey = $derived(clock.today);
  const dayLetter = (d: string) => formatDateKey(d as never, { weekday: 'narrow' });
  const dayLong = (d: string) => formatDateKey(d as never, { weekday: 'long' });
</script>

<div class="pulse" aria-label="Your pulse">
  <!-- FOCUS -->
  <section class="tile gcard lift" style="--c:var(--mod-focus);--i:0" use:spotlight aria-labelledby="pt-focus">
    <header>
      <span class="chip"><Focus size={15} aria-hidden="true" /></span><h2 id="pt-focus">Focus</h2>
      <button type="button" class="go" onclick={() => focus.openFor()}><Play size={13} aria-hidden="true" />Start</button>
    </header>
    {#if pulse}
      <div class="focusrow">
        <div class="ring" role="img" aria-label="{formatMinutes(pulse.focus.today)} of {formatMinutes(pulse.focus.target)} focus today">
          <svg viewBox="0 0 112 112" width="112" height="112">
            <defs><linearGradient id="pf-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent-2)" /><stop offset="1" style="stop-color:var(--mod-focus)" /></linearGradient>
              <filter id="pf-b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" /></filter></defs>
            <circle cx="56" cy="56" r={R} class="track" />
            <circle cx="56" cy="56" r={R} class="arc glow" stroke="url(#pf-g)" filter="url(#pf-b)" stroke-dasharray={CIRC} stroke-dashoffset={CIRC * (1 - ringFrac)} />
            <circle cx="56" cy="56" r={R} class="arc" stroke="url(#pf-g)" stroke-dasharray={CIRC} stroke-dashoffset={CIRC * (1 - ringFrac)} />
          </svg>
          <div class="mid"><strong class="num">{formatMinutes(pulse.focus.today)}</strong><span>of {formatMinutes(pulse.focus.target)}</span></div>
        </div>
        <ul class="facts">
          <li><strong class="num"><CountUp value={pulse.focus.sessionsToday} /></strong><span>session{pulse.focus.sessionsToday === 1 ? '' : 's'} today</span></li>
          <li><strong class="num">{formatMinutes(pulse.focus.weekTotal)}</strong><span>this week</span></li>
        </ul>
      </div>
      <div class="mini" role="img" aria-label="Focus minutes per day, last 7 days">
        {#each pulse.focus.week as d, i (d.date)}
          <span class="mb" class:now={d.date === todayKey} title="{dayLong(d.date)}: {formatMinutes(d.value)}"><i style="height:{Math.max(6, (d.value / focusMax) * 100)}%;animation-delay:{i * 45 + 200}ms" class:zero={d.value === 0}></i></span>
        {/each}
      </div>
    {:else}<div class="sk" aria-busy="true"></div>{/if}
  </section>

  <!-- WELLBEING -->
  {#if mood}
    <section class="tile gcard lift" style="--c:var(--mod-wellness);--i:1" use:spotlight aria-labelledby="pt-well">
      <header>
        <span class="chip"><HeartPulse size={15} aria-hidden="true" /></span><h2 id="pt-well">Wellbeing</h2>
        <button type="button" class="go" onclick={() => router.go({ name: 'module', module: 'wellness' })}>Log<ArrowUpRight size={13} aria-hidden="true" /></button>
      </header>
      {#if enough}
        <p class="big"><strong class="num"><CountUp value={mood.avg7 ?? 0} decimals={1} /></strong><span class="of">/ 5</span><span class="word">{moodWord}</span></p>
        <p class="cap">average mood · last 7 days</p>
        <div class="curve"><SmoothLine values={mood.points.map((p) => p.value)} min={1} max={5} color="var(--mod-wellness)" label="Mood over the last 14 days: {mood.logged} days logged, average {mood.avg7} out of 5" /></div>
      {:else}
        <p class="big soft"><strong>Not enough data yet</strong></p>
        <p class="cap">{mood.logged === 0 ? 'Log your mood for a few days' : `${MIN_MOOD_POINTS - mood.logged} more day${MIN_MOOD_POINTS - mood.logged === 1 ? '' : 's'} of mood to draw your curve`} — it appears here (example shape, not your data).</p>
        <div class="curve"><SmoothLine values={[]} min={1} max={5} ghost color="var(--mod-wellness)" label="Placeholder: your mood curve appears after a few logged days" /></div>
      {/if}
    </section>
  {/if}

  <!-- PROGRESS -->
  {#if prog}
    <section class="tile gcard lift" style="--c:var(--accent);--i:2" use:spotlight aria-labelledby="pt-prog">
      <header>
        <span class="chip"><TrendingUp size={15} aria-hidden="true" /></span><h2 id="pt-prog">Progress</h2>
        <button type="button" class="go" onclick={() => router.go({ name: 'insights' })}>Insights<ArrowUpRight size={13} aria-hidden="true" /></button>
      </header>
      <p class="big"><strong class="num"><CountUp value={prog.thisWeek} /></strong><span class="of">done this week</span></p>
      <p class="cap">
        {#if prog.deltaPct !== null}
          <span class="delta" class:up={prog.deltaPct > 0} class:down={prog.deltaPct < 0}>
            {#if prog.deltaPct > 0}<ArrowUpRight size={13} aria-hidden="true" />{:else if prog.deltaPct < 0}<ArrowDownRight size={13} aria-hidden="true" />{:else}<Minus size={13} aria-hidden="true" />{/if}
            {prog.deltaPct > 0 ? '+' : prog.deltaPct < 0 ? '−' : ''}{Math.abs(prog.deltaPct)}%
          </span> vs last week
        {:else}{prog.thisWeek > 0 ? 'A first week to build on' : 'Nothing logged yet this week'}{/if}
      </p>
      <div class="bars" role="img" aria-label="Things done per day, last 7 days">
        {#each prog.days as d, i (d.date)}
          <span class="col" class:now={d.date === todayKey} title="{dayLong(d.date)}: {d.value} done">
            <i class="bar" class:zero={d.value === 0} style="height:{Math.max(5, (d.value / progMax) * 100)}%;animation-delay:{i * 55 + 200}ms"></i>
            <em aria-hidden="true">{dayLetter(d.date)}</em>
          </span>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .pulse { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap: var(--space-4); margin-top: var(--space-4); }
  .tile { padding: var(--space-5); display: flex; flex-direction: column; min-height: 214px; animation: rise .7s var(--ease-glide) both; animation-delay: calc(var(--i) * 90ms + 150ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(.985); } }
  header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
  h2 { font-size: var(--text-md); flex: 1; }
  .chip { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; color: var(--c);
    background: linear-gradient(145deg, color-mix(in srgb, var(--c) 30%, transparent), color-mix(in srgb, var(--c) 9%, transparent));
    box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 35%, transparent), 0 4px 14px color-mix(in srgb, var(--c) 22%, transparent); }
  .go { display: inline-flex; align-items: center; gap: 3px; height: 28px; padding: 0 var(--space-3); border-radius: 999px; border: 0; cursor: pointer; font-size: var(--text-xs); font-weight: 700;
    color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); transition: background-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .go { color: color-mix(in srgb, var(--c) 82%, #000); }
  .go:hover { background: color-mix(in srgb, var(--c) 22%, transparent); }
  .go:active { transform: scale(.94); }

  .focusrow { display: flex; align-items: center; gap: var(--space-5); }
  .ring { position: relative; width: 112px; height: 112px; flex: none; }
  .ring svg { display: block; transform: rotate(-90deg); overflow: visible; }
  .track { fill: none; stroke: var(--ring-track); stroke-width: 9; }
  .arc { fill: none; stroke-width: 9; stroke-linecap: round; transition: stroke-dashoffset 1.2s var(--ease-glide); }
  .arc.glow { opacity: .55; }
  .mid { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; line-height: 1.15; }
  .mid strong { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-xl); letter-spacing: var(--display-tracking); }
  .mid span { font-size: var(--text-xs); color: var(--text-2); }
  .facts { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .facts li { display: grid; line-height: 1.2; }
  .facts strong { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-lg); }
  .facts span { font-size: var(--text-xs); color: var(--text-2); }

  .mini { margin-top: auto; padding-top: var(--space-4); display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; height: 54px; align-items: end; }
  .mb { display: flex; align-items: flex-end; height: 100%; }
  .mb i { display: block; width: 100%; border-radius: 5px 5px 3px 3px; background: linear-gradient(180deg, var(--mod-focus), color-mix(in srgb, var(--accent-2) 70%, var(--mod-focus))); opacity: .55;
    transform-origin: bottom; animation: grow .8s var(--ease-glide) both; }
  .mb.now i { opacity: 1; box-shadow: 0 0 14px color-mix(in srgb, var(--mod-focus) 55%, transparent); }
  .mb i.zero { background: var(--ring-track); opacity: 1; box-shadow: none; }
  @keyframes grow { from { transform: scaleY(0); } }

  .big { display: flex; align-items: baseline; gap: var(--space-2); margin: var(--space-1) 0 0; flex-wrap: wrap; }
  .big strong { font-family: var(--font-display); font-weight: var(--display-weight); letter-spacing: var(--display-tracking); font-size: var(--text-3xl); line-height: 1; }
  .big.soft strong { font-size: var(--text-lg); line-height: 1.2; }
  .of { color: var(--text-2); font-size: var(--text-sm); font-weight: 600; }
  .word { margin-left: auto; font-size: var(--text-xs); font-weight: 700; padding: 3px 10px; border-radius: 999px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .word { color: color-mix(in srgb, var(--c) 80%, #000); }
  .cap { margin: var(--space-1) 0 0; font-size: var(--text-xs); color: var(--text-2); line-height: 1.4; }
  .curve { margin-top: auto; padding-top: var(--space-3); }

  .delta { display: inline-flex; align-items: center; gap: 2px; font-weight: 700; padding: 2px 8px 2px 5px; border-radius: 999px; color: var(--text-2); background: var(--surface-3); }
  .delta.up { color: var(--success); background: var(--success-soft); }
  .delta.down { color: var(--warning); background: var(--warning-soft); }
  .bars { margin-top: auto; padding-top: var(--space-4); display: grid; grid-template-columns: repeat(7, 1fr); gap: 7px; height: 92px; }
  .col { position: relative; display: flex; align-items: flex-end; justify-content: center; height: 100%; padding-bottom: 18px; }
  .bar { display: block; width: 100%; max-width: 30px; border-radius: 7px 7px 4px 4px; background: linear-gradient(180deg, var(--accent), var(--accent-2)); opacity: .5; transform-origin: bottom; animation: grow .85s var(--ease-glide) both;
    transition: opacity var(--dur) var(--ease-out), filter var(--dur) var(--ease-out); }
  .col:hover .bar { opacity: .9; }
  .col.now .bar { opacity: 1; box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 50%, transparent); }
  .bar.zero { background: var(--ring-track); opacity: 1; box-shadow: none; }
  .col em { position: absolute; bottom: 0; font-style: normal; font-size: var(--text-xs); color: var(--text-3); }
  .col.now em { color: var(--text); font-weight: 700; }
  .sk { flex: 1; border-radius: var(--radius-md); background: color-mix(in srgb, var(--text) 7%, transparent); animation: sh 1.4s var(--ease-in-out) infinite alternate; }
  @keyframes sh { to { opacity: .4; } }
</style>
