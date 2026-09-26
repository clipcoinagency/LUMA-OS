# Life OS V1 — Phase 0: Architecture & Platform Feasibility

Status: **Phase 0 complete on Windows; macOS / iPhone / Android need the real-device tests in
[DEVICE-TEST-PLAN.md](DEVICE-TEST-PLAN.md) before their packaging is final.**
Date: 2026-09-26 · Repo: `clipcoinagency/LUMA-OS`

Legend: ✅ validated here with evidence · 🟨 build validated / engine validated, real device pending ·
⬜ not yet validated (no claim made)

---

## 1. Decisions at a glance

| Area | Decision | Status |
|---|---|---|
| Shared core | One web app, built to **one self-contained `index.html`** (all JS/CSS/fonts/icons inlined, classic scripts only) | ✅ file:// rules verified |
| Framework | **Svelte 5 + TypeScript + Vite + vite-plugin-singlefile** (Phase 1) | decision |
| Storage | **IndexedDB**, own thin wrapper, versioned migrations, strict durability | ✅ Edge + Chrome |
| Dates | Local calendar keys `YYYY-MM-DD`; never `toISOString()` for days | ✅ 3 time zones + DST |
| Money | Integer minor units (cents) + ISO currency code | decision |
| Backup | Versioned JSON with format marker, schema version, counts, checksum; validate → preview → confirm → **atomic** restore | ✅ |
| Offline | Zero network calls in purchased builds; service worker only for the hosted build | ✅ |
| Windows | **Browser Edition** (`Life OS.html`, opens in Edge by default) = primary. Tauri desktop app (builds: 2.75 MB) only once code-signed | ✅ / 🟨 |
| macOS | Browser Edition; Tauri universal `.dmg` (builds: 3.43 MB) only once notarized | 🟨 |
| Android | **Capacitor APK** wrapping the same `index.html` | 🟨 APK builds (3.8 MB) |
| iPhone/iPad | **Home-Screen web app** installed once from an https URL, then fully offline | ⬜ needs iPhone test |
| Etsy | 5 files ≤ 20 MB each: START HERE PDF + Windows + Mac + Android + Any-device zips | decision |

---

## 2. Environment inspected

- Windows 11 Home (build 26200), **Smart App Control = ON**, Edge 153 (default `.html` handler), Chrome 154,
  WebView2 154, Node 24, Java 26, git. No Rust, no Android SDK, no Mac, no iPhone on this machine.
- Project folder is inside OneDrive and its path contains spaces — a realistic "customer" path.
- GitHub repo was empty and public; connected as `origin`, `main` branch.
- Platform builds that can't run here (Android, macOS, Tauri) run in **GitHub Actions** from the same repo.

---

## 3. Evidence — what was actually tested

### 3.1 Local, real browsers (Windows 11) — `docs/validation/local-windows11-edge-chrome.md`

Driven with Playwright against the **installed** Edge and Chrome, using persistent profiles so each
"launch" is a real browser process start and each "close" a full shutdown. 57/57 checks pass.

| Check | Edge file:// | Edge http | Chrome file:// | Chrome http |
|---|---|---|---|---|
| Value survives full browser restart | ✅ | ✅ | ✅ | ✅ |
| 1,000 records survive restart + refresh | ✅ | ✅ | ✅ | ✅ |
| Export → real download `LifeOS-PoC-Backup-YYYY-MM-DD.json` | ✅ | ✅ | ✅ | ✅ |
| Clear (cancel keeps data / confirm deletes) | ✅ | ✅ | ✅ | ✅ |
| Restore via file picker, warns first, atomic | ✅ | ✅ | ✅ | ✅ |
| Rejects empty / non-JSON / wrong file / newer version / edited / truncated | ✅ | ✅ | ✅ | ✅ |
| 21,000 records survive another restart | ✅ | ✅ | ✅ | ✅ |
| Month query on 21k records | 63 ms | 54 ms | ✅ | ✅ |
| Offline reload (service worker, hosted mode) | n/a | ✅ | n/a | ✅ |
| Edge **app window** (`msedge --app=file://…`) survives close/reopen | ✅ | | | |

Other measured facts:

- **file:// script rules (Edge & Chrome):** inline scripts ✅, external classic `<script src>` ✅,
  inline module ✅, **external `type="module"` ❌ blocked**, **`fetch()` of sibling files ❌ blocked**.
  → the build must inline everything; the app must never `fetch()` its own files.
- **Folder move/copy:** in Chromium, all `file://` pages share one storage origin, so a copy of the app
  in another folder sees the same data. Good for updates (new version in a new folder keeps data);
  it also means data is tied to the *browser profile*, not the folder.
- `navigator.storage.persist()` returns **false** on file:// and on localhost in Edge/Chrome → storage
  is "best effort". It is not evicted under normal conditions, but "Clear browsing data → cookies and
  site data" deletes it. Backups are therefore a product feature, not an afterthought.
- **Write throughput:** 1,000 records in 0.11–0.16 s, but cost grows super-linearly with batch/DB
  size: 20,000 records take 7–13 s (a micro-benchmark shows relaxed durability and no indexes only
  help ~40%, so it is engine-bound). Daily use writes 1 record at a time (ms). Only restore of very
  large backups is affected → restore UI gets a progress bar and writes in chunks.
- Cold open with 21,000 records: ~1.0–1.4 s including browser start.
- Time zones: day keys correct at 11:30 pm Los Angeles, 1:30 am Auckland, 12:15 am India, and
  day arithmetic correct across DST changes (where naive `toISOString()` would be off by a day).

### 3.2 Smart App Control finding (important)

Playwright's own Firefox/WebKit builds **could not start on this PC**: Windows Smart App Control
blocked them (`An Application Control policy has blocked this file`, CodeIntegrity event 3033/3118)
because they are unsigned. Smart App Control is on by default on new Windows 11 installs and has no
"Run anyway" button.

➡ **Any unsigned `.exe` we ship (Tauri, Electron, a launcher) would be hard-blocked for a share of
Windows buyers.** An `.html` file is not an executable and is unaffected. This is the main reason the
Windows primary is the Browser Edition, and a desktop app is only shipped once it is code-signed.

### 3.3 CI (GitHub Actions) — see §8 for results

- Firefox + WebKit engines on Windows and macOS runners, real **Safari** on macOS via `safaridriver`.
- Android debug APK built with Capacitor 8 from the same `poc/web` → **success, 3.8 MB zipped**.
- Tauri 2 desktop build → **success**: Windows NSIS installer + exe 2.75 MB zipped, macOS universal DMG 3.43 MB zipped.

---

## 4. Core architecture

### 4.1 One shared web app

```
src/ (Svelte + TS)  ──vite + singlefile──►  dist/index.html  (one file, ~0.5–1 MB, no external refs)
                                               │
        ┌──────────────────────┬───────────────┼────────────────────┬─────────────────────┐
  Browser Edition        Windows/mac app     Android APK         iPhone/iPad          Vercel demo
  (open the file)        (Tauri, signed)     (Capacitor)         (Home-Screen app)    (same file + SW,
                                                                                      demo data)
```

A tiny **platform adapter** is the only per-platform code:

| Capability | Browser / file:// | Tauri | Capacitor (Android) | iOS Home-Screen |
|---|---|---|---|---|
| Save backup | `<a download>` → Downloads | native Save dialog + fs | Filesystem → **share sheet** (WebView ignores downloads) | `navigator.share` → Save to Files |
| Open backup | `<input type=file>` | same | same | same |
| Storage | IndexedDB | IndexedDB (WebView2/WKWebView app data) | IndexedDB (app data) | IndexedDB (home-screen app container) |

### 4.2 Why Svelte 5 (vs alternatives)

- Compiles away → small single file, fast on low-end phones; no virtual DOM re-render tuning.
- Built-in `transition:` / `animate:flip` / `tweened` cover every motion in the brief without a
  motion library; honours `prefers-reduced-motion` easily.
- Compiler a11y warnings help keep the accessibility bar.
- Vanilla JS would mean hand-building reactivity for 7 modules; React/Preact would need extra
  libraries for motion and more care with re-renders. Svelte is the smallest reliable path.

### 4.3 Data layer (prototype = `poc/web/index.html`)

- IndexedDB database `lifeos`, **schema version** separate from **app version**.
- Migrations: ordered `{ n: (db, tx) => … }` steps run inside `onupgradeneeded`; never destructive;
  a pre-migration backup is written to a `safety` store before any migration that rewrites data.
- Writes use `durability: 'strict'` so a value is on disk before the UI confirms.
- `versionchange` handling: close and ask to reload if a newer version opens in another window.
- Stores planned for v1 (Phase 1 finalises fields):
  `meta` (app metadata, device diagnostics) · `settings` (name, theme, currency, prefs) ·
  `workspace` (enabled modules, order, dashboard layout, widgets) · `tasks` · `goals` ·
  `goal_progress` (dated check-ins → history) · `habits` · `habit_logs` (one row per habit per day) ·
  `events` · `notes` · `wellness` (one row per day: water, sleep, mood, steps, weight) · `workouts` ·
  `transactions` · `finance_categories` · `safety` (pre-restore / pre-migration snapshots).
- **History by design:** nothing "current-day" is overwritten. Every historical fact is its own dated
  row (habit log, goal check-in, wellness day, transaction, task `completedOn`). The Calendar/History
  view for any date = one indexed `by_date` query per store. Verified fast (63 ms for a month on 21k rows).
- IDs: `crypto.randomUUID()` with a fallback. Timestamps (`createdAt`/`updatedAt`) in ISO UTC;
  **calendar days** as local `YYYY-MM-DD` keys; money as integer minor units + currency code.

### 4.4 Backup / restore format

```jsonc
{
  "format": "lifeos-backup", "formatVersion": 1,
  "app": "Life OS", "appVersion": "1.0.0", "schemaVersion": 1,
  "exportedAt": "2026-09-26T16:32:10.000Z", "exportedLocalDate": "2026-09-26",
  "counts": { "tasks": 120, … },
  "checksum": "fnv1a32:9b1c…",           // detects truncation/corruption/edits
  "data": { "settings": [...], "workspace": [...], "tasks": [...], … }
}
```

Restore pipeline (all proven in the PoC): size check → JSON parse → format marker → schema version
(newer = refuse with "update Life OS"; older = migrate) → section/record validation → checksum →
**preview dialog with counts and "this replaces N items" warning** → safety snapshot → single atomic
transaction (any failure leaves old data untouched) → confirmation. Device-only diagnostics are
excluded from backups. File name: `LifeOS-Backup-YYYY-MM-DD.json`.

Additional product safeguards (Phase 6): backup reminder after N days, "Restore from backup" on the
first-run screen (a wiped browser looks like a first run), stronger confirmation (type-to-confirm)
for "delete everything", with a "Back up first" button inside that dialog.

### 4.5 Privacy & offline

No analytics, telemetry, fonts, CDNs or API calls. Fonts are bundled (subset woff2, inlined).
The purchased builds make **zero** network requests; the hosted build adds only a service worker.
"Your data stays on your device" is literally true for every package.

---

## 5. Platform-by-platform

### Windows — ✅ Browser Edition · 🟨 desktop app

**V1 primary: `Life OS.html`.** Double-click → opens in Edge (default on every Windows 10/11 PC) →
works offline, data persists (validated, including an app-style window via `msedge --app`).
No installer, no SmartScreen or Smart App Control prompt, nothing to trust.

Known trade-offs (communicated in START HERE + in-app "Where is my data?"):
data lives in that browser's profile → use the same browser each time; clearing "site data"
deletes it → backups; a different browser shows an empty workspace.

**Optional premium: Tauri desktop app** (~3–10 MB, own window, data independent of the browser).
Ship **only when code-signed** (Azure Artifact Signing ≈ $10/month, or an OV certificate), because
unsigned executables are hard-blocked by Smart App Control and warned by SmartScreen.
Electron was rejected: ~90–100 MB per platform exceeds Etsy's 20 MB file limit.

### macOS — 🟨 pending real Mac

Browser Edition in Safari/Chrome is the candidate primary. Real Safari's IndexedDB-on-file:// behaviour
is checked in CI via `safaridriver` (same session only — Safari automation uses ephemeral storage);
**quit-and-relaunch persistence and Safari's 7-day storage rule must be tested on a real Mac.**
Unsigned `.app`s on macOS 15+ require System Settings → Privacy & Security → "Open Anyway"
(the Control-click bypass was removed), so the Tauri `.dmg` should only ship **notarized**
(Apple Developer Program, $99/yr).

### Android — 🟨 APK builds; device test pending

Capacitor 8 + the same `index.html` → debug APK builds in CI (3.8 MB zipped). Full-screen app, own
icon/name, IndexedDB in app data, offline by construction. Backups go through the Android share
sheet (Android WebView ignores `<a download>`), import via the normal file picker.
Distribution caveats:
- Sideloading needs "Install unknown apps" permission (guide with screenshots).
- **Android developer verification:** from 2026-09-30, apps on certified devices in Brazil, Indonesia,
  Singapore and Thailand must come from a registered developer; global rollout in 2027. Unregistered
  apps still install with extra steps. → Register in the Android Developer Console and sign the release
  APK with a stable key before launch.
- Uninstalling the app deletes its data (standard Android) → backup reminder matters.

### iPhone / iPad — ⬜ must be validated on a device

Opening an HTML file from the Files app gives a Quick Look preview, not a working app (to confirm, C4).
Candidate: **Home-Screen web app**: open a static https URL once in Safari → Add to Home Screen →
from then on it runs offline from its service-worker cache with its own storage container.
Honest constraints:
- Installation (and updates) need that URL to be online; day-to-day use does not.
- Data written in a Safari tab and in the Home-Screen app are separate → always use the icon.
- WebKit exempts Home-Screen apps from the 7-day storage deletion — **to be confirmed on device (A13)**.
- Hosting can be Vercel or any static host; the core product still works offline once installed.
Native App Store distribution is possible later but needs a paid Apple account, review, and a
different licensing model — out of scope for V1.

### Etsy delivery (5 files × 20 MB max per listing)

| # | File | Contents |
|---|---|---|
| 1 | `LifeOS-v1.0-START-HERE.pdf` | Pick-your-device guide, iPhone install link, backup guide, troubleshooting |
| 2 | `LifeOS-v1.0-Windows.zip` | `Life OS.html`, quick-start (+ signed installer when available) |
| 3 | `LifeOS-v1.0-Mac.zip` | `Life OS.html`, quick-start (+ notarized DMG when available) |
| 4 | `LifeOS-v1.0-Android.zip` | Signed APK + install guide |
| 5 | `LifeOS-v1.0-Backup-and-Updates.pdf` | Backup/restore + how to update without losing data |

Updates: buyers re-download from Etsy → open the new `Life OS.html` → same browser storage →
migrations run. Validated on Chromium that a copy in a different folder sees the same data.

---

## 6. Risks & open questions

| Risk | Impact | Mitigation |
|---|---|---|
| Buyer clears browser data / switches browser | Data "gone" | Backup reminders, first-run "Restore", clear "Where is my data?" page |
| Safari (Mac) file:// storage behaviour unknown | Mac primary may change | Real-Mac test B1; fallback = Chrome on Mac or notarized app |
| iOS Home-Screen workflow unvalidated | iPhone offering | Test C1–C6 before any iOS promise in the listing |
| Unsigned executables blocked (SAC / Gatekeeper) | Desktop app unusable for some | Ship desktop apps only signed/notarized; HTML edition always available |
| Android verification rollout | Install friction 2027+ | Register developer now; consider Play listing later |
| Very large restores are slow (20k rows ≈ 10 s) | Restore UX | Progress UI; keep row counts sane (daily rows, not per-event spam) |
| `persist()` not granted | Rare eviction | Backups; request persist where supported (hosted/app) |

---

## 7. Next: Phase 1

Project foundation (Svelte 5 + Vite single-file build, with a test that fails if the build ever
contains an external reference or `type="module" src`), design tokens for Soft & Dark themes,
the real IndexedDB layer + schema v1 + migrations framework + backup format, and the platform
adapter — reusing the proven PoC code.

---

## 8. CI results

| Run | Result | Output |
|---|---|---|
| PoC · Android APK (Capacitor 8) | ✅ success (2 min) | `app-debug.apk`, 3.78 MB zipped |
| PoC · Desktop app (Tauri 2) — Windows | ✅ success | NSIS installer + exe, 2.75 MB zipped |
| PoC · Desktop app (Tauri 2) — macOS | ✅ success | universal DMG, 3.43 MB zipped |
| PoC · browser validation (Win + macOS, Firefox/WebKit/real Safari) | ⏳ see Actions run | results artifact + run summary |

Artifacts are downloadable (GitHub login required) from
https://github.com/clipcoinagency/LUMA-OS/actions — these are the files for the real-device tests.
A successful **build** is not a platform validation: runtime behaviour on devices is still ⬜/🟨 until
DEVICE-TEST-PLAN.md is executed.
