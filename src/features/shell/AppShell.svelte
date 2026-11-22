<script lang="ts">
  // The frame around every page. Desktop: a floating glass sidebar (grouped Home / Plan / Life /
  // Reflect) and a slim top bar with search + "New". Phone: a floating glass tab bar whose highlight
  // glides between tabs, a "New" sheet, and pill tabs to hop between pages of the current group.
  import type { Snippet } from 'svelte';
  import { tick } from 'svelte';
  import { House, Settings as SettingsIcon, Ellipsis, Search, Plus, Palette, Command, Focus } from '../../lib/navicons';
  import { focus } from '../../lib/focus.svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import QuickHost from '../quick/QuickHost.svelte';
  import QuickActions from '../dashboard/widgets/QuickActions.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import { app } from '../../lib/app.svelte';
  import { palette } from '../../lib/palette.svelte';
  import { router, href } from '../../lib/router.svelte';
  import { navGroups, groupOfRoute, itemIsActive, tocNumbers, type GroupId, type NavItem } from '../../lib/nav';
  import Logo from '../../lib/ui/Logo.svelte';
  import { themeName, nextTheme, isNewLook } from '../../lib/theme';

  let { children }: { children: Snippet } = $props();
  let more = $state(false);
  let creating = $state(false);
  let scrolled = $state(false);
  let sentinel: HTMLDivElement | undefined = $state();
  let navEl: HTMLElement | undefined = $state();

  const groups = $derived(navGroups(app.workspace!, isNewLook(app.settings?.theme)));
  const toc = $derived(tocNumbers(groups)); // Almanac: page numbers in the contents column
  const where = $derived(groupOfRoute(router.route));
  const currentGroup = $derived(groups.find((g) => g.id === where));
  const homeActive = $derived(router.route.name === 'dashboard');
  const modKey = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

  // remember the last page visited in each group so its tab returns you there
  const lastIn: Partial<Record<GroupId, NavItem>> = {};
  $effect(() => {
    const g = currentGroup;
    if (!g) return;
    const it = g.items.find((i) => itemIsActive(i, router.route));
    if (it) lastIn[g.id] = it;
  });
  function openGroup(id: GroupId) {
    const g = groups.find((x) => x.id === id);
    if (!g) return;
    const remembered = lastIn[id] && g.items.find((i) => i.id === lastIn[id]!.id);
    router.go((remembered ?? g.items[0]!).route);
  }

  // top bar gains its glass only once content scrolls underneath it
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver(([e]) => { scrolled = !e!.isIntersecting; }, { threshold: 0 });
    io.observe(sentinel);
    return () => io.disconnect();
  });

  // sidebar: one indicator that glides to the active item (instead of each item snapping on/off)
  function placeIndicator() {
    const nav = navEl;
    if (!nav) return;
    const a = nav.querySelector<HTMLElement>('a.active');
    if (!a) { nav.style.setProperty('--ind-o', '0'); return; }
    nav.style.setProperty('--ind-y', `${a.offsetTop}px`);
    nav.style.setProperty('--ind-h', `${a.offsetHeight}px`);
    nav.style.setProperty('--ind-c', a.style.getPropertyValue('--c') || 'var(--accent)');
    nav.style.setProperty('--ind-o', '1');
  }
  $effect(() => {
    void router.route; void groups;
    void tick().then(placeIndicator);
  });
  $effect(() => {
    const on = () => placeIndicator();
    window.addEventListener('resize', on);
    document.fonts?.ready.then(on);
    return () => window.removeEventListener('resize', on);
  });

  const tabs = $derived([
    { id: 'home', label: 'Home', icon: House, on: homeActive, go: () => router.go({ name: 'dashboard' }) },
    ...groups.map((g) => ({ id: g.id, label: g.label, icon: g.icon, on: where === g.id, go: () => openGroup(g.id) })),
  ]);
  const moreActive = $derived(where === 'settings');
  const slots = $derived(tabs.length + 1);
  const lens = $derived(moreActive ? tabs.length : Math.max(0, tabs.findIndex((t) => t.on)));
  const showLens = $derived(moreActive || tabs.some((t) => t.on));
</script>

<div class="shell">
  <aside class="sidebar glass-strong" aria-label="Main navigation">
    <a class="brand" href={href({ name: 'dashboard' })}><Logo size={34} />Life OS</a>
    <p class="vol kicker" aria-hidden="true">Vol. II · A personal almanac</p>
    <nav bind:this={navEl}>
      <span class="indicator" aria-hidden="true"></span>
      <a href={href({ name: 'dashboard' })} class:active={homeActive} aria-current={homeActive ? 'page' : undefined} style="--c:var(--accent)">
        <span class="ico"><House size={18} /></span><span class="lbl">Home</span><span class="lead" aria-hidden="true"></span><span class="pg" aria-hidden="true" data-pg="i"></span>
      </a>
      {#each groups as g (g.id)}
        <p class="group">{g.label}</p>
        {#each g.items as it (it.id)}
          {@const on = itemIsActive(it, router.route)}
          <a href={href(it.route)} class:active={on} aria-current={on ? 'page' : undefined} style="--c:{it.color}">
            <span class="ico mod"><it.icon size={18} /></span><span class="lbl">{it.label}</span><span class="lead" aria-hidden="true"></span><span class="pg" aria-hidden="true" data-pg={toc[it.id]?.no}></span>
          </a>
        {/each}
      {/each}
    </nav>
    <div class="foot">
      <button type="button" class="focusbtn" onclick={() => focus.openFor()}>
        <Focus size={17} aria-hidden="true" />{focus.active ? 'Focus in progress' : 'Start focus'}
      </button>
      <button type="button" class="searchpill" onclick={() => palette.show()} aria-label="Search or jump to…">
        <Search size={15} aria-hidden="true" /><span>Search…</span><kbd><Command size={11} aria-hidden="true" />K</kbd>
      </button>
      <a href={href({ name: 'settings' })} class:active={where === 'settings'} aria-current={where === 'settings' ? 'page' : undefined} style="--c:var(--text-2)">
        <span class="ico"><SettingsIcon size={18} /></span>Settings
      </a>
    </div>
  </aside>

  <div class="main">
    <div class="sentinel" bind:this={sentinel} aria-hidden="true"></div>
    <header class="top" class:scrolled>
      <a class="mbrand" href={href({ name: 'dashboard' })} aria-label="Life OS home"><Logo size={28} /><span>Life OS</span></a>
      <span class="spacer"></span>
      <button type="button" class="tbtn icon" onclick={() => palette.show()} aria-label="Search or jump to…"><Search size={18} aria-hidden="true" /></button>
      <button type="button" class="tbtn newbtn" onclick={() => (creating = true)}><Plus size={17} aria-hidden="true" /><span>New</span></button>
    </header>

    {#if currentGroup && currentGroup.items.length > 1}
      <nav class="gtabs" aria-label="{currentGroup.label} pages">
        {#each currentGroup.items as it (it.id)}
          {@const on = itemIsActive(it, router.route)}
          <a href={href(it.route)} class:on aria-current={on ? 'page' : undefined} style="--c:{it.color}"><it.icon size={15} aria-hidden="true" />{it.label}</a>
        {/each}
      </nav>
    {/if}

    <main id="main" tabindex="-1">{@render children()}</main>
  </div>

  <nav class="bottom glass-strong" aria-label="Main navigation" style="--slots:{slots};--lens:{lens}">
    {#if showLens}<span class="lens" aria-hidden="true"></span>{/if}
    {#each tabs as t (t.id)}
      <button type="button" class:active={t.on} aria-current={t.on ? 'page' : undefined} onclick={t.go}>
        <t.icon size={21} /><span>{t.label}</span>
      </button>
    {/each}
    <button type="button" class:active={moreActive} onclick={() => (more = true)} aria-haspopup="dialog"><Ellipsis size={21} /><span>More</span></button>
  </nav>
</div>

<QuickHost />
<CommandPalette />

<Modal bind:open={creating} title="Create" size="sm">
  <QuickActions wrap onrun={() => (creating = false)} />
</Modal>

<Modal bind:open={more} title="More" size="sm">
  <div class="sheet-links">
    <a href={href({ name: 'settings' })} onclick={() => (more = false)}><span class="ico"><SettingsIcon size={20} /></span>Settings</a>
    <button type="button" onclick={() => { more = false; palette.show(); }}><span class="ico"><Search size={20} /></span>Search or jump to…</button>
    <button type="button" onclick={() => void app.updateSettings({ theme: nextTheme(app.settings?.theme ?? 'soft') })}>
      <span class="ico"><Palette size={20} /></span>Switch to {themeName(nextTheme(app.settings?.theme ?? 'soft'))} theme
    </button>
  </div>
</Modal>

<style>
  .shell { min-height: 100dvh; }
  main:focus { outline: none; }

  /* ---- main column ---- */
  .main { padding: 0 var(--space-4) calc(104px + env(safe-area-inset-bottom)); max-width: var(--content-max); margin: 0 auto; }
  .sentinel { height: 1px; margin-bottom: -1px; }
  .top {
    position: sticky; top: var(--banner-offset, 0px); z-index: var(--z-nav); display: flex; align-items: center; gap: var(--space-2);
    margin: 0 calc(-1 * var(--space-4)); padding: max(var(--space-3), env(safe-area-inset-top)) var(--space-4) var(--space-3);
    border-bottom: 1px solid transparent; transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .top.scrolled {
    background: var(--glass-bg-strong); border-bottom-color: var(--glass-edge);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  }
  .mbrand { display: flex; align-items: center; gap: var(--space-2); font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-md); color: var(--text); text-decoration: none; }
  .spacer { flex: 1; }
  .tbtn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; border-radius: var(--radius-btn); cursor: pointer;
    border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text); font-weight: 600; font-size: var(--text-sm);
    box-shadow: var(--glass-highlight); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
    transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out);
  }
  .tbtn.icon { width: 40px; }
  .tbtn:hover { border-color: var(--border-strong); }
  .tbtn:active { transform: scale(.95); }
  .newbtn { padding: 0 var(--space-4); background: var(--accent-grad); color: var(--on-accent); border-color: transparent; box-shadow: var(--shadow-1), var(--glow); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .newbtn { color: #fff; }
  .newbtn:hover { filter: brightness(1.06); border-color: transparent; }

  /* ---- phone: page pills for the current group ---- */
  .gtabs { display: flex; gap: var(--space-2); overflow-x: auto; margin: 0 calc(-1 * var(--space-4)) var(--space-4); padding: 2px var(--space-4); scrollbar-width: none; }
  .gtabs::-webkit-scrollbar { display: none; }
  .gtabs a {
    display: inline-flex; align-items: center; gap: 6px; flex: none; height: 36px; padding: 0 var(--space-3); border-radius: 999px; text-decoration: none;
    font-weight: 600; font-size: var(--text-sm); color: var(--text-2); border: 1px solid var(--border); background: var(--surface);
    transition: background-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out);
  }
  .gtabs a.on { color: var(--text); border-color: color-mix(in srgb, var(--c) 55%, var(--border)); background: color-mix(in srgb, var(--c) 14%, var(--surface)); }
  .gtabs a :global(svg) { color: var(--c); }

  /* ---- phone: floating tab bar ---- */
  .bottom {
    position: fixed; z-index: var(--z-nav); left: max(10px, env(safe-area-inset-left)); right: max(10px, env(safe-area-inset-right));
    bottom: max(10px, env(safe-area-inset-bottom)); display: grid; grid-template-columns: repeat(var(--slots), 1fr); padding: 6px;
    border-radius: var(--radius-2xl);
  }
  .lens {
    position: absolute; top: 6px; bottom: 6px; left: 6px; width: calc((100% - 12px) / var(--slots)); border-radius: calc(var(--radius-2xl) - 6px);
    background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent), var(--glow);
    transform: translateX(calc(var(--lens) * 100%)); transition: transform var(--dur-xslow) var(--ease-emphasis);
  }
  .bottom button {
    position: relative; display: grid; justify-items: center; align-content: center; gap: 2px; min-height: 52px; border-radius: var(--radius-lg);
    color: var(--text-3); font-size: 11px; font-weight: 650; background: none; border: 0; cursor: pointer;
    transition: color var(--dur) var(--ease-out);
  }
  .bottom button.active { color: var(--text); }
  .bottom button.active :global(svg) { color: var(--accent-ink); transform: translateY(-1px); }
  .bottom button :global(svg) { transition: transform var(--dur) var(--ease-emphasis), color var(--dur) var(--ease-out); }
  :global(.toaster) { --toast-offset: 92px; }

  .sidebar { display: none; }

  @media (min-width: 1024px) {
    .bottom, .gtabs, .mbrand { display: none; }
    :global(.toaster) { --toast-offset: 0px; }
    .sidebar {
      /* top honours --banner-offset so a banner above <AppShell> (stale-window / backup reminder)
         pushes the floating sidebar down instead of being covered by it. (Don't reparent it with
         contain/transform — that makes it scroll away with the page.) */
      position: fixed; top: calc(var(--banner-offset, 0px) + var(--sidebar-gap)); left: var(--sidebar-gap); bottom: var(--sidebar-gap);
      width: var(--sidebar-w); display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4) var(--space-3);
      border-radius: var(--radius-2xl); overflow-y: auto; z-index: var(--z-nav);
    }
    .main { margin-left: calc(var(--sidebar-w) + var(--sidebar-gap) * 2); padding: 0 var(--space-8) var(--space-10); max-width: calc(var(--content-max) + var(--sidebar-w) + var(--sidebar-gap) * 2); }
    .top { margin: 0 calc(-1 * var(--space-8)); padding: var(--space-5) var(--space-8) var(--space-3); }
  }

  .brand { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-1) var(--space-3) var(--space-2); font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-lg); color: var(--text); text-decoration: none; }
  nav { position: relative; display: grid; gap: 2px; }
  .indicator {
    position: absolute; left: 0; right: 0; top: 0; height: var(--ind-h, 0px); border-radius: var(--radius-sm); pointer-events: none; opacity: var(--ind-o, 0);
    transform: translateY(var(--ind-y, 0px)); background: color-mix(in srgb, var(--ind-c, var(--accent)) 13%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ind-c, var(--accent)) 26%, transparent);
    transition: transform var(--dur-slow) var(--ease-glide), height var(--dur-slow) var(--ease-glide), opacity var(--dur) var(--ease-out), background-color var(--dur-slow) var(--ease-out);
  }
  .group { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--text-3); padding: var(--space-4) var(--space-3) var(--space-1); }
  .sidebar a, .sheet-links a, .sheet-links button {
    position: relative; display: flex; align-items: center; gap: var(--space-3); min-height: 40px; padding: 0 var(--space-3);
    border-radius: var(--radius-sm); color: var(--text-2); text-decoration: none; font-weight: 600; background: none; border: 0; cursor: pointer; text-align: left;
    transition: background-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out);
  }
  .sidebar nav a:hover { background: color-mix(in srgb, var(--text) 5%, transparent); color: var(--text); }
  .sidebar a.active { color: var(--text); }
  .ico { display: grid; place-items: center; width: 28px; height: 28px; border-radius: var(--radius-xs); color: var(--text-2); flex: none; }
  .ico.mod, .sidebar a.active .ico { color: var(--c); }
  .ico.mod { background: color-mix(in srgb, var(--c) 12%, transparent); }
  .foot { margin-top: auto; display: grid; gap: var(--space-2); border-top: 1px solid var(--glass-edge); padding-top: var(--space-3); }
  .focusbtn {
    display: flex; align-items: center; justify-content: center; gap: var(--space-2); height: 42px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 700; font-size: var(--text-sm);
    color: var(--text); border: 1px solid color-mix(in srgb, var(--mod-focus) 40%, transparent);
    background: linear-gradient(135deg, color-mix(in srgb, var(--mod-focus) 20%, transparent), color-mix(in srgb, var(--accent) 12%, transparent));
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .focusbtn:hover { border-color: var(--mod-focus); box-shadow: 0 0 22px color-mix(in srgb, var(--mod-focus) 28%, transparent); }
  .focusbtn:active { transform: scale(.97); }
  .focusbtn :global(svg) { color: var(--mod-focus); }
  .searchpill {
    display: flex; align-items: center; gap: var(--space-2); height: 38px; padding: 0 var(--space-3); border-radius: var(--radius-sm); cursor: pointer;
    background: color-mix(in srgb, var(--text) 5%, transparent); border: 1px solid var(--glass-edge); color: var(--text-3); font-size: var(--text-sm);
    transition: border-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out);
  }
  .searchpill:hover { color: var(--text-2); border-color: var(--border-strong); }
  .searchpill span { flex: 1; text-align: left; }
  kbd { display: inline-flex; align-items: center; gap: 2px; font: 600 11px var(--font-body); padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border-strong); color: var(--text-3); }
  .sheet-links { display: grid; gap: var(--space-1); }
  .sheet-links a, .sheet-links button { min-height: 52px; font-size: var(--text-md); color: var(--text); width: 100%; }
  .sheet-links a:hover, .sheet-links button:hover { background: var(--surface-2); }

  /* ================================================================== Almanac (Paper / Night Ink)
     The sidebar becomes a printed table of contents: page numbers with dotted leaders, section marks,
     an ink rule down the spine, and a vermilion bookmark that glides to the current page. */
  .vol, .lead, .pg { display: none; }
  :global([data-style='almanac']) .vol { display: block; margin: -6px 0 var(--space-2); padding: 0 var(--space-3); font-size: 9.5px; color: var(--text-3); }
  :global([data-style='almanac']) .brand { font-style: italic; font-weight: 400; font-size: 26px; letter-spacing: -0.02em; gap: var(--space-3); }
  :global([data-style='almanac']) .mbrand { font-style: italic; font-weight: 400; font-size: 21px; }
  @media (min-width: 1024px) {
    :global([data-style='almanac']) .sidebar {
      top: var(--banner-offset, 0px); left: 0; bottom: 0; width: calc(var(--sidebar-w) + 12px); border-radius: 0;
      background: transparent; border: 0; border-right: 1px solid var(--text); padding: var(--space-6) var(--space-5) var(--space-5) var(--space-4);
    }
    :global([data-style='almanac']) .main { margin-left: calc(var(--sidebar-w) + 12px); padding: 0 var(--space-9) var(--space-10); max-width: calc(var(--content-max) + var(--sidebar-w) + 12px); }
    :global([data-style='almanac']) .top { margin: 0 calc(-1 * var(--space-9)); padding: var(--space-5) var(--space-9) var(--space-3); }
  }
  :global([data-style='almanac']) .sidebar nav { gap: 0; }
  :global([data-style='almanac']) .sidebar nav a { min-height: 34px; gap: var(--space-2); padding: 0 0 0 var(--space-3); border-radius: 0; font-weight: 500; color: var(--text-2); }
  :global([data-style='almanac']) .sidebar nav a .ico { display: none; }
  :global([data-style='almanac']) .sidebar nav a:hover { background: none; color: var(--text); }
  :global([data-style='almanac']) .sidebar nav a:hover .lbl { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
  :global([data-style='almanac']) .lead { display: block; flex: 1; min-width: 12px; align-self: center; transform: translateY(4px); border-bottom: 1.5px dotted color-mix(in srgb, var(--text) 30%, transparent); }
  .pg::after { content: attr(data-pg); }
  :global([data-style='almanac']) .pg { display: inline; font: 500 11px var(--font-mono); letter-spacing: .04em; color: var(--text-3); min-width: 18px; text-align: right; }
  :global([data-style='almanac']) .sidebar nav a.active { color: var(--text); }
  :global([data-style='almanac']) .sidebar nav a.active .lbl { font-family: var(--font-display); font-style: italic; font-size: 18px; letter-spacing: -0.01em; }
  :global([data-style='almanac']) .sidebar nav a.active .pg { color: var(--accent-ink); }
  :global([data-style='almanac']) .indicator { right: auto; left: 0; width: 3px; border-radius: 0; background: var(--accent); box-shadow: none; }
  :global([data-style='almanac']) .group {
    display: flex; align-items: center; gap: var(--space-2); padding: var(--space-5) 0 var(--space-1) var(--space-3);
    font: 500 10px var(--font-mono); letter-spacing: .18em; color: var(--text-3);
  }
  :global([data-style='almanac']) .group::before { content: '§'; font-family: var(--font-display); font-size: 13px; letter-spacing: 0; color: var(--accent-ink); }
  :global([data-style='almanac']) .group::after { content: ''; flex: 1; height: 1px; background: var(--border-strong); }
  :global([data-style='almanac']) .foot { border-top: 1px solid var(--text); padding-top: var(--space-4); }
  :global([data-style='almanac']) .foot a { border-radius: 0; font-weight: 500; }
  :global([data-style='almanac']) .foot a:hover { background: none; color: var(--text); }
  :global([data-style='almanac']) .focusbtn { border-radius: 999px; border: 1px solid var(--text); background: transparent; color: var(--text); font-weight: 600; }
  :global([data-style='almanac']) .focusbtn:hover { background: var(--text); color: var(--bg); border-color: var(--text); box-shadow: none; }
  :global([data-style='almanac']) .focusbtn :global(svg) { color: var(--accent); }
  :global([data-style='almanac']) .searchpill { border-radius: 0; background: transparent; border: 0; border-bottom: 1px solid var(--border-strong); padding: 0 2px; }
  :global([data-style='almanac']) .searchpill:hover { border-bottom-color: var(--text); }
  :global([data-style='almanac']) kbd { border-radius: 3px; font-family: var(--font-mono); font-weight: 500; }

  :global([data-style='almanac']) .top.scrolled { background: color-mix(in srgb, var(--bg) 84%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-bottom-color: var(--text); }
  :global([data-style='almanac']) .tbtn { background: transparent; border: 1px solid var(--text); box-shadow: none; color: var(--text); -webkit-backdrop-filter: none; backdrop-filter: none; }
  :global([data-style='almanac']) .tbtn:hover { background: var(--text); color: var(--bg); border-color: var(--text); }
  :global([data-style='almanac']) .newbtn { background: var(--accent); border-color: var(--accent); color: var(--on-accent); box-shadow: none; }
  :global([data-style='almanac']) .newbtn:hover { background: var(--accent); color: var(--on-accent); border-color: var(--accent); filter: none; box-shadow: 3px 3px 0 var(--text); transform: translate(-2px, -2px); }

  :global([data-style='almanac']) .gtabs { gap: var(--space-5); border-bottom: 1px solid var(--border-strong); padding-bottom: 0; margin-bottom: var(--space-5); }
  :global([data-style='almanac']) .gtabs a { height: 42px; padding: 0 1px; border: 0; border-radius: 0; background: none; border-bottom: 2px solid transparent; margin-bottom: -1px; font-weight: 500; }
  :global([data-style='almanac']) .gtabs a.on { background: none; color: var(--text); border-bottom-color: var(--accent); }
  :global([data-style='almanac']) .gtabs a :global(svg) { display: none; }

  :global([data-style='almanac']) .bottom { left: 0; right: 0; bottom: 0; border-radius: 0; padding: 0 0 env(safe-area-inset-bottom); background: var(--bg); border: 0; border-top: 1px solid var(--text); }
  :global([data-style='almanac']) .lens { top: -1px; bottom: auto; left: 0; height: 3px; width: calc(100% / var(--slots)); border-radius: 0; background: var(--accent); box-shadow: none; }
  :global([data-style='almanac']) .bottom button { min-height: 60px; border-radius: 0; font: 500 9.5px var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
  :global([data-style='almanac']) .bottom button.active :global(svg) { color: var(--accent-ink); }

  /* ---- Nebula (liquid glass) ---------------------------------------------------- */
  :global(:root[data-style='nebula']) .sidebar { background: linear-gradient(180deg, rgba(255, 255, 255, .06), rgba(255, 255, 255, 0) 24%), var(--glass-bg-strong); }
  :global(:root[data-style='nebula']) .indicator { background: linear-gradient(90deg, rgba(183, 140, 255, .28), rgba(255, 113, 200, .12)); box-shadow: inset 0 0 0 1px rgba(214, 190, 255, .3), 0 0 22px rgba(183, 140, 255, .25); }
  :global(:root[data-style='nebula']) .brand { font-weight: 650; letter-spacing: -0.03em; }
  :global(:root[data-style='nebula']) .newbtn { background: var(--accent-grad); color: #fff; box-shadow: 0 8px 22px rgba(123, 97, 255, .4), inset 0 1px 0 rgba(255, 255, 255, .35); }
  :global(:root[data-style='nebula']) .bottom { background: linear-gradient(180deg, rgba(255, 255, 255, .08), rgba(255, 255, 255, 0) 40%), var(--glass-bg-strong); }
  :global(:root[data-style='nebula']) .lens { background: linear-gradient(90deg, rgba(183, 140, 255, .3), rgba(255, 113, 200, .16)); box-shadow: inset 0 0 0 1px rgba(214, 190, 255, .35), 0 0 24px rgba(183, 140, 255, .35); }
</style>
