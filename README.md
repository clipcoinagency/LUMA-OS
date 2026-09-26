# Life OS

Local-first personal productivity app (Tasks · Goals · Habits · Calendar · Notes · Fitness/Wellness · Finance),
sold as a downloadable digital product. One shared web core, packaged per platform. No accounts, no backend,
no tracking — **your data stays on your device**.

## Status

| Phase | State |
|---|---|
| 0 · Architecture & platform feasibility | ✅ Windows/engines validated · device tests pending ([plan](docs/DEVICE-TEST-PLAN.md)) |
| 1 · Foundation, design system, data layer | ✅ done |
| 2 · Onboarding & workspace customisation | ✅ done |
| 3 · Dashboard (live widgets) | ✅ done |
| 4 · The seven modules | next |

- 📄 Architecture & decisions: [`docs/PHASE-0-ARCHITECTURE.md`](docs/PHASE-0-ARCHITECTURE.md)
- ✅ Validation evidence: [`docs/validation/`](docs/validation/)
- 📱 Hosted storage test (iPhone/iPad Home-Screen test): https://luma-os-beta.vercel.app

## Develop

```bash
npm ci
npm run dev        # live dev server
npm run check      # type-check
npm test           # unit tests (data layer, backup, dates, money)
npm run build      # → dist/index.html, ONE self-contained file (fails if anything external sneaks in)
npm run test:e2e   # opens dist/index.html from file:// in Edge + Chrome and drives the real UI
```

## Structure

```
src/lib/db        schema v1, IndexedDB layer + migrations, defaults, sample data
src/lib/backup    backup format, validation, safety snapshots, atomic restore, resets
src/lib/platform  the only per-platform code (save/pick files on browser, iOS, Tauri, Android)
src/lib/ui        design-system components
src/styles        tokens (Soft + Dark themes), base styles, bundled fonts
poc/              Phase 0 proofs of concept (storage PoC, Capacitor + Tauri shells, validators)
```
