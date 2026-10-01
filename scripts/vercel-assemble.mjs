// Vercel preview layout: "/" = the real app (what a demo link/Home-Screen install should show),
// "/poc-storage-test/" = the Phase 0 storage prototype, kept reachable for reference only.
// The purchased product never depends on this deployment.
//
// Until Phase 8, "/" served the Phase 0 PoC and the real app only lived at "/app/" — that's the
// wrong way around for a demo link people actually click, so this was swapped once the real app
// existed to show. "/app/" is kept too (redirects to "/") so any previously-shared link still works.
import fs from 'node:fs';
const out = '.vercel-out';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync('dist/index.html', `${out}/index.html`);
// PWA: manifest, service worker and icons sit beside index.html (the hosted build registers them; the
// single-file builds never do — see src/lib/pwa.svelte.ts)
for (const f of fs.readdirSync('packaging/pwa')) fs.copyFileSync(`packaging/pwa/${f}`, `${out}/${f}`);
fs.cpSync('poc/web', `${out}/poc-storage-test`, { recursive: true });
console.log('assembled', fs.readdirSync(out).join(', '));
