<script lang="ts">
  // Almanac only: the typewriter line above a page title — its section and its page number, the same
  // numbers the contents column shows. Hidden in the Aurora themes (see .kick in almanac.css).
  import { app } from '../../lib/app.svelte';
  import { navGroups, tocNumbers } from '../../lib/nav';

  let { id }: { id: string } = $props();
  const entry = $derived(app.workspace ? tocNumbers(navGroups(app.workspace, true))[id] : undefined);
</script>

{#if entry}<p class="kick kicker" aria-hidden="true"><b>§</b> {entry.group} <span class="dot">·</span> No. {entry.no}</p>{/if}
