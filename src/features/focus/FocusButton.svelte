<script lang="ts">
  // A small "focus on this" play button for any task row.
  import { Play } from '../../lib/navicons';
  import { focus } from '../../lib/focus.svelte';
  import type { Task } from '../../lib/db/schema';

  let { task }: { task: Pick<Task, 'id' | 'title' | 'projectId'> } = $props();
</script>

<button type="button" class="fb" onclick={(e) => { e.stopPropagation(); focus.openFor({ id: task.id, title: task.title, projectId: task.projectId }); }} aria-label="Focus on: {task.title}" title="Focus on this">
  <Play size={14} aria-hidden="true" />
</button>

<style>
  .fb {
    width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 50%; cursor: pointer; border: 1px solid transparent;
    background: color-mix(in srgb, var(--mod-focus) 13%, transparent); color: var(--mod-focus); opacity: .65;
    transition: opacity var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out), background-color var(--dur) var(--ease-out);
  }
  .fb:hover { opacity: 1; background: color-mix(in srgb, var(--mod-focus) 22%, transparent); }
  .fb:active { transform: scale(.9); }
  .fb :global(svg) { margin-left: 1px; fill: currentColor; }
  @media (hover: hover) { :global(li:not(:hover):not(:focus-within)) > .fb { opacity: .35; } }
</style>
