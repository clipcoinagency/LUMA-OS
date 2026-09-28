// A focused control can be destroyed (or disabled) by a re-render that doesn't necessarily land in
// the same microtask as the state change that triggers it — sometimes it's a synchronous attribute
// update whose native focus-loss-to-<body> side effect hasn't happened yet at the very next
// microtask; sometimes it's a re-render gated behind an async DB round-trip (a write bumps a
// version signal, an $effect notices, re-fetches, only then re-renders). Either way there's no
// single fixed point after which "the DOM has settled" can be safely assumed. Polling for a short
// window and redirecting the instant focus actually falls to <body> catches the loss whenever it
// really happens, rather than guessing at a delay.
export function reclaimFocusIfLost(getFallback: () => HTMLElement | null | undefined, framesLeft = 40) {
  requestAnimationFrame(() => {
    if (document.activeElement === document.body) {
      getFallback()?.focus();
    } else if (framesLeft > 0) {
      reclaimFocusIfLost(getFallback, framesLeft - 1);
    }
  });
}
