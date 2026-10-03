# Phase 0 — automated validation results

Run: 2026-10-03T17:42:46.597Z on Windows_NT 10.0.26100 (x64), Node v22.23.3.
Project path contains spaces and lives in OneDrive: `D:\a\LUMA-OS\LUMA-OS\poc\web`.

| Target | Launch mode | Version | Passed | Failed | Result |
|---|---|---|---|---|---|
| Microsoft Edge (installed, default .html handler) | file:// (double-click) | 153.0.4234.48 | 25 | 0 | ✅ |
| Microsoft Edge (installed, default .html handler) | http://127.0.0.1 (served) | 153.0.4234.48 | 26 | 0 | ✅ |
| Google Chrome (installed) | file:// (double-click) | 154.0.8037.58 | 25 | 0 | ✅ |
| Google Chrome (installed) | http://127.0.0.1 (served) | 154.0.8037.58 | 26 | 0 | ✅ |
| Firefox (Playwright build) | file:// (double-click) | 155.0 | 25 | 0 | ✅ |
| Firefox (Playwright build) | http://127.0.0.1 (served) | 155.0 | 26 | 0 | ✅ |
| WebKit (Playwright build — Safari engine proxy, NOT real Safari) | file:// (double-click) | 26.6 | 25 | 0 | ✅ |
| WebKit (Playwright build — Safari engine proxy, NOT real Safari) | http://127.0.0.1 (served) | 26.6 | 25 | 1 | ❌ |
| Edge app-window launcher (msedge --app=file://…) | file:// (double-click) |  | 2 | 0 | ✅ |
| Date strategy under different time zones (Chromium) | file:// (double-click) |  | 6 | 0 | ✅ |

## Microsoft Edge (installed, default .html handler) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 125 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — 381t83ygmusojudc
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-10-03.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 10/3/2026, 5:42:51 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 742 ms
- ✅ Month query on 6,000 records < 1 s — 120 rows in 4 ms
- ✅ Export of 6,000 records < 5 s — 52 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.9 MB / 10242.9 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 215 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 46 ms, validate 8 ms, restore 1037 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## Microsoft Edge (installed, default .html handler) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 148 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — e8qqlbutmusok2vh
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-10-03.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 10/3/2026, 5:43:02 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 729 ms
- ✅ Month query on 6,000 records < 1 s — 120 rows in 4 ms
- ✅ Export of 6,000 records < 5 s — 72 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.2 MB / 10242.2 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 222 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 48 ms, validate 8 ms, restore 1022 ms
- ✅ Offline reload works (service worker) + data readable

## Google Chrome (installed) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 142 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — h7kfbw19musokdok
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-10-03.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 10/3/2026, 5:43:16 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 561 ms
- ✅ Month query on 6,000 records < 1 s — 120 rows in 3 ms
- ✅ Export of 6,000 records < 5 s — 55 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.9 MB / 10242.9 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 228 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 49 ms, validate 7 ms, restore 943 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## Google Chrome (installed) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 128 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — a8ram1w9musokl1s
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-10-03.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 10/3/2026, 5:43:25 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 607 ms
- ✅ Month query on 6,000 records < 1 s — 120 rows in 4 ms
- ✅ Export of 6,000 records < 5 s — 57 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 1.6 MB / 10241.6 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 238 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 53 ms, validate 8 ms, restore 1037 ms
- ✅ Offline reload works (service worker) + data readable

## Firefox (Playwright build) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 136 ms
- ℹ️ navigator.storage.persist() — no answer yet (browser is asking the user)
- ✅ Test value survives full browser restart — tnp83w5tmusokup3
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-10-03.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 10/3/2026, 5:43:44 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 667 ms
- ✅ Month query on 6,000 records < 1 s — 120 rows in 1 ms
- ✅ Export of 6,000 records < 5 s — 63 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.0 MB / 10240.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 320 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 67 ms, validate 21 ms, restore 1874 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module true, fetch() sibling true

## Firefox (Playwright build) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 228 ms
- ℹ️ navigator.storage.persist() — no answer yet (browser is asking the user)
- ✅ Test value survives full browser restart — 0qu3o9i0musolcnb
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-10-03.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 10/3/2026, 5:44:06 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 659 ms
- ✅ Month query on 6,000 records < 1 s — 120 rows in 1 ms
- ✅ Export of 6,000 records < 5 s — 63 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.3 MB / 10240.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 309 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 56 ms, validate 16 ms, restore 964 ms
- ✅ Offline reload works (service worker) + data readable

## WebKit (Playwright build — Safari engine proxy, NOT real Safari) — file

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 1116 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — z504g3aemusolnq7
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-10-03.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 10/3/2026, 5:44:16 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 5561 ms
- ✅ Month query on 6,000 records < 1 s — 120 rows in 5 ms
- ✅ Export of 6,000 records < 5 s — 40 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.3 MB / 1000.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 214 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 43 ms, validate 9 ms, restore 6354 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## WebKit (Playwright build — Safari engine proxy, NOT real Safari) — http

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 1120 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — ae0ums9amusom3bm
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-10-03.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 10/3/2026, 5:44:36 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 5487 ms
- ✅ Month query on 6,000 records < 1 s — 120 rows in 5 ms
- ✅ Export of 6,000 records < 5 s — 39 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.4 MB / 1000.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 114 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 43 ms, validate 9 ms, restore 6296 ms
- ❌ Offline reload works (service worker) — page.reload: WebKit encountered an internal error

## Edge app-window launcher (msedge --app=file://…) — file

- ✅ App window opens the local file + writes
- ✅ Data survives closing/reopening the app window — 250 records

## Date strategy under different time zones (Chromium) — file

- ✅ Day key correct at 11:30 pm Sep 15 in Los Angeles — local key 2026-09-15 (naive toISOString would say 2026-09-16)
- ✅ Day arithmetic across DST in America/Los_Angeles — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
- ✅ Day key correct at 1:30 am Sep 16 in Auckland — local key 2026-09-16 (naive toISOString would say 2026-09-15)
- ✅ Day arithmetic across DST in Pacific/Auckland — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
- ✅ Day key correct at 12:15 am Sep 16 in India — local key 2026-09-16 (naive toISOString would say 2026-09-15)
- ✅ Day arithmetic across DST in Asia/Kolkata — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
