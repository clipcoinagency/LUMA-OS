<script lang="ts">
  // Home's hero: who you are today, what the day looks like, and what deserves your attention —
  // all computed from your own data (domain/home.ts). A frosted glass panel with a soft specular
  // highlight that follows the pointer; the Orbit ring on the right shows each area's progress.
  import type { Component } from 'svelte';
  import { AlertTriangle, Clock, Flame, Focus, Target, Wallet, Droplet, RefreshCcw, CheckCircle2, Sparkles, CalendarClock, BookOpen, ChevronRight, Sunrise, Sun, Sunset, Moon } from '@lucide/svelte';
  import DayRing, { type RingSegment } from '../../lib/ui/DayRing.svelte';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { router } from '../../lib/router.svelte';
  import { focus } from '../../lib/focus.svelte';
  import { formatDateKey } from '../../lib/util/dates';
  import { formatMinutes } from '../../lib/domain/focus';
  import { buildBriefing, buildHeadline, greetingFor, loadHomeSnapshot, type BriefIcon, type BriefLine, type HomeSnapshot } from '../../lib/domain/home';
  import { reducedMotion } from '../../lib/motion';

  let snap = $state.raw<HomeSnapshot | null>(null);
  let hl = $state<string | null>(null);

  // re-read on every write, at midnight, and once a minute (next event, time-of-day dot)
  let minuteTick = $state(0);
  $effect(() => { const id = setInterval(() => { minuteTick += 1; }, 60_000); return () => clearInterval(id); });
  $effect(() => {
    const v = changes.version;
    void clock.today; void minuteTick;
    const ws = app.workspace, st = app.settings;
    if (!ws || !st) return;
    void loadHomeSnapshot({ enabled: ws.enabledModules, name: st.displayName, currency: st.currency, weekStartsOn: st.weekStartsOn, focusTargetMin: st.focusTargetMin }).then((s) => {
      if (v === changes.version) snap = s; // a newer write superseded this read — let the newer one land
    });
  });

  const ICONS: Record<BriefIcon, Component> = { alert: AlertTriangle, clock: Clock, flame: Flame, focus: Focus, target: Target, wallet: Wallet, droplet: Droplet, refresh: RefreshCcw, check: CheckCircle2, sparkles: Sparkles, calendar: CalendarClock, book: BookOpen };
  const GreetIcon = $derived(clock.hour < 5 ? Moon : clock.hour < 8 ? Sunrise : clock.hour < 17 ? Sun : clock.hour < 20 ? Sunset : Moon);

  const brief = $derived(snap ? buildBriefing(snap, 3) : []);
  const headline = $derived(snap ? buildHeadline(snap) : '');
  const name = $derived(app.settings?.displayName ?? '');
  const part = $derived(clock.hour < 12 ? 'Morning' : clock.hour < 17 ? 'Afternoon' : clock.hour < 21 ? 'Evening' : 'Night');

  const segments = $derived.by((): (RingSegment & { go: () => void })[] => {
    const s = snap;
    if (!s) return [];
    const out: (RingSegment & { go: () => void })[] = [];
    const on = (m: string) => s.enabled.includes(m as never);
    if (on('tasks')) {
      const total = s.tasks.doneToday + s.tasks.today.length + s.tasks.overdue.length;
      out.push({ id: 'tasks', label: 'Tasks', color: 'var(--mod-tasks)', fraction: total ? s.tasks.doneToday / total : null, value: total ? `${s.tasks.doneToday}/${total}` : '—', sub: total ? 'done today' : 'none planned', go: () => router.go({ name: 'module', module: 'tasks' }) });
    }
    if (on('habits')) {
      const due = s.habits.filter((h) => h.dueToday);
      const done = due.filter((h) => h.doneToday).length;
      out.push({ id: 'habits', label: 'Habits', color: 'var(--mod-habits)', fraction: due.length ? done / due.length : null, value: due.length ? `${done}/${due.length}` : '—', sub: due.length ? 'checked in' : 'none due', go: () => router.go({ name: 'module', module: 'habits' }) });
    }
    out.push({ id: 'focus', label: 'Focus', color: 'var(--mod-focus)', fraction: Math.min(1, s.focus.minutes / s.focus.target), value: formatMinutes(s.focus.minutes), sub: `of ${formatMinutes(s.focus.target)}`, go: () => focus.openFor() });
    if (on('wellness') && s.wellness) {
      out.push({ id: 'wellness', label: 'Wellness', color: 'var(--mod-wellness)', fraction: s.wellness.logged / s.wellness.total, value: `${s.wellness.logged}/${s.wellness.total}`, sub: 'logged today', go: () => router.go({ name: 'module', module: 'wellness' }) });
    }
    return out;
  });

  function run(l: BriefLine) {
    const a = l.action;
    if (!a) return;
    if ('focus' in a) focus.openFor(); else router.go(a.route);
  }

  // pointer-following specular highlight
  let panel: HTMLElement | undefined = $state();
  function move(e: PointerEvent) {
    if (!panel || reducedMotion() || e.pointerType === 'touch') return;
    const r = panel.getBoundingClientRect();
    panel.style.setProperty('--mx', `${e.clientX - r.left}px`);
    panel.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
  const dayFraction = $derived((snap?.minutes ?? new Date().getHours() * 60) / 1440);
</script>

<section class="hero glass-strong" bind:this={panel} onpointermove={move} aria-label="Today">
  <div class="copy">
    <p class="date">{formatDateKey(clock.today)}</p>
    <h1 class="greet">
      <span class="gi" aria-hidden="true"><GreetIcon size={26} /></span>
      <span>{greetingFor(clock.hour)}{name ? `, ${name}` : ''}</span>
    </h1>

    {#if snap}
      <p class="headline">{headline}</p>
      {#if brief.length}
        <ul class="brief" aria-label="What needs your attention">
          {#each brief as l, i (l.id)}
            {@const Ico = ICONS[l.icon]}
            <li class="b {l.tone}" style="--i:{i}">
              <span class="bi" aria-hidden="true"><Ico size={16} /></span>
              <span class="bt">{l.text}</span>
              {#if l.action}
                <button type="button" class="ba" onclick={() => run(l)}>{l.action.label}<ChevronRight size={14} aria-hidden="true" /></button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <div class="skel" aria-busy="true"><span></span><span></span><span></span></div>
    {/if}
  </div>

  <div class="orbit">
    <DayRing {segments} {dayFraction} bind:active={hl} size={300} label="Your day: progress by area" top={formatDateKey(clock.today, { weekday: 'short' })}
      main={formatDateKey(clock.today, { day: 'numeric', month: 'short' })} sub={part} />
    <ul class="legend" aria-label="Today by area">
      {#each segments as s (s.id)}
        <li style="--c:{s.color}">
          <button type="button" onclick={s.go} onpointerenter={() => (hl = s.id)} onpointerleave={() => (hl = null)} onfocus={() => (hl = s.id)} onblur={() => (hl = null)}>
            <span class="sw" aria-hidden="true"></span>
            <span class="lbl">{s.label}</span>
            <span class="val num">{s.value}</span>
            <span class="sub">{s.sub}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .hero {
    --mx: 30%; --my: 0%;
    position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: var(--space-6); align-items: center;
    padding: var(--space-7); border-radius: var(--radius-2xl);
  }
  .hero::before {
    content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .9;
    background: radial-gradient(420px circle at var(--mx) var(--my), color-mix(in srgb, var(--text) 9%, transparent), transparent 62%);
  }
  .hero::after {
    content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 7%, transparent), transparent 40%, color-mix(in srgb, var(--accent-2) 7%, transparent));
  }
  .copy, .orbit { position: relative; z-index: 1; min-width: 0; }
  .date { color: var(--text-2); font-weight: 600; font-size: var(--text-sm); letter-spacing: .02em; }
  .greet { display: flex; align-items: center; gap: var(--space-3); font-size: clamp(var(--text-2xl), 4.2vw, var(--text-4xl)); margin-top: var(--space-2); line-height: 1.04; }
  .gi { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--on-accent); background: var(--accent-grad); box-shadow: var(--glow); animation: bob 6s var(--ease-in-out) infinite; }
  :global(:is([data-theme='soft'], [data-theme='light'])) .gi { color: #fff; }
  @keyframes bob { 50% { transform: translateY(-3px) rotate(6deg); } }
  .headline { margin-top: var(--space-4); font-size: var(--text-lg); line-height: 1.35; color: var(--text); font-weight: 520; max-width: 34ch; text-wrap: balance; }

  .brief { list-style: none; margin: var(--space-5) 0 0; padding: 0; display: grid; gap: var(--space-2); }
  .b {
    --t: var(--accent);
    display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3); border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--t) 8%, transparent); border: 1px solid color-mix(in srgb, var(--t) 18%, transparent);
    animation: rise var(--dur-slow) var(--ease-glide) both; animation-delay: calc(var(--i) * 70ms + 120ms);
  }
  .b.warn { --t: var(--warning); } .b.nudge { --t: var(--accent-2); } .b.good { --t: var(--success); } .b.info { --t: var(--accent); }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
  .bi { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; flex: none; color: var(--t); background: color-mix(in srgb, var(--t) 16%, transparent); }
  .bt { flex: 1; min-width: 0; font-size: var(--text-sm); line-height: 1.4; color: var(--text); }
  .ba { display: inline-flex; align-items: center; gap: 2px; flex: none; height: 32px; padding: 0 var(--space-2) 0 var(--space-3); border-radius: 999px; cursor: pointer; font-weight: 700; font-size: var(--text-xs);
    color: var(--t); background: color-mix(in srgb, var(--t) 12%, transparent); border: 0; transition: background-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  .ba:hover { background: color-mix(in srgb, var(--t) 22%, transparent); }
  .ba:active { transform: scale(.95); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .b.warn { --t: #a8700f; } :global(:is([data-theme='soft'], [data-theme='light'])) .b.info { --t: var(--accent-ink); }

  .skel { display: grid; gap: var(--space-3); margin-top: var(--space-5); }
  .skel span { height: 18px; border-radius: 9px; background: color-mix(in srgb, var(--text) 8%, transparent); animation: shimmer 1.4s var(--ease-in-out) infinite alternate; }
  .skel span:nth-child(1) { width: 70%; } .skel span:nth-child(2) { width: 90%; height: 44px; } .skel span:nth-child(3) { width: 60%; }
  @keyframes shimmer { to { opacity: .45; } }

  .orbit { display: grid; justify-items: center; gap: var(--space-5); }
  .legend { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2) var(--space-4); width: 100%; max-width: 360px; }
  .legend button { width: 100%; display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: 'sw lbl val' 'sw sub sub'; align-items: baseline; column-gap: var(--space-2); text-align: left;
    padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); border: 1px solid transparent; background: none; cursor: pointer; color: var(--text);
    transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out); }
  .legend button:hover, .legend button:focus-visible { background: color-mix(in srgb, var(--c) 10%, transparent); border-color: color-mix(in srgb, var(--c) 30%, transparent); }
  .sw { grid-area: sw; width: 10px; height: 10px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px color-mix(in srgb, var(--c) 70%, transparent); align-self: center; }
  .lbl { grid-area: lbl; font-size: var(--text-sm); font-weight: 650; color: var(--text-2); }
  .val { grid-area: val; font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-lg); }
  .sub { grid-area: sub; font-size: var(--text-xs); color: var(--text-3); }

  @media (max-width: 880px) {
    .hero { grid-template-columns: 1fr; padding: var(--space-5); gap: var(--space-5); }
    .headline { max-width: none; }
  }
</style>
