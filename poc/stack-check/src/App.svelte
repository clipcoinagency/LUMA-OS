<script>
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { bumpLaunches } from './db.js';

  let launches = $state(null);
  let error = $state(null);
  let items = $state(['Tasks', 'Goals', 'Habits']);
  let progress = $derived(launches ? Math.min(100, launches * 25) : 0);

  bumpLaunches().then((n) => { launches = n; window.stackCheck = { launches: n, ok: true }; })
    .catch((e) => { error = e?.name ?? 'Error'; window.stackCheck = { ok: false, error }; });

  function rotate() { items = [...items.slice(1), items[0]]; }
</script>

<main>
  <h1>Stack check</h1>
  {#if error}
    <p class="bad" role="alert">Storage unavailable ({error})</p>
  {:else if launches}
    <p in:fade id="launches">Launch #{launches}</p>
    <div class="bar" aria-label="progress" style="--p:{progress}%"></div>
  {/if}
  <button id="rotate" onclick={rotate}>Reorder modules</button>
  <ul>
    {#each items as item (item)}
      <li animate:flip={{ duration: 200 }} in:fly={{ y: 8 }}>{item}</li>
    {/each}
  </ul>
</main>

<style>
  main { font: 16px/1.5 system-ui, sans-serif; max-width: 420px; margin: 40px auto; }
  .bar { height: 8px; border-radius: 99px; background: linear-gradient(90deg, #4fd6f0 var(--p), #ddd var(--p)); transition: background .3s; }
  .bad { color: #b3413b; }
  li { padding: 4px 0; }
</style>
