<script lang="ts">
  // New looks: three small rituals on Home — close the day (with its state), one minute of breathing,
  // and your seals (how many, and the nearest one to earn).
  import { MoonStar, Wind, Award, ChevronRight, Check } from '@lucide/svelte';
  import Breathe from '../rituals/Breathe.svelte';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { getRange } from '../../lib/db/idb';
  import { CLOSED_TAG, computeSeals, loadSealStats, type Seal } from '../../lib/domain/rituals';
  import { router } from '../../lib/router.svelte';
  import { spotlight } from '../../lib/ui/spotlight';

  let closedToday = $state(false);
  let seals = $state.raw<Seal[]>([]);
  let breathing = $state(false);
  $effect(() => {
    const v = changes.version, day = clock.today;
    void getRange('notes', 'by_date', day, day).then((ns) => { if (v === changes.version) closedToday = ns.some((n) => n.tags.includes(CLOSED_TAG)); });
    void loadSealStats(day, app.settings?.weekStartsOn ?? 1).then((st) => { if (v === changes.version) seals = computeSeals(st); });
  });
  const earned = $derived(seals.filter((s) => s.earned).length);
  const next = $derived(seals.filter((s) => !s.earned).sort((a, b) => b.value / b.target - a.value / a.target)[0]);
  const evening = $derived(clock.hour >= 17);
</script>

<div class="rit">
  <button type="button" class="r gcard lift" style="--c:var(--mod-focus)" use:spotlight onclick={() => router.go({ name: 'close' })}>
    <span class="ri" aria-hidden="true">{#if closedToday}<Check size={18} />{:else}<MoonStar size={18} />{/if}</span>
    <span class="rt"><b>{closedToday ? 'Day closed' : 'Close the day'}</b><span>{closedToday ? 'Tomorrow is ready. Update your line any time.' : evening ? 'Five quiet minutes to finish well.' : 'Best in the evening — wrap up and set up tomorrow.'}</span></span>
    <ChevronRight size={16} aria-hidden="true" />
  </button>
  <button type="button" class="r gcard lift" style="--c:var(--mod-wellness)" use:spotlight onclick={() => (breathing = true)}>
    <span class="ri" aria-hidden="true"><Wind size={18} /></span>
    <span class="rt"><b>Breathe</b><span>One guided minute. Box or 4-7-8.</span></span>
    <ChevronRight size={16} aria-hidden="true" />
  </button>
  <button type="button" class="r gcard lift" style="--c:var(--mod-goals)" use:spotlight onclick={() => router.go({ name: 'seals' })}>
    <span class="ri" aria-hidden="true"><Award size={18} /></span>
    <span class="rt"><b>Seals · {earned} of {seals.length || 16}</b><span>{next ? `Next: ${next.name} — ${next.value}/${next.target}` : 'Every seal earned. Remarkable.'}</span></span>
    <ChevronRight size={16} aria-hidden="true" />
  </button>
</div>
<Breathe bind:open={breathing} />

<style>
  .rit { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: var(--space-3); margin-top: var(--space-5); }
  .r { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); text-align: left; cursor: pointer; color: var(--text); font: inherit; }
  .ri { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; flex: none; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
  .rt { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .rt b { font-weight: 650; }
  .rt span { font-size: var(--text-xs); color: var(--text-2); line-height: 1.35; }
  .r > :global(svg:last-child) { color: var(--text-3); flex: none; }

  :global(:root[data-style='almanac']) .rit { gap: 0; border-top: 1px solid var(--text); border-bottom: 1px solid var(--text); }
  :global(:root[data-style='almanac']) .r { background: none; border: 0; border-radius: 0; box-shadow: inset -1px 0 0 var(--border); }
  :global(:root[data-style='almanac']) .r.lift:hover { transform: none; box-shadow: inset -1px 0 0 var(--border), inset 0 3px 0 var(--c); background: var(--surface); }
  :global(:root[data-style='almanac']) .ri { border-radius: 50%; background: none; border: 1px solid var(--text); color: var(--text); }
  :global(:root[data-style='almanac']) .rt b { font-family: var(--font-display); font-weight: 400; font-size: 19px; font-style: italic; }
  :global(:root[data-style='nebula']) .ri { box-shadow: 0 0 18px color-mix(in srgb, var(--c) 35%, transparent); }
</style>
