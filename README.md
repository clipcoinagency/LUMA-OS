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
| 4 · The seven modules | ✅ done |
| 5 · Calendar / history view | ✅ done |
| 6 · Backup/restore | ✅ done (export/restore/reset since Phase 1/2, first-run "I have a backup"; a dismissible "back up now" reminder banner added this phase) |
| 7 · Polish, animation, responsive | ✅ done (reduced-motion audit across all JS-driven transitions; accessibility fixes — MonthGrid screen-reader content, focus management in Notes/Tasks/MonthNav/Wellness day-nav, radiogroup arrow-key nav, SearchField label, workout double-submit guard, touch targets; 360px overflow sweep) |
| 8 · Platform packaging (real app → Windows/macOS/Android) | 🟨 builds validated in CI · real-device tests pending — `packaging/` wraps the real `dist/index.html` (Android debug APK 3.95 MB, Windows NSIS 3.02 MB, macOS universal DMG 3.74 MB); desktop app not shipped until code-signed/notarized |
| 9 · Vercel demo | ✅ live at the root URL, informal — no dedicated marketing/demo flow |
| 10 · Full QA / customer-package testing | 🟨 automated QA as far as it goes without hardware — full e2e suite now runs cross-OS in CI (Windows + macOS runners, real Edge/Chrome) via `app-e2e.yml`; real-device tests (phones, tablets, actual installers on a human's machine) genuinely need a person with the hardware, see [`docs/DEVICE-TEST-PLAN.md`](docs/DEVICE-TEST-PLAN.md) |

- 📄 Architecture & decisions: [`docs/PHASE-0-ARCHITECTURE.md`](docs/PHASE-0-ARCHITECTURE.md)
- ✅ Validation evidence: [`docs/validation/`](docs/validation/)
- 📱 Live demo / iPhone-iPad Home-Screen install: https://luma-os-beta.vercel.app (the Phase 0 storage prototype that used to live here moved to `/poc-storage-test/`)

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
