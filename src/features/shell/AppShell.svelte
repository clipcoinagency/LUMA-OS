<script lang="ts">
  // Navigation adapts to the user's modules and order. Desktop: sidebar. Phone: bottom bar with
  // Home + first three modules + "More" sheet (a phone UI, not a squeezed desktop).
  import type { Snippet } from 'svelte';
  import { LayoutDashboard, Settings as SettingsIcon, MoreHorizontal } from '@lucide/svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import { app } from '../../lib/app.svelte';
  import { router, href, type Route } from '../../lib/router.svelte';
  import { MODULES } from '../../lib/modules';
  import { orderedModules } from '../../lib/workspace';

  let { children }: { children: Snippet } = $props();
  let more = $state(false);

  const mods = $derived(orderedModules(app.workspace!));
  const BOTTOM = 3;
  const bottomMods = $derived(mods.slice(0, BOTTOM));
  const moreMods = $derived(mods.slice(BOTTOM));

  function isActive(r: Route): boolean {
    const cur = router.route;
    if (r.name === 'module') return cur.name === 'module' && cur.module === r.module;
    return cur.name === r.name;
  }
  const moreActive = $derived(router.route.name === 'settings' || (router.route.name === 'module' && moreMods.includes(router.route.module)));
</script>

<div class="shell">
  <aside class="sidebar" aria-label="Main navigation">
    <a class="brand" href={href({ name: 'dashboard' })}><span class="mark" aria-hidden="true"></span>Life OS</a>
    <nav>
      <a href={href({ name: 'dashboard' })} class:active={isActive({ name: 'dashboard' })} aria-current={isActive({ name: 'dashboard' }) ? 'page' : undefined}>
        <span class="ico"><LayoutDashboard size={19} /></span>Dashboard
      </a>
      <p class="group">Your modules</p>
      {#each mods as id (id)}
        {@const m = MODULES[id]}
        {@const r = { name: 'module', module: id } as const}
        <a href={href(r)} class:active={isActive(r)} aria-current={isActive(r) ? 'page' : undefined} style="--c:{m.color}">
          <span class="ico mod"><m.icon size={19} /></span>{m.name}
        </a>
      {/each}
    </nav>
    <div class="foot">
      <a href={href({ name: 'settings' })} class:active={isActive({ name: 'settings' })} aria-current={isActive({ name: 'settings' }) ? 'page' : undefined}>
        <span class="ico"><SettingsIcon size={19} /></span>Settings
      </a>
    </div>
  </aside>

  <div class="main">
    <main id="main" tabindex="-1">{@render children()}</main>
  </div>

  <nav class="bottom" aria-label="Main navigation">
    <a href={href({ name: 'dashboard' })} class:active={isActive({ name: 'dashboard' })} aria-current={isActive({ name: 'dashboard' }) ? 'page' : undefined}>
      <LayoutDashboard size={22} /><span>Home</span>
    </a>
    {#each bottomMods as id (id)}
      {@const m = MODULES[id]}
      {@const r = { name: 'module', module: id } as const}
      <a href={href(r)} class:active={isActive(r)} aria-current={isActive(r) ? 'page' : undefined} style="--c:{m.color}">
        <m.icon size={22} /><span>{m.name.split(' ')[0]}</span>
      </a>
    {/each}
    <button type="button" class:active={moreActive} onclick={() => (more = true)} aria-haspopup="dialog">
      <MoreHorizontal size={22} /><span>More</span>
    </button>
  </nav>
</div>

<Modal bind:open={more} title="More" size="sm">
  <div class="sheet-links">
    {#each moreMods as id (id)}
      {@const m = MODULES[id]}
      <a href={href({ name: 'module', module: id })} onclick={() => (more = false)} style="--c:{m.color}"><span class="ico mod"><m.icon size={20} /></span>{m.name}</a>
    {/each}
    <a href={href({ name: 'settings' })} onclick={() => (more = false)}><span class="ico"><SettingsIcon size={20} /></span>Settings</a>
  </div>
</Modal>

<style>
  .shell { min-height: 100dvh; }
  .main { padding: max(var(--space-5), env(safe-area-inset-top)) var(--space-4) calc(88px + env(safe-area-inset-bottom)); max-width: var(--content-max); margin: 0 auto; }
  main:focus { outline: none; }

  /* phone bottom bar */
  .bottom {
    position: fixed; z-index: var(--z-nav); left: 0; right: 0; bottom: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
    padding: 6px 6px max(6px, env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border-top: 1px solid var(--border);
  }
  .bottom a, .bottom button {
    display: grid; justify-items: center; gap: 2px; padding: 6px 2px; min-height: 52px; border-radius: var(--radius-md);
    color: var(--text-3); text-decoration: none; font-size: 11px; font-weight: 600; background: none; border: 0; cursor: pointer;
    transition: color var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out);
  }
  .bottom a.active, .bottom button.active { color: var(--c, var(--accent-ink)); }
  .bottom a.active :global(svg), .bottom button.active :global(svg) { transform: translateY(-1px); filter: drop-shadow(var(--nav-glow, 0 0 0 transparent)); }
  :global([data-theme='dark']) .bottom { --nav-glow: 0 0 6px rgba(79, 216, 242, .5); }
  .bottom :global(svg) { transition: transform var(--dur) var(--ease-emphasis); }
  :global(.toaster) { --toast-offset: 72px; }

  .sidebar { display: none; }

  @media (min-width: 1024px) {
    .bottom { display: none; }
    :global(.toaster) { --toast-offset: 0px; }
    .sidebar {
      position: fixed; inset: 0 auto 0 0; width: var(--sidebar-w); display: flex; flex-direction: column; gap: var(--space-4);
      padding: var(--space-5) var(--space-3); border-right: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 70%, transparent);
      backdrop-filter: blur(10px); overflow-y: auto;
    }
    .main { margin-left: var(--sidebar-w); padding: var(--space-7) var(--space-8) var(--space-10); max-width: calc(var(--content-max) + var(--sidebar-w)); }
  }
  .brand { display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-3) var(--space-3); font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-lg); color: var(--text); text-decoration: none; }
  .mark { width: 30px; height: 30px; border-radius: 30%; background: conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent)); box-shadow: var(--glow); }
  nav { display: grid; gap: 2px; }
  .group { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3); padding: var(--space-4) var(--space-3) var(--space-2); }
  .sidebar a, .sheet-links a {
    position: relative; display: flex; align-items: center; gap: var(--space-3); min-height: 42px; padding: 0 var(--space-3);
    border-radius: var(--radius-sm); color: var(--text-2); text-decoration: none; font-weight: 600;
    transition: background-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out);
  }
  .sidebar a:hover { background: var(--surface-2); color: var(--text); }
  .sidebar a.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-1), var(--glow); }
  .sidebar a.active::before { content: ''; position: absolute; left: -12px; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: var(--c, var(--accent)); }
  .ico { display: grid; place-items: center; width: 30px; height: 30px; border-radius: var(--radius-xs); color: var(--text-2); flex: none; }
  .ico.mod { color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
  .foot { margin-top: auto; border-top: 1px solid var(--border); padding-top: var(--space-3); }
  .sheet-links { display: grid; gap: var(--space-1); }
  .sheet-links a { min-height: 52px; font-size: var(--text-md); color: var(--text); }
  .sheet-links a:hover { background: var(--surface-2); }
</style>
