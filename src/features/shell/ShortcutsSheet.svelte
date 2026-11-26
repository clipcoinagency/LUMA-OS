<script lang="ts">
  // The keyboard-shortcut cheat sheet for the new looks. Press ? anywhere to open it.
  import Modal from '../../lib/ui/Modal.svelte';
  import { GO_KEYS, SINGLE_KEYS, shortcuts } from '../../lib/shortcuts.svelte';
  import { app } from '../../lib/app.svelte';
  import { navGroups } from '../../lib/nav';

  // only list pages that exist in this workspace
  const have = $derived.by(() => {
    const ids = new Set<string>(['home']);
    if (app.workspace) for (const g of navGroups(app.workspace, true)) for (const it of g.items) ids.add(it.id);
    return ids;
  });
  const go = $derived(GO_KEYS.filter((g) => have.has(g.id)));
  const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
</script>

<Modal bind:open={shortcuts.open} title="Keyboard shortcuts" size="md" description="Press ? any time to open this list. Shortcuts pause while you are typing.">
  <div class="sc">
    <section aria-label="Do something">
      <h3 class="kicker">Do something</h3>
      <dl>
        <div><dt><kbd>{mod}</kbd><kbd>K</kbd></dt><dd>Search and jump anywhere</dd></div>
        {#each SINGLE_KEYS as s (s.keys)}<div><dt><kbd>{s.keys}</kbd></dt><dd>{s.label}</dd></div>{/each}
      </dl>
    </section>
    <section aria-label="Go to a page">
      <h3 class="kicker">Go to a page — press <kbd>g</kbd>, then</h3>
      <dl>
        {#each go as g (g.key)}<div><dt><kbd>g</kbd><kbd>{g.key}</kbd></dt><dd>{g.label}</dd></div>{/each}
      </dl>
    </section>
  </div>
</Modal>

<style>
  .sc { display: grid; gap: var(--space-5); grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
  h3 { margin-bottom: var(--space-2); font-size: var(--text-xs); }
  dl { margin: 0; display: grid; }
  dl > div { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: 7px 0; border-top: 1px solid var(--border); }
  dl > div:first-child { border-top: 0; }
  dd { margin: 0; font-size: var(--text-sm); color: var(--text-2); text-align: right; }
  dt { display: flex; gap: 4px; flex: none; }
  kbd { min-width: 24px; padding: 3px 7px; text-align: center; border-radius: 6px; font: 600 12px var(--font-body); color: var(--text); background: var(--surface-2); border: 1px solid var(--border-strong); box-shadow: 0 1px 0 var(--border-strong); }
  :global(:root[data-style='almanac']) kbd { border-radius: 3px; font-family: var(--font-mono); font-weight: 500; background: transparent; border-color: var(--text); box-shadow: 1px 1px 0 var(--text); }
</style>
