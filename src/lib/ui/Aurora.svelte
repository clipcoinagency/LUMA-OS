<script lang="ts">
  // The living background: three soft light fields drifting very slowly, a hint of pointer parallax on
  // desktop, a film-grain layer so gradients never band, and a time-of-day hue shift (atmosphere.ts).
  // Transform/opacity only (compositor-friendly). Static when motion is reduced.
  import { onMount } from 'svelte';
  import { applyAtmosphere } from '../atmosphere';
  import { reducedMotion } from '../motion';

  let host: HTMLDivElement | undefined = $state();

  onMount(() => {
    applyAtmosphere();
    const tick = setInterval(() => applyAtmosphere(), 5 * 60_000);
    let raf = 0;
    let px = 0, py = 0;
    const move = (e: PointerEvent) => {
      if (reducedMotion() || e.pointerType === 'touch') return;
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        host?.style.setProperty('--px', px.toFixed(3));
        host?.style.setProperty('--py', py.toFixed(3));
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { clearInterval(tick); window.removeEventListener('pointermove', move); if (raf) cancelAnimationFrame(raf); };
  });
</script>

<div class="aurora" bind:this={host} aria-hidden="true">
  <i class="b b1"></i><i class="b b2"></i><i class="b b3"></i>
  <i class="grain"></i>
</div>

<style>
  .aurora {
    --px: 0; --py: 0;
    position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none;
    filter: hue-rotate(var(--tod-hue)); opacity: var(--tod-strength);
    transition: filter 6s linear, opacity 6s linear;
  }
  .b { position: absolute; display: block; border-radius: 50%; will-change: transform; }
  .b1 {
    width: 78vmax; height: 78vmax; top: -34vmax; right: -26vmax;
    background: radial-gradient(closest-side, var(--aurora-1), transparent 100%);
    translate: calc(var(--px) * -26px) calc(var(--py) * -18px);
    animation: a1 90s var(--ease-in-out) infinite alternate;
  }
  .b2 {
    width: 70vmax; height: 70vmax; bottom: -36vmax; left: -24vmax;
    background: radial-gradient(closest-side, var(--aurora-2), transparent 100%);
    translate: calc(var(--px) * 30px) calc(var(--py) * 22px);
    animation: a2 110s var(--ease-in-out) infinite alternate;
  }
  .b3 {
    width: 54vmax; height: 54vmax; top: 22vh; left: 34vw;
    background: radial-gradient(closest-side, var(--aurora-3), transparent 100%);
    translate: calc(var(--px) * -16px) calc(var(--py) * 28px);
    animation: a3 130s var(--ease-in-out) infinite alternate;
  }
  @keyframes a1 { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-9vw, 8vh, 0) scale(1.14); } }
  @keyframes a2 { from { transform: translate3d(0, 0, 0) scale(1.08); } to { transform: translate3d(10vw, -9vh, 0) scale(.94); } }
  @keyframes a3 { from { transform: translate3d(-6vw, 0, 0) scale(.92); } to { transform: translate3d(8vw, -6vh, 0) scale(1.12); } }
  .grain {
    position: absolute; inset: 0; opacity: .05; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  :global([data-theme='dark']) .grain { opacity: .07; }
</style>
