# Real-device test plan (Phase 10)

Automated tests (Playwright against real installed Edge/Chrome, plus GitHub Actions CI) cover
everything that can be driven from this Windows PC and from CI runners — see `tests/e2e/*.mjs` for
the full suite and `packaging/` for how each platform's build is produced. The items below **need
a human with the real device**; nothing here can be faked or skipped by automation.

Record results in [`validation/device-results.md`](validation/device-results.md) (device model, OS
version, browser or package version, pass/fail per step, screenshots if something fails).

> Superseded note: this plan originally exercised the Phase 0 storage prototype
> (`poc/web/index.html`, a hand-rolled page with its own pass/fail banner). That PoC proved the
> underlying storage approach works across engines; **from Phase 8 onward, test the real product**
> — the same steps below, but against the actual app described in the "What you're testing" section.

---

## What you're testing

- **Browser edition** (Windows/macOS primary): `packaging/browser-edition/Life OS.html`, produced by
  `npm run build && npm run package:browser`. Double-click it — it opens in the default browser.
- **Android**: the debug APK from the `LifeOS-android-debug-apk` artifact on the
  [`App · Android APK (Capacitor)`](https://github.com/clipcoinagency/LUMA-OS/actions/workflows/app-android.yml)
  workflow (built by `packaging/android/`).
- **Desktop app** (optional/preview only — **not for sale yet**, unsigned): the
  `LifeOS-desktop-Windows` (NSIS installer) / `LifeOS-desktop-macOS` (universal `.dmg`) artifacts
  from [`App · Desktop app (Tauri)`](https://github.com/clipcoinagency/LUMA-OS/actions/workflows/app-desktop.yml)
  (built by `packaging/desktop-tauri/`). Ship this only once code-signed (Windows) / notarized
  (macOS) — see `docs/PHASE-0-ARCHITECTURE.md` §5.
- **iPhone/iPad**: the hosted build at https://luma-os-beta.vercel.app/.

The banner/UI language to expect:

| What you'll see | Meaning |
|---|---|
| "Set up my workspace" welcome screen | Fresh install / storage empty |
| Onboarding steps (modules → theme → about you → dashboard layout) → "Open my workspace" | Normal first run |
| Settings → "Running as" | Confirms which platform the app detected (Browser edition / Web app / Desktop app / Android app) |
| A dated item (task, habit check-in, transaction…) still there after closing and reopening | PASS |
| Settings → "Back up now" → a file appears | Backup works for this platform's save method |

To populate real data quickly for testing (instead of typing everything by hand), open
`#/dev/data` from the address bar / hash and tap **"Add 90 days of sample data"** — it seeds tasks,
habits, goals, notes, wellness days, workouts and transactions across the last 90 days, exactly
what `tests/e2e/history.mjs` and `tests/e2e/phone-360.mjs` use.

---

## A. Persistence core (run on every device/package below)

1. Open the app the way a customer would (see the per-platform section).
2. Complete onboarding → land on the Dashboard.
3. Open `#/dev/data` → **Add 90 days of sample data**.
4. Add one more thing by hand (e.g. a task) so you have something specific to look for.
5. **Fully close** it: Windows/Mac: quit the browser/app (Mac: ⌘Q, not just the red dot).
   Phone: app switcher → swipe it away.
6. Reopen the same way → your workspace, theme, and the task you added must all still be there.
7. Restart the device. Reopen → still there.
8. Airplane mode on → reopen → still there and the page loads (no network needed).
9. Settings → **Back up now** → confirm the file lands somewhere you can find it (note where —
   Downloads / native Save dialog / share sheet, depending on platform).
10. Settings → **Delete everything** → type `DELETE` → confirm → back at the welcome screen.
11. Welcome screen → **I have a backup** → pick the file from step 9 → preview shows counts →
    confirm → your workspace, theme and the task from step 4 are all back.
12. Try importing a random non-backup file (e.g. a photo) → friendly error, nothing changed.
13. Wait **8+ days without opening it**, then reopen → still there (checks Safari's 7-day storage
    rule; Mac/iPhone only, but worth doing on every device).

---

## B. macOS

Test on the newest macOS available **and** one older version if possible (Safari version is tied to macOS).

| # | Package | How the customer opens it |
|---|---|---|
| B1 | Browser edition in **Safari** | Double-click `Life OS.html` in Finder (opens default browser) |
| B2 | Browser edition in **Chrome** | Right-click → Open With → Chrome |
| B3 | Desktop app (Tauri `.dmg`, artifact `LifeOS-desktop-macOS`) | Open DMG → drag to Applications → open |

For B3 also record **exactly** what Gatekeeper shows on first open (screenshot) and the steps needed
to get past it — this is unsigned/un-notarized, so expect *"Apple could not verify…"* and a trip to
**System Settings → Privacy & Security → Open Anyway**. This decides whether Apple notarization
($99/yr) is mandatory before B3 can ship to customers (it currently can't).

For B1 also: move the file to another location and reopen → note whether the data is still visible
(tells us what happens when a customer downloads an update into a new folder).

---

## C. iPhone / iPad

Uses the hosted build: https://luma-os-beta.vercel.app/

| # | Workflow | Steps |
|---|---|---|
| C1 | Safari tab | Open the URL in Safari. Run section A. |
| C2 | **Home Screen app** (primary candidate) | Safari → Share → **Add to Home Screen** → open from the icon. Run section A (the icon must open with no Safari address bar). |
| C3 | Home Screen app offline | After C2, airplane mode → open from icon → must load and still show your data. |
| C4 | Backup on iOS | In C2, **Back up now** should open the share sheet → **Save to Files**. Then **I have a backup** from Files. |
| C5 | Data isolation | Confirm data written in C1 (Safari tab) is **not** visible in C2 (Home Screen app) — expected per WebKit; we must tell customers to always use the icon. |

Record iOS version and device model. Test an iPad too (iPadOS reports itself as a Mac to the app —
confirm the layout still adapts correctly).

---

## D. Android

Install the APK from CI artifact `LifeOS-android-debug-apk`
(Settings will ask to allow installs from your browser/Files app — record the exact wording/steps).

| # | Check |
|---|---|
| D1 | Section A in the installed app |
| D2 | App icon + name "Life OS" on the home screen, opens full-screen without a browser bar |
| D3 | **Back up now** → Android share sheet appears → save to Files/Drive → file is valid (import it back) |
| D4 | Import backup via **I have a backup** / Settings restore |
| D5 | Force-stop the app in Settings → reopen → data still there |
| D6 | Note Play Protect warnings, if any (unsigned debug build) |

Test on one Samsung and one Pixel if possible (different WebView/OEM behaviour).

---

## E. Windows (extra, real customer workflow)

Automated tests already ran real Edge/Chrome, including a folder-move check and a Mark-of-the-Web
download simulation (`tests/e2e/file-launch.mjs`). Two manual confirmations remain:

1. Download `Life OS.html` as part of a **zip from a browser** (so Windows marks it as downloaded),
   extract it with Explorer, double-click it. Record any warning (expected: none — HTML is not an
   executable).
2. Try the Tauri installer from CI artifact `LifeOS-desktop-Windows` on a PC with
   **Smart App Control ON** and on one with it off. Record exactly what happens (expected: blocked
   or heavily warned on SAC-on machines, since it's unsigned — this is why it isn't shipped yet).
