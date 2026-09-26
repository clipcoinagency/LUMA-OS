# Life OS

Local-first personal productivity app (Tasks · Goals · Habits · Calendar · Notes · Fitness/Wellness · Finance),
sold as a downloadable digital product. One shared web core, packaged per platform. No accounts, no backend,
no tracking — **your data stays on your device**.

## Status: Phase 0 — architecture & platform feasibility

The full UI is intentionally **not** built yet. This phase validates storage, launch, offline and
backup/restore behaviour on each target platform before committing to an architecture.

- 📄 Architecture decision & platform plan: [`docs/PHASE-0-ARCHITECTURE.md`](docs/PHASE-0-ARCHITECTURE.md)
- ✅ Validation evidence: [`docs/validation/`](docs/validation/)
- 🧪 Proof of concept (single self-contained HTML file): [`poc/web/index.html`](poc/web/index.html)

## Run the PoC validation locally (developer machine)

```bash
npm ci
npm run poc:validate -- --only=edge,chrome,edge-app,tz
```

Manual test on any device: open `poc/web/index.html` (or the hosted copy), tap **Write test value**,
fully close the app/browser, reopen — the banner must say the value survived.
