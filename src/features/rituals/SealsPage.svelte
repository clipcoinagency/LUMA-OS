<script lang="ts">
  // New looks: Seals — quiet milestones from your own records, with progress toward the next ones.
  // Nothing is ever taken away for a missed day (stats only grow).
  import type { Component } from 'svelte';
  import { Award, CheckCheck, Focus, Flame, Repeat2, RefreshCcw, MoonStar, PenLine, BookOpen, Mountain } from '@lucide/svelte';
  import PageKicker from '../modules/PageKicker.svelte';
  import ProgressBar from '../../lib/ui/ProgressBar.svelte';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { computeSeals, loadSealStats, type Seal, type SealStats } from '../../lib/domain/rituals';

  let seals = $state.raw<Seal[]>([]);
  $effect(() => {
    const v = changes.version;
    void loadSealStats(clock.today, app.settings?.weekStartsOn ?? 1).then((st) => { if (v === changes.version) seals = computeSeals(st); });
  });
  const ICON: Record<keyof SealStats, Component> = { tasksDone: CheckCheck, focusMin: Focus, bestRun: Flame, habitChecks: Repeat2, resets: RefreshCcw, closings: MoonStar, journal: PenLine, booksFinished: BookOpen, goalsDone: Mountain };
  const earned = $derived(seals.filter((s) => s.earned));
  const open = $derived(seals.filter((s) => !s.earned).sort((a, b) => b.value / b.target - a.value / a.target));
  const fmt = (s: Seal, n: number) => (s.stat === 'focusMin' ? `${Math.floor(n / 60)}h ${n % 60}m` : String(n));
  // a 16-point rosette, like a wax seal's scalloped rim
  const ROSETTE = Array.from({ length: 32 }, (_, i) => { const a = (i / 32) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 44 : 48; return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`; }).join(' ');
</script>

<header class="ph">
  <span class="ico" aria-hidden="true"><Award size={24} /></span>
  <div class="t"><PageKicker id="seals" /><h1>Seals</h1><p class="muted">Quiet milestones from your own days. Nothing is ever taken away for a day you missed.</p></div>
</header>

<p class="sum"><b class="num">{earned.length}</b> of {seals.length} earned</p>

{#if earned.length}
  <h2 class="sub">Earned</h2>
  <div class="grid">
    {#each earned as s, i (s.id)}
      {@const Icon = ICON[s.stat]}
      <article class="seal gcard earned" style="--i:{i}">
        <svg viewBox="0 0 100 100" class="emb" aria-hidden="true"><polygon points={ROSETTE} class="rim" /><circle cx="50" cy="50" r="34" class="disc" /><circle cx="50" cy="50" r="29" class="ring" /></svg>
        <span class="glyph" aria-hidden="true"><Icon size={26} /></span>
        <h3>{s.name}</h3><p>{s.line}</p>
        <i class="holo" aria-hidden="true"></i>
      </article>
    {/each}
  </div>
{/if}

<h2 class="sub">Still ahead</h2>
<div class="grid">
  {#each open as s (s.id)}
    {@const Icon = ICON[s.stat]}
    <article class="seal gcard">
      <svg viewBox="0 0 100 100" class="emb" aria-hidden="true"><polygon points={ROSETTE} class="rim" /><circle cx="50" cy="50" r="34" class="disc" /><circle cx="50" cy="50" r="29" class="ring" /></svg>
      <span class="glyph" aria-hidden="true"><Icon size={26} /></span>
      <h3>{s.name}</h3><p>{s.line}</p>
      <div class="prog"><ProgressBar value={s.value} max={s.target} label="{s.name} progress" /><span class="num">{fmt(s, s.value)} / {fmt(s, s.target)}</span></div>
    </article>
  {/each}
</div>

<style>
  .ph { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
  .ico { width: 52px; height: 52px; border-radius: var(--radius-lg); display: grid; place-items: center; color: var(--mod-goals); background: color-mix(in srgb, var(--mod-goals) 14%, transparent); box-shadow: var(--glow); flex: none; }
  .t { flex: 1; min-width: 200px; }
  .sum { font-size: var(--text-md); color: var(--text-2); margin-bottom: var(--space-2); }
  .sum b { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-2xl); color: var(--text); margin-right: 4px; }
  .sub { font-size: var(--text-md); color: var(--text-2); margin: var(--space-6) 0 var(--space-3); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: var(--space-3); }
  /* phones: two seals per row instead of one long column */
  @media (max-width: 520px) {
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
    .seal { padding: var(--space-4) var(--space-2); }
    .emb { width: 70px; height: 70px; }
    .glyph { top: calc(var(--space-4) + 22px); }
    h3 { font-size: var(--text-sm); }
  }
  .seal { position: relative; display: grid; justify-items: center; text-align: center; gap: 4px; padding: var(--space-5) var(--space-4); --c: var(--mod-goals); }
  .emb { width: 92px; height: 92px; margin-bottom: var(--space-2); }
  .rim { fill: color-mix(in srgb, var(--text) 7%, transparent); stroke: color-mix(in srgb, var(--text) 18%, transparent); stroke-width: 1; }
  .disc { fill: color-mix(in srgb, var(--text) 5%, transparent); }
  .ring { fill: none; stroke: color-mix(in srgb, var(--text) 18%, transparent); stroke-width: 1; stroke-dasharray: 2 3; }
  .glyph { position: absolute; top: calc(var(--space-5) + 33px); color: var(--text-3); }
  .earned .rim { fill: var(--mod-goals); stroke: none; }
  .earned .disc { fill: color-mix(in srgb, #000 12%, var(--mod-goals)); }
  .earned .ring { stroke: rgba(255, 255, 255, .55); }
  .earned .glyph { color: #fff; }
  .earned { animation: pop .5s var(--ease-emphasis) both; animation-delay: calc(var(--i) * 60ms); }
  @keyframes pop { from { opacity: 0; transform: scale(.94); } }
  h3 { font-size: var(--text-md); }
  .seal p { font-size: var(--text-xs); color: var(--text-2); }
  .prog { width: 100%; display: grid; gap: 4px; margin-top: var(--space-2); }
  .prog span { font-size: 11px; color: var(--text-3); }

  :global(:root[data-style='almanac']) .earned .rim { fill: var(--accent); }
  :global(:root[data-style='almanac']) .earned .disc { fill: color-mix(in srgb, #000 14%, var(--accent)); }
  :global(:root[data-style='almanac']) .earned .emb { transform: rotate(-8deg); filter: drop-shadow(1px 2px 0 rgba(0, 0, 0, .18)); }
  :global(:root[data-style='almanac']) h3 { font-style: italic; font-weight: 400; font-size: 19px; }
  :global(:root[data-style='almanac']) .sub { font-family: var(--font-mono); font-size: 11px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; border-bottom: 1px solid var(--text); padding-bottom: 6px; }
  :global(:root[data-style='nebula']) .earned .rim { fill: #b78cff; }
  :global(:root[data-style='nebula']) .earned .emb { filter: drop-shadow(0 0 14px rgba(183, 140, 255, .7)); }
  :global(:root[data-style='nebula']) .earned .disc { fill: #7b61ff; }
  .holo { display: none; }
  :global(:root[data-style='nebula']) .earned .holo { display: block; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .12) 50%, transparent 65%); background-size: 250% 100%; animation: holo 4s linear infinite; }
  @keyframes holo { from { background-position: 150% 0; } to { background-position: -100% 0; } }
</style>
