# Phase 0 — automated validation results

Run: 2026-11-23T00:22:04.905Z on Windows_NT 10.0.26100 (x64), Node v22.23.5.
Project path contains spaces and lives in OneDrive: `D:\a\LUMA-OS\LUMA-OS\poc\web`.

| Target | Launch mode | Version | Passed | Failed | Result |
|---|---|---|---|---|---|
| Microsoft Edge (installed, default .html handler) | file:// (double-click) | 157.0.4341.60 | 25 | 0 | ✅ |
| Microsoft Edge (installed, default .html handler) | http://127.0.0.1 (served) | 157.0.4341.60 | 26 | 0 | ✅ |
| Google Chrome (installed) | file:// (double-click) | 157.0.8103.79 | 25 | 0 | ✅ |
| Google Chrome (installed) | http://127.0.0.1 (served) | 157.0.8103.79 | 26 | 0 | ✅ |
| Firefox (Playwright build) | file:// (double-click) | 155.0 | 25 | 0 | ✅ |
| Firefox (Playwright build) | http://127.0.0.1 (served) | 155.0 | 26 | 0 | ✅ |
| WebKit (Playwright build — Safari engine proxy, NOT real Safari) | file:// (double-click) | 26.6 | 25 | 0 | ✅ |
| WebKit (Playwright build — Safari engine proxy, NOT real Safari) | http://127.0.0.1 (served) | 26.6 | 25 | 1 | ❌ |
| Edge app-window launcher (msedge --app=file://…) | file:// (double-click) |  | 2 | 0 | ✅ |
| Date strategy under different time zones (Chromium) | file:// (double-click) |  | 6 | 0 | ✅ |

## Microsoft Edge (installed, default .html handler) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 154 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — 2fyi1n6hmwsitxp6
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:22:09 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 825 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 13 ms
- ✅ Export of 6,000 records < 5 s — 49 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.9 MB / 10242.9 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 208 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 48 ms, validate 8 ms, restore 1146 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## Microsoft Edge (installed, default .html handler) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 183 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — 1g4ks5oumwsiu5g7
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:22:18 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 917 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 27 ms
- ✅ Export of 6,000 records < 5 s — 70 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.2 MB / 10242.2 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 275 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 57 ms, validate 10 ms, restore 1420 ms
- ✅ Offline reload works (service worker) + data readable

## Google Chrome (installed) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 142 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — yzqsenyemwsiuges
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
- ℹ️ Stress: write 5,000 more records — 1071 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 15 ms
- ✅ Export of 6,000 records < 5 s — 52 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.9 MB / 10242.9 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 192 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 47 ms, validate 8 ms, restore 1149 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## Google Chrome (installed) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 174 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — 2j204n47mwsiunto
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:22:42 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 798 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 29 ms
- ✅ Export of 6,000 records < 5 s — 80 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.1 MB / 10243.1 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 215 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 46 ms, validate 8 ms, restore 1068 ms
- ✅ Offline reload works (service worker) + data readable

## Firefox (Playwright build) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 170 ms
- ℹ️ navigator.storage.persist() — no answer yet (browser is asking the user)
- ✅ Test value survives full browser restart — c1sez2ypmwsiuwyh
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
- ℹ️ Stress: write 5,000 more records — 829 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 6 ms
- ✅ Export of 6,000 records < 5 s — 56 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.0 MB / 10240.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 389 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 64 ms, validate 18 ms, restore 1168 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module true, fetch() sibling true

## Firefox (Playwright build) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 204 ms
- ℹ️ navigator.storage.persist() — no answer yet (browser is asking the user)
- ✅ Test value survives full browser restart — 16jnxlbymwsivejw
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:23:22 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 814 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 8 ms
- ✅ Export of 6,000 records < 5 s — 60 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.3 MB / 10240.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 241 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 69 ms, validate 19 ms, restore 1187 ms
- ✅ Offline reload works (service worker) + data readable

## WebKit (Playwright build — Safari engine proxy, NOT real Safari) — file

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 1163 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — nos1l5j5mwsivpvj
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:23:32 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 5704 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 12 ms
- ✅ Export of 6,000 records < 5 s — 35 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.3 MB / 1000.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 101 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 44 ms, validate 14 ms, restore 6330 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## WebKit (Playwright build — Safari engine proxy, NOT real Safari) — http

UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 1195 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — r7rzjwj0mwsiw5hl
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-11-23.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 11/23/2026, 12:23:52 AM (Life OS 0.1.0) with 1000 records. This will replace the 0 records current…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 5712 ms
- ✅ Month query on 6,000 records < 1 s — 920 rows in 12 ms
- ✅ Export of 6,000 records < 5 s — 36 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 2.4 MB / 1000.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 120 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 48 ms, validate 9 ms, restore 6328 ms
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
