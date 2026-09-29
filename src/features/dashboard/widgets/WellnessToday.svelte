<script lang="ts">
  // Log today's basics without leaving the dashboard. Each value is saved on today's row only.
  import { Droplet, Moon, Footprints, Minus, Plus } from '@lucide/svelte';
  import { MOODS } from '../../../lib/moods';
  import { roveRadiogroup } from '../../../lib/ui/roveRadiogroup';
  import WidgetCard from '../WidgetCard.svelte';
  import Sparkline from '../../../lib/ui/Sparkline.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { getWellness, updateWellness, wellnessRange } from '../../../lib/domain/daily';
  import { addDays, eachDay } from '../../../lib/util/dates';
  import type { WellnessDay } from '../../../lib/db/schema';

  let day = $state<WellnessDay | null>(null);
  let sleepTrend = $state<(number | null)[]>([]);
  // Rapid consecutive writes (e.g. two stepper clicks) each bump() via updateWellness(), re-running
  // this effect once per write — their getWellness() reads can resolve out of order and an earlier
  // fetch resolving last would otherwise clobber the optimistic update set() already applied for a
  // later write. Guard by only applying a resolved fetch if nothing newer has been triggered since.
  $effect(() => {
    const v = changes.version;
    const d = clock.today;
    void getWellness(d).then((w) => { if (changes.version === v) day = w; });
    void wellnessRange(addDays(d, -13), d).then((rows) => {
      const by = new Map(rows.map((r) => [r.date, r.sleepHours]));
      sleepTrend = eachDay(addDays(d, -13), d).map((k) => by.get(k) ?? null);
    });
  });

  const unit = $derived(app.settings?.units.water ?? 'glasses');
  const step = $derived(unit === 'ml' ? 250 : unit === 'oz' ? 8 : 1);
  const waterLabel = $derived(unit === 'glasses' ? 'glasses' : unit);

  // Optimistic local update before the async DB round-trip resolves — see WellnessPage.svelte's
  // identical fix for why (two rapid stepper clicks would otherwise both read the same stale
  // `day.water` and silently drop an increment).
  function set(patch: Partial<WellnessDay>) {
    if (day) day = { ...day, ...patch };
    return updateWellness(clock.today, patch);
  }
  function num(v: string, max: number): number | null {
    const n = Number(v.replace(',', '.'));
    return v.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.min(n, max);
  }
</script>

<WidgetCard title="Wellness today" module="wellness" loaded={!!day}>
  {#if day}
    <div class="grid">
      <div class="metric">
        <span class="lbl"><Droplet size={16} aria-hidden="true" />Water</span>
        <div class="stepper">
          <button type="button" aria-label="Less water" disabled={!day.water} onclick={() => set({ water: Math.max(0, (day?.water ?? 0) - step) || null })}><Minus size={16} /></button>
          <span class="val num" aria-live="polite">{day.water ?? 0} <small>{waterLabel}</small></span>
          <button type="button" aria-label="More water" onclick={() => set({ water: (day?.water ?? 0) + step })}><Plus size={16} /></button>
        </div>
      </div>
      <div class="metric">
        <label class="lbl" for="w-sleep"><Moon size={16} aria-hidden="true" />Sleep (hours)</label>
        <input id="w-sleep" class="inp num" inputmode="decimal" value={day.sleepHours ?? ''} placeholder="—" onchange={(e) => set({ sleepHours: num(e.currentTarget.value, 24) })} />
      </div>
      <div class="metric">
        <label class="lbl" for="w-steps"><Footprints size={16} aria-hidden="true" />Steps</label>
        <input id="w-steps" class="inp num" inputmode="numeric" value={day.steps ?? ''} placeholder="—" onchange={(e) => { const n = num(e.currentTarget.value, 200000); set({ steps: n === null ? null : Math.round(n) }); }} />
      </div>
    </div>
    <div class="mood" role="radiogroup" aria-label="Mood today" use:roveRadiogroup>
      {#each MOODS as m, i (m.value)}
        <button type="button" role="radio" aria-checked={day.mood === m.value} tabindex={day.mood === m.value || (!day.mood && i === 0) ? 0 : -1} aria-label={m.label} title={m.label} class:on={day.mood === m.value}
          style="--m:{m.color}" onclick={() => set({ mood: day?.mood === m.value ? null : m.value })}><m.icon size={22} aria-hidden="true" /></button>
      {/each}
    </div>
    {#if sleepTrend.filter((v) => v !== null).length > 2}
      <div class="trend"><span class="meta">Sleep, last 14 days</span><Sparkline values={sleepTrend} label="Sleep over the last 14 days" color="var(--mod-wellness)" height={36} /></div>
    {/if}
  {/if}
</WidgetCard>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--space-3); }
  .metric { display: grid; gap: 6px; padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); }
  .lbl { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 650; color: var(--text-2); }
  .lbl :global(svg) { color: var(--mod-wellness); }
  .stepper { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
  .stepper button { width: var(--touch); height: var(--touch); border-radius: 50%; border: 1px solid var(--border-strong); background: var(--surface); display: grid; place-items: center; color: var(--text-2); cursor: pointer; }
  .stepper button:disabled { opacity: .35; cursor: default; }
  .val { font-weight: 700; font-size: var(--text-md); }
  .val small { font-size: var(--text-xs); font-weight: 500; color: var(--text-3); }
  .inp { width: 100%; min-height: 32px; border: 0; background: transparent; font-size: var(--text-md); font-weight: 700; color: var(--text); padding: 0; }
  .inp:focus-visible { box-shadow: var(--focus); }
  .mood { display: flex; justify-content: space-between; gap: 4px; margin-top: var(--space-3); }
  .mood button { flex: 1; min-height: 44px; display: grid; place-items: center; border-radius: var(--radius-sm); border: 1px solid transparent; background: var(--surface-2); color: var(--text-3); cursor: pointer; transition: all var(--dur) var(--ease-out); }
  .mood button:hover { color: var(--m); }
  .mood button.on { color: var(--m); border-color: var(--m); background: color-mix(in srgb, var(--m) 14%, var(--surface)); transform: translateY(-1px); }
  .trend { margin-top: var(--space-4); display: grid; gap: 6px; }
</style>
