# Real-device test plan (Phase 0)

Automated tests cover what can be driven from a Windows PC and from CI. The items below **need a
human with the real device**. Every test uses the same PoC page, which reports its own result
in the banner at the top — no technical knowledge needed.

Record results in [`validation/device-results.md`](validation/device-results.md) (device model, OS
version, browser version, pass/fail per step, screenshots if something fails).

The banner states you should see:

| Banner | Meaning |
|---|---|
| 🟡 **No test value yet** | Fresh install / storage empty |
| ⚪ **Test value saved (this launch)** | Written; now close completely and reopen |
| 🟢 **✅ Data survived relaunch — value from launch #N found** | PASS |
| 🔴 **Storage is not available here** | FAIL — note the message |

---

## A. Persistence core (run on every device/package below)

1. Open the app the way a customer would (see the per-platform section).
2. Tap **Write test value** → banner turns ⚪.
3. Tap **Add 500 dated records**.
4. **Fully close** it: Windows/Mac: quit the browser/app (Mac: ⌘Q, not just the red dot).
   Phone: app switcher → swipe it away.
5. Reopen the same way → banner must be 🟢 and show launch #2.
6. Restart the device. Reopen → still 🟢 (launch #3).
7. Airplane mode on → reopen → still 🟢 and the page loads.
8. Tap **Run full self-test** → every line `PASS` (the last two lines are `INFO`).
9. **Export backup** → confirm the file lands somewhere you can find it (note where).
10. **Clear all test data** → Confirm → banner 🟡.
11. **Import backup…** → pick the file from step 9 → dialog warns about replacing → **Replace my data**
    → banner 🟢 again, **Count records** shows 500.
12. Import a random non-backup file (e.g. a photo) → friendly error, "Nothing was changed".
13. Wait **8+ days without opening it**, then reopen → still 🟢 (checks Safari's 7-day storage rule;
    Mac/iPhone only, but worth doing on every device).

---

## B. macOS

Test on the newest macOS available **and** one older version if possible (Safari version is tied to macOS).

| # | Package | How the customer opens it |
|---|---|---|
| B1 | Browser edition in **Safari** | Double-click `index.html` in Finder (opens default browser) |
| B2 | Browser edition in **Chrome** | Right-click → Open With → Chrome |
| B3 | Desktop app (Tauri `.dmg`, from CI artifact `LifeOS-PoC-desktop-macOS`) | Open DMG → drag to Applications → open |

For B3 also record **exactly** what Gatekeeper shows on first open (screenshot) and the steps needed
to get past it — this is unsigned/un-notarized, so we expect *"Apple could not verify…"* and a trip
to **System Settings → Privacy & Security → Open Anyway**. This decides whether Apple notarization
($99/yr) is mandatory for V1.

For B1 also: move the folder to another location and reopen → note whether the data is still visible
(tells us what happens when a customer downloads an update into a new folder).

---

## C. iPhone / iPad

Needs the PoC hosted on an https URL (e.g. a Vercel preview of `poc/web/`).

| # | Workflow | Steps |
|---|---|---|
| C1 | Safari tab | Open the URL in Safari. Run section A. |
| C2 | **Home Screen app** (primary candidate) | Safari → Share → **Add to Home Screen** → open from the icon. Run section A (the icon must open with no Safari address bar; env panel shows "standalone"). |
| C3 | Home Screen app offline | After C2, airplane mode → open from icon → must load and be 🟢. |
| C4 | Opening the HTML file from the Files app | Save `index.html` to Files → tap it. Record what happens (expected: Quick Look preview, no working storage → confirms file:// is not an iOS option). |
| C5 | Backup on iOS | In C2, **Export backup** should open the share sheet → **Save to Files**. Then **Import backup…** from Files. |
| C6 | Data isolation | Confirm data written in C1 (Safari tab) is **not** visible in C2 (Home Screen app) — expected per WebKit; we must tell customers to always use the icon. |

Record iOS version and device model. Test an iPad too (iPadOS reports itself as a Mac — the PoC handles it, confirm).

---

## D. Android

Install the APK from CI artifact `LifeOS-PoC-android-debug-apk`
(Settings will ask to allow installs from your browser/Files app — record the exact wording/steps).

| # | Check |
|---|---|
| D1 | Section A in the installed app |
| D2 | App icon + name "Life OS PoC" on the home screen, opens full-screen without a browser bar |
| D3 | Export backup → Android share sheet appears → save to Files/Drive → file is valid (import it back) |
| D4 | Import backup via the file picker |
| D5 | Force-stop the app in Settings → reopen → 🟢 |
| D6 | Note Play Protect warnings, if any (unsigned debug build) |

Test on one Samsung and one Pixel if possible (different WebView/OEM behaviour).

---

## E. Windows (extra, real customer workflow)

Automated tests already ran real Edge/Chrome. One manual confirmation remains:

1. Download the PoC folder as a **zip from a browser** (so Windows marks it as downloaded), extract it
   with Explorer, double-click `index.html`. Record any warning (expected: none — HTML is not an executable).
2. Section A in Edge.
3. Try the Tauri installer from CI artifact `LifeOS-PoC-desktop-Windows` on a PC with
   **Smart App Control ON** and on one with it off. Record exactly what happens.
