<script lang="ts">
  // Native <dialog>: real modal focus trapping, Esc to close, inert background — accessible by default.
  // Bottom sheet on phones, centred card on larger screens.
  import type { Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    title: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg';
    dismissible?: boolean;
    onclose?: () => void;
    children?: Snippet;
    footer?: Snippet;
  }
  let { open = $bindable(false), title, description, size = 'md', dismissible = true, onclose, children, footer }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  const uid = `m-${Math.random().toString(36).slice(2, 8)}`;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function close() {
    open = false;
    onclose?.();
  }
  function oncancel(e: Event) {
    e.preventDefault();
    if (dismissible) close();
  }
  function onbackdrop(e: MouseEvent) {
    if (dismissible && e.target === dialog) close();
  }
</script>

<dialog bind:this={dialog} class={size} aria-labelledby="{uid}-t" aria-describedby={description ? `${uid}-d` : undefined}
  {oncancel} onclick={onbackdrop}>
  <div class="sheet">
    <header>
      <h2 id="{uid}-t">{title}</h2>
      {#if dismissible}
        <button type="button" class="x" aria-label="Close" onclick={close}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      {/if}
    </header>
    {#if description}<p class="desc" id="{uid}-d">{description}</p>{/if}
    <div class="body">{@render children?.()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</dialog>

<style>
  dialog {
    padding: 0; border: 0; background: transparent; color: var(--text); max-width: 100vw; max-height: 100dvh;
    width: 100%; margin: auto auto 0; overflow: visible;
  }
  dialog::backdrop { background: var(--scrim); backdrop-filter: blur(3px); animation: fade var(--dur) var(--ease-out); }
  .sheet {
    background: var(--surface); border: var(--card-border); box-shadow: var(--shadow-3);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0; padding: var(--space-5) var(--space-5) max(var(--space-5), env(safe-area-inset-bottom));
    max-height: 92dvh; overflow: auto; animation: up var(--dur-slow) var(--ease-out);
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
  h2 { font-size: var(--text-lg); }
  .desc { color: var(--text-2); margin-top: var(--space-2); }
  .body { margin-top: var(--space-4); }
  footer { display: flex; gap: var(--space-2); justify-content: flex-end; flex-wrap: wrap; margin-top: var(--space-6); }
  .x { width: var(--touch); height: var(--touch); display: grid; place-items: center; border: 0; background: none; color: var(--text-2); cursor: pointer; border-radius: var(--radius-sm); margin-right: calc(-1 * var(--space-2)); }
  .x:hover { background: var(--surface-2); color: var(--text); }
  .x svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }

  @media (min-width: 640px) {
    dialog { margin: auto; width: calc(100% - 48px); }
    dialog.sm { max-width: 420px; }
    dialog.md { max-width: 540px; }
    dialog.lg { max-width: 760px; }
    .sheet { border-radius: var(--radius-xl); padding: var(--space-6); animation: pop var(--dur-slow) var(--ease-out); }
  }
  @keyframes fade { from { opacity: 0; } }
  @keyframes up { from { transform: translateY(24px); opacity: 0; } }
  @keyframes pop { from { transform: translateY(8px) scale(.98); opacity: 0; } }

  /* ---- Almanac ---------------------------------------------------------------- */
  :global(:root[data-style='almanac']) dialog::backdrop { backdrop-filter: none; }
  :global(:root[data-style='almanac']) .sheet { border: 1px solid var(--text); box-shadow: none; }
  :global(:root[data-style='almanac']) header { padding-bottom: var(--space-3); border-bottom: 1px solid var(--text); }
  :global(:root[data-style='almanac']) h2 { font-size: 27px; font-weight: 360; font-style: italic; letter-spacing: -0.02em; }
  :global(:root[data-style='almanac']) .x:hover { background: none; box-shadow: inset 0 0 0 1px var(--text); border-radius: 999px; }
  @media (min-width: 640px) { :global(:root[data-style='almanac']) .sheet { box-shadow: 7px 7px 0 color-mix(in srgb, var(--text) 88%, transparent); } }

  /* ---- Nebula (liquid glass) ---------------------------------------------------- */
  :global(:root[data-style='nebula']) .sheet { background: linear-gradient(180deg, rgba(255, 255, 255, .07), rgba(255, 255, 255, 0) 30%), rgba(26, 17, 54, .86); border-color: rgba(214, 190, 255, .22); -webkit-backdrop-filter: blur(30px) saturate(1.8); backdrop-filter: blur(30px) saturate(1.8); box-shadow: var(--shadow-3), 0 0 60px rgba(183, 140, 255, .18); }
</style>
