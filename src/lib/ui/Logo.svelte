<script lang="ts">
  // The Life OS mark: six luminous nodes in a hexagon around a core — "everything connected".
  // Inline SVG so it stays crisp at any size and needs no extra file in the single-file build.
  interface Props { size?: number; bare?: boolean; label?: string }
  let { size = 32, bare = false, label }: Props = $props();
  const u = `lg-${Math.random().toString(36).slice(2, 8)}`;
  const nodes = [[406, 256], [331, 386], [181, 386], [106, 256], [181, 126], [331, 126]] as const;
</script>

<svg width={size} height={size} viewBox="0 0 512 512" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} class="logo">
  <defs>
    <radialGradient id="{u}-bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#14204a" /><stop offset="1" stop-color="#04060f" /></radialGradient>
    <radialGradient id="{u}-s" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#f1fbff" /><stop offset=".22" stop-color="#8fdcff" /><stop offset=".58" stop-color="#4a6dff" /><stop offset="1" stop-color="#2a1b9c" /></radialGradient>
    <linearGradient id="{u}-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fd6ff" /><stop offset="1" stop-color="#9a7bff" /></linearGradient>
    <filter id="{u}-g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14" /></filter>
  </defs>
  {#if !bare}<rect width="512" height="512" rx="116" fill="url(#{u}-bg)" /><rect x="1.5" y="1.5" width="509" height="509" rx="114.5" fill="none" stroke="#8fa6ff" stroke-opacity=".22" stroke-width="3" />{/if}
  <g stroke="url(#{u}-l)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <polygon points={nodes.map((n) => n.join(',')).join(' ')} stroke-width="7" stroke-opacity=".75" />
    <circle cx="256" cy="256" r="92" stroke-width="6" stroke-opacity=".6" />
    {#each nodes as n, i (i)}<line x1="256" y1="256" x2={n[0]} y2={n[1]} stroke-width="4" stroke-opacity=".45" />{/each}
  </g>
  <g filter="url(#{u}-g)" opacity=".85" fill="#5b7bff">
    <circle cx="256" cy="256" r="60" />
    {#each nodes as n, i (i)}<circle cx={n[0]} cy={n[1]} r="30" />{/each}
  </g>
  {#each nodes as n, i (i)}
    <circle cx={n[0]} cy={n[1]} r="29" fill="url(#{u}-s)" /><circle cx={n[0] - 8} cy={n[1] - 9} r="7" fill="#fff" opacity=".7" />
  {/each}
  <circle cx="256" cy="256" r="58" fill="url(#{u}-s)" /><circle cx="238" cy="236" r="15" fill="#fff" opacity=".65" />
</svg>

<style>
  .logo { display: block; flex: none; }
</style>
