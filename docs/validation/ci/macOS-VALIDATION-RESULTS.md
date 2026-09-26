# Phase 0 — automated validation results

Run: 2026-09-26T17:45:34.180Z on Darwin 25.6.0 (arm64), Node v22.23.2.
Project path contains spaces and lives in OneDrive: `/Users/runner/work/LUMA-OS/LUMA-OS/poc/web`.

| Target | Launch mode | Version | Passed | Failed | Result |
|---|---|---|---|---|---|
| Google Chrome (installed) | file:// (double-click) | 152.0.7977.83 | 25 | 0 | ✅ |
| Google Chrome (installed) | http://127.0.0.1 (served) | 152.0.7977.83 | 26 | 0 | ✅ |
| Firefox (Playwright build) | file:// (double-click) |  | 0 | 1 | ❌ |
| Firefox (Playwright build) | http://127.0.0.1 (served) |  | 0 | 1 | ❌ |
| WebKit (Playwright build — Safari engine proxy, NOT real Safari) | file:// (double-click) | 26.6 | 25 | 0 | ✅ |
| WebKit (Playwright build — Safari engine proxy, NOT real Safari) | http://127.0.0.1 (served) | 26.6 | 25 | 1 | ❌ |
| Date strategy under different time zones (Chromium) | file:// (double-click) |  | 6 | 0 | ✅ |

## Google Chrome (installed) — file

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 55 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — efztbp07muiokiy6
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 9/26/2026, 5:45:42 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 275 ms
- ✅ Month query on 6,000 records < 1 s — 1040 rows in 7 ms
- ✅ Export of 6,000 records < 5 s — 24 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.4 MB / 10243.4 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 156 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 44 ms, validate 20 ms, restore 1886 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## Google Chrome (installed) — http

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 94 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — e1dabnepmuiokt9b
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 9/26/2026, 5:45:55 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 380 ms
- ✅ Month query on 6,000 records < 1 s — 1040 rows in 15 ms
- ✅ Export of 6,000 records < 5 s — 40 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.5 MB / 10243.5 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 880 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 59 ms, validate 11 ms, restore 787 ms
- ✅ Offline reload works (service worker) + data readable

## Firefox (Playwright build) — file

- ❌ Timed out — no result after 360s (engine hung)

## Firefox (Playwright build) — http

- ❌ Timed out — no result after 360s (engine hung)

## WebKit (Playwright build — Safari engine proxy, NOT real Safari) — file

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 73 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — uav43qd0muip0hre
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 9/26/2026, 5:58:06 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 264 ms
- ✅ Month query on 6,000 records < 1 s — 1040 rows in 9 ms
- ✅ Export of 6,000 records < 5 s — 25 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.3 MB / 19660.8 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 108 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 21 ms, validate 5 ms, restore 312 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## WebKit (Playwright build — Safari engine proxy, NOT real Safari) — http

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 55 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — jjih0hh7muip0nni
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 9/26/2026, 5:58:13 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 265 ms
- ✅ Month query on 6,000 records < 1 s — 1040 rows in 8 ms
- ✅ Export of 6,000 records < 5 s — 19 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.4 MB / 19660.8 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 158 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 23 ms, validate 8 ms, restore 417 ms
- ❌ Offline reload works (service worker) — page.reload: WebKit encountered an internal error

## Date strategy under different time zones (Chromium) — file

- ✅ Day key correct at 11:30 pm Sep 15 in Los Angeles — local key 2026-09-15 (naive toISOString would say 2026-09-16)
- ✅ Day arithmetic across DST in America/Los_Angeles — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
- ✅ Day key correct at 1:30 am Sep 16 in Auckland — local key 2026-09-16 (naive toISOString would say 2026-09-15)
- ✅ Day arithmetic across DST in Pacific/Auckland — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
- ✅ Day key correct at 12:15 am Sep 16 in India — local key 2026-09-16 (naive toISOString would say 2026-09-15)
- ✅ Day arithmetic across DST in Asia/Kolkata — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
