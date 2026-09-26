<script lang="ts">
  // Boot → (onboarding | workspace). Routes are hash-based so they work from file:// too.
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { app } from './lib/app.svelte';
  import { router } from './lib/router.svelte';
  import { dur } from './lib/motion';
  import Button from './lib/ui/Button.svelte';
  import ErrorState from './lib/ui/ErrorState.svelte';
  import Toaster from './lib/ui/Toaster.svelte';
  import Onboarding from './features/onboarding/Onboarding.svelte';
  import AppShell from './features/shell/AppShell.svelte';
  import Dashboard from './features/dashboard/Dashboard.svelte';
  import ModulePage from './features/modules/ModulePage.svelte';
  import Settings from './features/settings/Settings.svelte';
  import DesignSystem from './dev/DesignSystem.svelte';
  import DataLab from './dev/DataLab.svelte';

  onMount(() => { void app.start(); });

  const route = $derived(router.route);
  const routeKey = $derived(route.name === 'module' ? `m-${route.module}` : route.name === 'dev' ? `dev-${route.page}` : route.name);
  // a disabled module's URL falls back to the dashboard
  $effect(() => {
    if (app.status === 'ready' && route.name === 'module' && !app.workspace?.enabledModules.includes(route.module)) router.go({ name: 'dashboard' });
  });
  // finishing setup (or restoring a backup from the Welcome screen) always lands on the dashboard
  let wasOnboarded: boolean | undefined;
  $effect(() => {
    const ob = app.workspace?.onboarded;
    if (ob && wasOnboarded === false) router.go({ name: 'dashboard' });
    if (ob !== undefined) wasOnboarded = ob;
  });
  // move focus to the new page for keyboard + screen-reader users
  $effect(() => {
    void routeKey;
    queueMicrotask(() => document.getElementById('main')?.focus({ preventScroll: true }));
    window.scrollTo({ top: 0 });
  });
</script>

{#if app.status === 'loading'}
  <div class="boot" aria-busy="true" aria-label="Opening Life OS"><div class="logo" aria-hidden="true"></div></div>
{:else if app.status === 'error'}
  <main class="center">
    <ErrorState title="Life OS can't open its storage" message={app.error?.message ?? ''} details={String(app.error?.cause ?? '')}>
      {#snippet actions()}
        <Button variant="primary" onclick={() => app.start()}>Try again</Button>
        <Button onclick={() => location.reload()}>Reload</Button>
      {/snippet}
    </ErrorState>
    <p class="meta hint">Tip: private/incognito windows can't keep your data. Open Life OS in a normal window.</p>
  </main>
{:else if !app.workspace?.onboarded}
  <div in:fade={{ duration: dur(250) }}><Onboarding /></div>
{:else}
  {#if app.staleWindow}
    <div class="stale" role="alert">Life OS was updated in another window. <button onclick={() => location.reload()}>Reload</button></div>
  {/if}
  <div in:fade={{ duration: dur(300) }}>
    <AppShell>
      {#key routeKey}
        <div class="page" in:fly={{ y: 10, duration: dur(260), delay: dur(40) }}>
          {#if route.name === 'dashboard'}<Dashboard />
          {:else if route.name === 'module'}<ModulePage module={route.module} />
          {:else if route.name === 'settings'}<Settings />
          {:else if route.page === 'design'}<DesignSystem />
          {:else}<DataLab />{/if}
        </div>
      {/key}
    </AppShell>
  </div>
{/if}
<Toaster />

<style>
  .boot { min-height: 100dvh; display: grid; place-items: center; }
  .logo { width: 56px; height: 56px; border-radius: 30%; background: conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent)); box-shadow: var(--glow); animation: breathe 1.6s var(--ease-in-out) infinite; }
  @keyframes breathe { 50% { transform: scale(.92); opacity: .8; } }
  .center { min-height: 100dvh; display: grid; place-content: center; padding: var(--space-5); }
  .hint { text-align: center; }
  .stale { position: sticky; top: 0; z-index: var(--z-overlay); background: var(--warning-soft); color: var(--warning); padding: var(--space-3) var(--space-4); font-weight: 600; text-align: center; }
  .stale button { margin-left: var(--space-2); font-weight: 700; text-decoration: underline; background: none; border: 0; color: inherit; cursor: pointer; }
  .page { min-width: 0; }
</style>
