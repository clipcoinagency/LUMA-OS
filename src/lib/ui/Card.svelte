<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    as?: 'section' | 'article' | 'div';
    padded?: boolean;
    interactive?: boolean;
    actions?: Snippet;
    children?: Snippet;
    class?: string;
  }
  let { title, subtitle, as = 'section', padded = true, interactive = false, actions, children, class: klass = '' }: Props = $props();
  const headingId = `card-${Math.random().toString(36).slice(2, 8)}`;
</script>

<svelte:element this={as} class="card {klass}" class:padded class:interactive aria-labelledby={title ? headingId : undefined}>
  {#if title || actions}
    <header>
      <div class="titles">
        {#if title}<h2 id={headingId} class="title">{title}</h2>{/if}
        {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      </div>
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </header>
  {/if}
  {@render children?.()}
</svelte:element>

<style>
  .card {
    background: var(--surface); border: var(--card-border); border-radius: var(--radius-xl);
    box-shadow: var(--solid-highlight), var(--shadow-1); min-width: 0;
    transition: box-shadow var(--dur) var(--ease-out), transform var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out);
  }
  .padded { padding: var(--space-5); }
  .interactive:hover { box-shadow: var(--shadow-2); border-color: var(--border-strong); transform: translateY(-1px); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
  .card:not(.padded) > header { padding: var(--space-5) var(--space-5) 0; }
  .titles { min-width: 0; }
  .title { font-size: var(--text-md); }
  .sub { color: var(--text-2); font-size: var(--text-sm); margin-top: 2px; }
  .actions { display: flex; gap: var(--space-1); flex: none; }
</style>
