<script lang="ts">
  // First launch: set up a personal workspace in five calm steps. Choices are drafted locally
  // (theme previews live) and saved together at the end. "Restore from a backup" is offered up
  // front, because a wiped browser looks exactly like a first launch.
  import { fly, fade, scale } from 'svelte/transition';
  import { ArrowLeft, ArrowRight, Upload, ShieldCheck, WifiOff, Sparkles } from '@lucide/svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import ReorderList from '../../lib/ui/ReorderList.svelte';
  import ModulePicker from '../workspace/ModulePicker.svelte';
  import PersonaPicker from '../workspace/PersonaPicker.svelte';
  import { workspaceForPersona, type Persona } from '../../lib/personas';
  import ThemePicker from '../workspace/ThemePicker.svelte';
  import LayoutPicker from '../workspace/LayoutPicker.svelte';
  import RestoreFlow from '../settings/RestoreFlow.svelte';
  import { app, applyTheme } from '../../lib/app.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { MODULES, WIDGETS } from '../../lib/modules';
  import { currencyOptions as makeCurrencyOptions } from '../../lib/util/money';
  import { dur } from '../../lib/motion';
  import { withEnabledModules, widgetChoices } from '../../lib/workspace';
  import type { ModuleId, ThemeId, WidgetId, Workspace } from '../../lib/db/schema';
  import { themeName } from '../../lib/theme';
  import Logo from '../../lib/ui/Logo.svelte';

  const STEPS = ['welcome', 'persona', 'modules', 'theme', 'about', 'dashboard', 'done'] as const;
  type Step = (typeof STEPS)[number];
  const PROGRESS: Record<Step, number> = { welcome: 0, persona: 1, modules: 1, theme: 2, about: 3, dashboard: 3, done: 4 };

  let step = $state<Step>('welcome');
  let direction = $state(1);
  let saving = $state(false);
  let restoring = $state(false);

  const s = app.settings!;
  const w = app.workspace!;
  let name = $state(s.displayName);
  let theme = $state<ThemeId>(s.theme);
  let currency = $state(s.currency);
  let weekStart = $state(String(s.weekStartsOn));
  let weight = $state<string>(s.units.weight);
  let water = $state<string>(s.units.water);
  let ws = $state<Pick<Workspace, 'enabledModules' | 'moduleOrder' | 'widgets' | 'dashboardLayout' | 'persona'>>({
    enabledModules: [...w.enabledModules], moduleOrder: [...w.moduleOrder], widgets: [...w.widgets], dashboardLayout: w.dashboardLayout, persona: w.persona ?? null,
  });
  function pickPersona(p: Persona) { ws = { ...ws, ...workspaceForPersona(p) }; }

  const currencyOptions = makeCurrencyOptions();

  function go(next: Step) {
    direction = STEPS.indexOf(next) >= STEPS.indexOf(step) ? 1 : -1;
    step = next;
    queueMicrotask(() => document.getElementById('ob-heading')?.focus());
  }
  const nextOf = (st: Step) => STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(st) + 1)]!;
  const prevOf = (st: Step) => STEPS[Math.max(0, STEPS.indexOf(st) - 1)]!;

  function setModules(next: ModuleId[]) {
    ws = { ...ws, ...withEnabledModules(ws, next) };
  }
  function setTheme(t: ThemeId) {
    theme = t;
    applyTheme(t, true);
  }

  // widgets: ordered list of every available widget + which are on
  const widgetItems = $derived(widgetChoices(ws).map((id) => ({ id, label: WIDGETS[id].name, description: WIDGETS[id].description })));
  function reorderWidgets(ids: string[]) {
    ws = { ...ws, widgets: ids.filter((id) => ws.widgets.includes(id as WidgetId)) as WidgetId[] };
  }
  function toggleWidget(id: string, on: boolean) {
    const order = widgetChoices(ws);
    const enabled = new Set(ws.widgets);
    if (on) enabled.add(id as WidgetId); else enabled.delete(id as WidgetId);
    ws = { ...ws, widgets: order.filter((x) => enabled.has(x)) };
  }
  const moduleItems = $derived(ws.moduleOrder.filter((m) => ws.enabledModules.includes(m)).map((m) => ({ id: m, label: MODULES[m].name, color: MODULES[m].color })));
  const moduleIcons = Object.fromEntries(Object.values(MODULES).map((m) => [m.id, m.icon]));

  async function finish() {
    saving = true;
    try {
      await app.updateSettings({
        displayName: name.trim(), theme, currency, weekStartsOn: weekStart === '0' ? 0 : 1,
        units: { weight: weight as 'kg' | 'lb', water: water as 'ml' | 'oz' | 'glasses' },
      });
      await app.updateWorkspace({ ...ws, onboarded: true });
      // the parent swaps to the app shell when workspace.onboarded flips
    } catch (e) {
      console.error('Saving workspace failed', e);
      toast("Your workspace couldn't be saved. Please try again.", { tone: 'danger' });
    } finally {
      saving = false;
    }
  }

  const has = (m: ModuleId) => ws.enabledModules.includes(m);
  const summary = $derived(`${ws.enabledModules.length} module${ws.enabledModules.length === 1 ? '' : 's'} · ${themeName(theme)} theme · ${ws.dashboardLayout[0]!.toUpperCase() + ws.dashboardLayout.slice(1)} layout`);
</script>

<div class="ob">
  <header class="bar">
    <span class="brand"><Logo size={30} />Life OS</span>
    {#if step !== 'welcome'}
      <ol class="progress" aria-label="Setup progress">
        {#each ['Modules', 'Theme', 'Personalize', 'Create'] as label, i (label)}
          <li class:done={PROGRESS[step] > i + 1} class:current={PROGRESS[step] === i + 1} aria-current={PROGRESS[step] === i + 1 ? 'step' : undefined}>
            <span class="sr-only">Step {i + 1}: {label}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </header>

  <main class="stage">
    {#key step}
      <section class="step" in:fly={{ x: 28 * direction, duration: dur(320), delay: dur(60) }} out:fade={{ duration: dur(120) }}>
        {#if step === 'welcome'}
          <div class="welcome">
            <div class="orb" aria-hidden="true">
              {#each Object.values(MODULES) as m, i (m.id)}
                <span class="orbit" style="--i:{i};--c:{m.color}"><m.icon size={18} /></span>
              {/each}
              <span class="core"></span>
            </div>
            <h1 id="ob-heading" tabindex="-1" class="hero">Your life.<br />Your system.</h1>
            <p class="lead">Your entire life, one system. Tasks, goals, habits, focus, money and wellbeing in one calm, private workspace — arranged the way you actually live.</p>
            <ul class="promises">
              <li><ShieldCheck size={18} aria-hidden="true" /> Your data stays on your device</li>
              <li><WifiOff size={18} aria-hidden="true" /> Works offline, no account needed</li>
            </ul>
            <div class="cta">
              <Button variant="primary" size="lg" onclick={() => go('persona')}>Set up my workspace {#snippet icon()}<Sparkles />{/snippet}</Button>
              <Button variant="ghost" onclick={() => (restoring = true)}>{#snippet icon()}<Upload />{/snippet}I have a backup</Button>
            </div>
            <p class="meta">Takes about a minute. You can change everything later.</p>
          </div>

        {:else if step === 'persona'}
          <h1 id="ob-heading" tabindex="-1">Where would you like to start?</h1>
          <p class="lead">Pick the one that sounds most like you. Next you can add or remove any area.</p>
          <PersonaPicker value={ws.persona ?? null} onchange={pickPersona} />

        {:else if step === 'modules'}
          <h1 id="ob-heading" tabindex="-1">Fine-tune your areas</h1>
          <p class="lead">Turn on the parts of your life you want Life OS to manage. Change this any time.</p>
          <ModulePicker selected={ws.enabledModules} onchange={setModules} />

        {:else if step === 'theme'}
          <h1 id="ob-heading" tabindex="-1">Pick your look</h1>
          <p class="lead">Three themes, same great experience. Switch any time in Settings.</p>
          <ThemePicker value={theme} onchange={setTheme} />

        {:else if step === 'about'}
          <h1 id="ob-heading" tabindex="-1">Make it yours</h1>
          <p class="lead">A few details so Life OS speaks your language.</p>
          <div class="form">
            <TextField label="What should we call you?" bind:value={name} placeholder="Your first name" maxlength={40} autocomplete="given-name" hint="Used for your greeting. Optional." />
            {#if has('finance')}
              <Select label="Currency for Finance" bind:value={currency} options={currencyOptions} />
            {/if}
            <div class="field">
              <span class="flabel" id="ws-l">Week starts on</span>
              <Segmented label="Week starts on" bind:value={weekStart} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
            </div>
            {#if has('wellness')}
              <div class="two">
                <Select label="Weight unit" bind:value={weight} options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]} />
                <Select label="Water unit" bind:value={water} options={[{ value: 'glasses', label: 'Glasses' }, { value: 'ml', label: 'Millilitres (ml)' }, { value: 'oz', label: 'Fluid ounces (oz)' }]} />
              </div>
            {/if}
          </div>

        {:else if step === 'dashboard'}
          <h1 id="ob-heading" tabindex="-1">Design your dashboard</h1>
          <p class="lead">Choose a layout and what shows up first. Use the arrows to reorder.</p>
          <div class="sections">
            <section aria-labelledby="lay-h"><h2 id="lay-h" class="sub">Layout</h2>
              <LayoutPicker value={ws.dashboardLayout} onchange={(v) => (ws = { ...ws, dashboardLayout: v })} />
            </section>
            <div class="cols">
              <section aria-labelledby="ord-h"><h2 id="ord-h" class="sub">Module order</h2>
                <ReorderList label="Module order" items={moduleItems} icons={moduleIcons} onreorder={(ids) => (ws = { ...ws, moduleOrder: ids as ModuleId[] })} />
              </section>
              <section aria-labelledby="wid-h"><h2 id="wid-h" class="sub">Dashboard widgets</h2>
                <ReorderList label="Dashboard widgets" items={widgetItems} enabled={ws.widgets} onreorder={reorderWidgets} ontoggle={toggleWidget} />
              </section>
            </div>
          </div>

        {:else}
          <div class="finish">
            <div class="assemble" aria-hidden="true">
              {#each ws.moduleOrder.filter((m) => ws.enabledModules.includes(m)) as m, i (m)}
                {@const M = MODULES[m]}
                <span class="tile" style="--c:{M.color}" in:scale={{ start: 0.4, duration: dur(420), delay: dur(120 + i * 90) }}><M.icon size={22} /></span>
              {/each}
            </div>
            <h1 id="ob-heading" tabindex="-1" class="hero small">{name.trim() ? `Ready when you are, ${name.trim()}.` : 'Your workspace is ready.'}</h1>
            <p class="lead">{summary}</p>
            <Button variant="primary" size="lg" loading={saving} onclick={finish}>Open my workspace {#snippet icon()}<ArrowRight />{/snippet}</Button>
          </div>
        {/if}
      </section>
    {/key}
  </main>

  {#if step !== 'welcome' && step !== 'done'}
    <footer class="nav">
      <Button variant="ghost" onclick={() => go(prevOf(step))}>{#snippet icon()}<ArrowLeft />{/snippet}Back</Button>
      <Button variant="primary" onclick={() => go(nextOf(step))}>{step === 'dashboard' ? 'Create workspace' : 'Continue'}</Button>
    </footer>
  {:else if step === 'done'}
    <footer class="nav"><Button variant="ghost" onclick={() => go('dashboard')}>{#snippet icon()}<ArrowLeft />{/snippet}Back</Button><span></span></footer>
  {/if}
</div>

<RestoreFlow bind:open={restoring} />

<style>
  .ob { min-height: 100dvh; display: grid; grid-template-rows: auto 1fr auto; max-width: 980px; margin: 0 auto; padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-4) 0; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); min-height: 48px; }
  .brand { display: flex; align-items: center; gap: var(--space-2); font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-md); }
  .progress { list-style: none; display: flex; gap: 6px; margin: 0; padding: 0; }
  .progress li { width: 28px; height: 6px; border-radius: 99px; background: var(--surface-3); transition: background-color var(--dur-slow) var(--ease-out), width var(--dur-slow) var(--ease-out); }
  .progress li.done { background: color-mix(in srgb, var(--accent) 55%, var(--surface-3)); }
  .progress li.current { background: var(--accent); width: 44px; box-shadow: var(--glow); }

  .stage { display: grid; padding: var(--space-6) 0 var(--space-8); }
  .step { grid-area: 1 / 1; display: grid; align-content: start; gap: var(--space-3); min-width: 0; }
  h1 { font-size: clamp(var(--text-xl), 4.5vw, var(--text-2xl)); }
  h1:focus { outline: none; }
  .lead { color: var(--text-2); font-size: var(--text-md); max-width: 56ch; margin-bottom: var(--space-4); }
  .sub { font-size: var(--text-base); font-family: var(--font-body); font-weight: 700; letter-spacing: 0; margin-bottom: var(--space-3); color: var(--text-2); }

  .welcome, .finish { display: grid; justify-items: center; text-align: center; gap: var(--space-4); padding-top: clamp(var(--space-4), 5vh, var(--space-9)); }
  .welcome .lead, .finish .lead { margin: 0 auto; }
  .hero { font-size: clamp(2.4rem, 8vw, 3.6rem); line-height: 1.05; }
  .hero.small { font-size: clamp(1.8rem, 6vw, 2.6rem); }
  .promises { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2) var(--space-5); color: var(--text-2); font-weight: 550; }
  .promises li { display: flex; align-items: center; gap: var(--space-2); }
  .promises :global(svg) { color: var(--accent-ink); }
  .cta { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); margin-top: var(--space-2); }

  .orb { position: relative; width: 190px; height: 190px; margin-bottom: var(--space-2); }
  .core { position: absolute; inset: 62px; border-radius: 32%; background: conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent)); box-shadow: var(--shadow-2), var(--glow); animation: breathe 5s var(--ease-in-out) infinite; }
  .orbit {
    --a: calc(var(--i) * 51.43deg - 90deg);
    position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; margin: -19px; border-radius: 12px; display: grid; place-items: center;
    color: var(--c); background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-1);
    transform: rotate(var(--a)) translate(78px) rotate(calc(-1 * var(--a)));
    animation: pop-in var(--dur-slow) var(--ease-emphasis) both; animation-delay: calc(var(--i) * 70ms + 150ms);
  }
  @keyframes pop-in { from { opacity: 0; scale: .5; } }
  @keyframes breathe { 50% { transform: scale(.94) rotate(8deg); } }

  .form { display: grid; gap: var(--space-5); max-width: 520px; }
  .field { display: grid; gap: 6px; }
  .flabel { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .two { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .sections { display: grid; gap: var(--space-6); }
  .cols { display: grid; gap: var(--space-6); grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); align-items: start; }

  .assemble { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); max-width: 340px; margin-bottom: var(--space-2); }
  .tile { width: 56px; height: 56px; border-radius: var(--radius-md); display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, var(--surface)); border: 1px solid color-mix(in srgb, var(--c) 30%, var(--border)); box-shadow: var(--shadow-1); }

  .nav {
    position: sticky; bottom: 0; display: flex; justify-content: space-between; gap: var(--space-3);
    padding: var(--space-3) 0 max(var(--space-4), env(safe-area-inset-bottom));
    background: linear-gradient(to top, var(--bg) 70%, transparent);
  }
</style>
