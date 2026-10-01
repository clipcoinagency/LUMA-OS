<script lang="ts">
  // A generated book cover: colour gradient, spine shading and the title set in the display face.
  // No images are fetched — it works offline and every book looks intentional.
  import { BookOpen, FileText, GraduationCap, Newspaper } from '@lucide/svelte';
  import type { BookKind } from '../../../lib/db/schema';

  interface Props { title: string; color: string; kind?: BookKind; size?: 'sm' | 'md' | 'lg'; done?: boolean }
  let { title, color, kind = 'book', size = 'md', done = false }: Props = $props();
  const Icon = $derived(kind === 'article' ? Newspaper : kind === 'paper' ? FileText : kind === 'course' ? GraduationCap : BookOpen);
</script>

<div class="cover {size}" style="--c:{color}" role="img" aria-label="Cover of {title}">
  <span class="spine" aria-hidden="true"></span>
  <span class="t">{title}</span>
  <span class="k" aria-hidden="true"><Icon size={size === 'lg' ? 18 : 14} /></span>
  {#if done}<span class="done" aria-hidden="true">✓</span>{/if}
</div>

<style>
  .cover {
    position: relative; aspect-ratio: 3 / 4; width: 100%; border-radius: 6px 12px 12px 6px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;
    padding: 12% 12% 10% 18%; color: #fff; isolation: isolate;
    background:
      radial-gradient(120% 80% at 90% 0%, color-mix(in srgb, #fff 26%, transparent), transparent 55%),
      linear-gradient(155deg, color-mix(in srgb, var(--c) 88%, #fff), var(--c) 55%, color-mix(in srgb, var(--c) 62%, #000));
    box-shadow: 0 1px 0 rgba(255, 255, 255, .25) inset, 0 8px 22px color-mix(in srgb, var(--c) 38%, transparent), 0 2px 5px rgba(0, 0, 0, .22);
  }
  .cover::after { content: ''; position: absolute; inset: 0; z-index: -1; background: repeating-linear-gradient(115deg, rgba(255, 255, 255, .05) 0 2px, transparent 2px 9px); }
  .spine { position: absolute; left: 0; top: 0; bottom: 0; width: 9%; background: linear-gradient(90deg, rgba(0, 0, 0, .28), rgba(255, 255, 255, .12) 60%, transparent); }
  .t { font-family: var(--font-display); font-weight: 700; line-height: 1.08; letter-spacing: -0.01em; text-wrap: balance; display: -webkit-box; -webkit-line-clamp: 5; line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; text-shadow: 0 1px 6px rgba(0, 0, 0, .25); }
  .k { opacity: .85; align-self: flex-start; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(255, 255, 255, .18); backdrop-filter: blur(4px); }
  .done { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: #fff; color: color-mix(in srgb, var(--c) 80%, #000); }
  .sm .t { font-size: .72rem; } .md .t { font-size: 1.02rem; } .lg .t { font-size: 1.5rem; }
  .sm .k { width: 20px; height: 20px; }
  .sm { border-radius: 4px 8px 8px 4px; }
</style>
