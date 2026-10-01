// A soft light that follows the pointer across a card (sets --sx / --sy, which the card's
// ::after paints). Mouse/pen only, rAF-throttled, off under reduced motion.
import { reducedMotion } from '../motion';

export function spotlight(node: HTMLElement) {
  let raf = 0;
  let x = 0, y = 0;
  const move = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || reducedMotion()) return;
    const r = node.getBoundingClientRect();
    x = e.clientX - r.left; y = e.clientY - r.top;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; node.style.setProperty('--sx', `${x}px`); node.style.setProperty('--sy', `${y}px`); });
  };
  node.addEventListener('pointermove', move, { passive: true });
  return { destroy() { node.removeEventListener('pointermove', move); if (raf) cancelAnimationFrame(raf); } };
}
