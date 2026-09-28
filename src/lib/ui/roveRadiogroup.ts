// Arrow-key navigation for a `role="radiogroup"` container, matching Segmented.svelte's pattern.
// Works generically over any group of `[role="radio"]` children: moving focus with the arrow keys
// also clicks the newly-focused radio, so each component's own onclick handler (which may have
// component-specific semantics, e.g. WellnessPage's toggle-to-clear mood picker) stays the single
// source of truth for what "selecting" actually does. Pair with a per-button
// `tabindex={checked ? 0 : -1}` (first item as fallback when nothing is checked yet) so the group
// is one tab stop, per the ARIA APG radiogroup pattern.
export function roveRadiogroup(node: HTMLElement) {
  function onkeydown(e: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const radios = Array.from(node.querySelectorAll<HTMLElement>('[role="radio"]'));
    if (!radios.length) return;
    const active = document.activeElement as HTMLElement | null;
    let i = active ? radios.indexOf(active) : -1;
    if (i === -1) i = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
    if (i === -1) i = 0;
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = radios[(i + dir + radios.length) % radios.length];
    next?.focus();
    next?.click();
  }
  node.addEventListener('keydown', onkeydown);
  return { destroy() { node.removeEventListener('keydown', onkeydown); } };
}
