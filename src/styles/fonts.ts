// Bundled fonts (Latin subset, variable weight). Vite inlines them as data URIs so the single-file
// build needs no network. All are SIL Open Font License.
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import fraunces from '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url';
import grotesk from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url';
// Almanac (Paper / Night Ink) only: Fraunces with its optical-size axis + italic, and a typewriter mono.
import almanacSerif from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url';
import almanacSerifItalic from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2?url';
import almanacMono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
// Nebula only: a geometric display face.
import nebulaSans from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2?url';

const faces = [
  ['Inter Variable', inter, '100 900', 'normal'],
  ['Fraunces Variable', fraunces, '100 900', 'normal'],
  ['Space Grotesk Variable', grotesk, '300 700', 'normal'],
  ['Fraunces Almanac', almanacSerif, '100 900', 'normal'],
  ['Fraunces Almanac', almanacSerifItalic, '100 900', 'italic'],
  ['Almanac Mono', almanacMono, '100 800', 'normal'],
  ['Nebula Sans', nebulaSans, '100 800', 'normal'],
] as const;

export function installFonts() {
  const css = faces
    .map(([family, src, weight, style]) => `@font-face{font-family:'${family}';font-style:${style};font-display:swap;font-weight:${weight};src:url(${src}) format('woff2-variations'),url(${src}) format('woff2');}`)
    .join('');
  const style = document.createElement('style');
  style.dataset.fonts = 'lifeos';
  style.textContent = css;
  document.head.appendChild(style);
}
