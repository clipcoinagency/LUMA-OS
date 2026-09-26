<script lang="ts">
  interface Props { width?: string; height?: string; radius?: string; lines?: number }
  let { width = '100%', height = '14px', radius = 'var(--radius-xs)', lines = 1 }: Props = $props();
</script>

<div class="stack" aria-hidden="true">
  {#each Array(lines) as _, i (i)}
    <span class="sk" style="width:{i === lines - 1 && lines > 1 ? '60%' : width};height:{height};border-radius:{radius}"></span>
  {/each}
</div>

<style>
  .stack { display: grid; gap: 8px; }
  .sk {
    display: block; background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 50%, var(--surface-2) 100%);
    background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite;
  }
  @keyframes shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
</style>
