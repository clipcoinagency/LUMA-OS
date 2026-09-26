// Bundled fonts (Latin subset, variable weight). Vite inlines them as data URIs so the single-file
// build needs no network. All three are SIL Open Font License.
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import fraunces from '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url';
import grotesk from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url';

const faces = [
  ['Inter Variable', inter, '100 900'],
  ['Fraunces Variable', fraunces, '100 900'],
  ['Space Grotesk Variable', grotesk, '300 700'],
] as const;

export function installFonts() {
  const css = faces
    .map(([family, src, weight]) => `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};src:url(${src}) format('woff2-variations'),url(${src}) format('woff2');}`)
    .join('');
  const style = document.createElement('style');
  style.dataset.fonts = 'lifeos';
  style.textContent = css;
  document.head.appendChild(style);
}
