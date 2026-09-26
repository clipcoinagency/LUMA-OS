// Vercel preview layout: "/" = Phase 0 storage test (iPhone Home-Screen test), "/app/" = the app build.
// The purchased product never depends on this deployment.
import fs from 'node:fs';
const out = '.vercel-out';
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync('poc/web', out, { recursive: true });
fs.mkdirSync(`${out}/app`, { recursive: true });
fs.copyFileSync('dist/index.html', `${out}/app/index.html`);
console.log('assembled', fs.readdirSync(out).join(', '));
