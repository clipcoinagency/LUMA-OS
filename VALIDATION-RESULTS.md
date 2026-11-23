# Phase 0 — automated validation results

Run: 2026-11-23T00:21:53.951Z on Darwin 25.6.0 (arm64), Node v22.23.5.
Project path contains spaces and lives in OneDrive: `/Users/runner/work/LUMA-OS/LUMA-OS/poc/web`.

| Target | Launch mode | Version | Passed | Failed | Result |
|---|---|---|---|---|---|
| Google Chrome (installed) | file:// (double-click) | 157.0.8103.79 | 25 | 0 | ✅ |
| Google Chrome (installed) | http://127.0.0.1 (served) | 157.0.8103.79 | 26 | 0 | ✅ |
| Firefox (Playwright build) | file:// (double-click) | 155.0 | 25 | 0 | ✅ |
| Firefox (Playwright build) | http://127.0.0.1 (served) | 155.0 | 26 | 0 | ✅ |
| WebKit (Playwright build — Safari engine proxy, NOT real Safari) | file:// (double-click) | 26.6 | 25 | 0 | ✅ |
| WebKit (Playwright build — Safari engine proxy, NOT real Safari) | http://127.0.0.1 (served) | 26.6 | 25 | 1 | ❌ |
| Date strategy under different time zones (Chromium) | file:// (double-click) |  | 6 | 0 | ✅ |

## Google Chrome (installed) — file

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 101 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — h7rijb1wmwsitrsc
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:22:04 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 662 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 15 ms
- ✅ Export of 6,000 records < 5 s — 55 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.4 MB / 10243.4 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 239 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 36 ms, validate 6 ms, restore 694 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## Google Chrome (installed) — http

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 84 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — lr4q5rd5mwsiu2kt
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:22:15 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 414 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 7 ms
- ✅ Export of 6,000 records < 5 s — 29 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.5 MB / 10243.5 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 357 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 45 ms, validate 11 ms, restore 575 ms
- ✅ Offline reload works (service worker) + data readable

## Firefox (Playwright build) — file

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 119 ms
- ℹ️ navigator.storage.persist() — no answer yet (browser is asking the user)
- ✅ Test value survives full browser restart — mw4lggmcmwsiubdo
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:22:32 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 642 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 8 ms
- ✅ Export of 6,000 records < 5 s — 66 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.0 MB / 10240.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 337 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 54 ms, validate 22 ms, restore 500 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module true, fetch() sibling true

## Firefox (Playwright build) — http

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 119 ms
- ℹ️ navigator.storage.persist() — no answer yet (browser is asking the user)
- ✅ Test value survives full browser restart — pbdoais1mwsiuq58
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:22:51 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 468 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 7 ms
- ✅ Export of 6,000 records < 5 s — 54 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.3 MB / 10240.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 234 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 43 ms, validate 18 ms, restore 566 ms
- ✅ Offline reload works (service worker) + data readable

## WebKit (Playwright build — Safari engine proxy, NOT real Safari) — file

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 112 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — n2s75riimwsiv1qy
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:23:01 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 395 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 9 ms
- ✅ Export of 6,000 records < 5 s — 29 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.3 MB / 19660.8 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 214 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 57 ms, validate 11 ms, restore 549 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## WebKit (Playwright build — Safari engine proxy, NOT real Safari) — http

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 116 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — 60dqot06mwsiv9l6
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:23:11 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 384 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 9 ms
- ✅ Export of 6,000 records < 5 s — 28 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.4 MB / 19660.8 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 238 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 33 ms, validate 6 ms, restore 474 ms
- ❌ Offline reload works (service worker) — page.reload: WebKit encountered an internal error

## Date strategy under different time zones (Chromium) — file

- ✅ Day key correct at 11:30 pm Sep 15 in Los Angeles — local key 2026-09-15 (naive toISOString would say 2026-09-16)
- ✅ Day arithmetic across DST in America/Los_Angeles — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
- ✅ Day key correct at 1:30 am Sep 16 in Auckland — local key 2026-09-16 (naive toISOString would say 2026-09-15)
- ✅ Day arithmetic across DST in Pacific/Auckland — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
- ✅ Day key correct at 12:15 am Sep 16 in India — local key 2026-09-16 (naive toISOString would say 2026-09-15)
- ✅ Day arithmetic across DST in Asia/Kolkata — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
