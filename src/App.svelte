<script lang="ts">
  // Phase 1 shell: boots the data layer (with loading + friendly error states) and hosts the
  // design-system and data labs. Phase 2 replaces the body with onboarding → dashboard.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Moon, Sun } from '@lucide/svelte';
  import { app } from './lib/app.svelte';
  import Button from './lib/ui/Button.svelte';
  import IconButton from './lib/ui/IconButton.svelte';
  import Segmented from './lib/ui/Segmented.svelte';
  import ErrorState from './lib/ui/ErrorState.svelte';
  import Skeleton from './lib/ui/Skeleton.svelte';
  import Toaster from './lib/ui/Toaster.svelte';
  import DesignSystem from './dev/DesignSystem.svelte';
  import DataLab from './dev/DataLab.svelte';
  import { APP_VERSION } from './lib/db/defaults';

  let tab = $state('design');
  onMount(() => { void app.start(); });

  function toggleTheme() {
    void app.updateSettings({ theme: app.settings?.theme === 'dark' ? 'soft' : 'dark' });
  }
</script>

{#if app.status === 'loading'}
  <div class="boot" aria-busy="true" aria-label="Opening Life OS">
    <div class="logo" aria-hidden="true"></div>
    <div class="sk"><Skeleton width="180px" height="12px" /></div>
  </div>
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
{:else}
  <div class="shell" in:fade={{ duration: 200 }}>
    {#if app.staleWindow}
      <div class="stale" role="alert">Life OS was updated in another window. <button onclick={() => location.reload()}>Reload</button></div>
    {/if}
    <header class="top">
      <div class="brand">
        <span class="mark" aria-hidden="true"></span>
        <div>
          <p class="name">Life OS</p>
          <p class="meta">Foundation · v{APP_VERSION} · {app.platform} · launch #{app.launches}</p>
        </div>
      </div>
      <IconButton label={app.settings?.theme === 'dark' ? 'Switch to Soft theme' : 'Switch to Dark theme'} variant="soft" onclick={toggleTheme}>
        {#if app.settings?.theme === 'dark'}<Sun />{:else}<Moon />{/if}
      </IconButton>
    </header>

    <main>
      <div class="intro">
        <h1>Design system &amp; data layer</h1>
        <p class="muted">Phase 1 foundation. Every component in both themes, and the real storage, backup and restore engine.</p>
      </div>
      <div class="tabs">
        <Segmented label="Section" bind:value={tab} options={[{ value: 'design', label: 'Design system' }, { value: 'data', label: 'Data & backup' }]} />
      </div>
      {#key tab}
        <div in:fade={{ duration: 180 }}>
          {#if tab === 'design'}<DesignSystem />{:else}<DataLab />{/if}
        </div>
      {/key}
    </main>
  </div>
{/if}
<Toaster />

<style>
  .boot { min-height: 100dvh; display: grid; place-content: center; justify-items: center; gap: var(--space-5); }
  .logo, .mark {
    border-radius: 30%; background: conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent));
    box-shadow: var(--glow);
  }
  .logo { width: 56px; height: 56px; animation: breathe 1.6s var(--ease-in-out) infinite; }
  @keyframes breathe { 50% { transform: scale(.92); opacity: .8; } }
  .center { min-height: 100dvh; display: grid; place-content: center; padding: var(--space-5); }
  .hint { text-align: center; }
  .shell { max-width: var(--content-max); margin: 0 auto; padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-4) var(--space-10); }
  .top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0 var(--space-6); }
  .brand { display: flex; align-items: center; gap: var(--space-3); }
  .mark { width: 36px; height: 36px; flex: none; }
  .name { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-lg); line-height: 1; }
  .intro { display: grid; gap: var(--space-2); margin-bottom: var(--space-5); }
  .tabs { max-width: 380px; margin-bottom: var(--space-5); }
  .stale { background: var(--warning-soft); color: var(--warning); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-weight: 600; }
  .stale button { margin-left: var(--space-2); font-weight: 700; text-decoration: underline; background: none; border: 0; color: inherit; cursor: pointer; }
  @media (min-width: 768px) { .shell { padding-left: var(--space-7); padding-right: var(--space-7); } }
</style>
