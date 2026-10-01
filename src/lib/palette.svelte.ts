// Global open/close state for the command palette (Ctrl/Cmd+K, or the search pill in the shell).
class Palette {
  open = $state(false);
  show() { this.open = true; }
  hide() { this.open = false; }
  toggle() { this.open = !this.open; }
}
export const palette = new Palette();
