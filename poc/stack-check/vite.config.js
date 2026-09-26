import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html: every script/style/asset inlined, so it runs from file://.
export default defineConfig({
  plugins: [svelte(), viteSingleFile({ removeViteModuleLoader: true })],
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false },
});
