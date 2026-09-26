# Phase 0 — automated validation results

Run: 2026-09-26T16:37:56.077Z on Windows_NT 10.0.26200 (x64), Node v24.19.0.
Project path contains spaces and lives in OneDrive: `C:\Users\samiu\OneDrive\Desktop\ETSY\app planner L1\poc\web`.

| Target | Launch mode | Version | Passed | Failed | Result |
|---|---|---|---|---|---|
| Microsoft Edge (installed, default .html handler) | file:// (double-click) | 153.0.4234.48 | 25 | 0 | ✅ |
| Microsoft Edge (installed, default .html handler) | http://127.0.0.1 (served) | 153.0.4234.48 | 26 | 0 | ✅ |
| Google Chrome (installed) | file:// (double-click) | 154.0.8037.57 | 25 | 0 | ✅ |
| Google Chrome (installed) | http://127.0.0.1 (served) | 154.0.8037.57 | 26 | 0 | ✅ |
| Edge app-window launcher (msedge --app=file://…) | file:// (double-click) |  | 2 | 0 | ✅ |
| Date strategy under different time zones (Edge) | file:// (double-click) |  | 6 | 0 | ✅ |

## Microsoft Edge (installed, default .html handler) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 1431 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — 5rtrve1wmuim5gsb
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 26/9/2026, 10:08:06 pm (Life OS 0.1.0) with 1000 records. This will replace the 0 records currentl…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 20,000 more records — 12926 ms
- ✅ Month query on 21,000 records < 1 s — 1040 rows in 89 ms
- ✅ Export of 21,000 records < 5 s — 1023 ms, 3.0 MB
- ℹ️ Storage persisted / estimate — false · 7.2 MB / 10247.2 MB
- ✅ Restored + stress data survive another restart — 21000 records
- ℹ️ Cold open with 21,000 records — 1394 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 21,000 records — export 467 ms, validate 141 ms, restore 12905 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## Microsoft Edge (installed, default .html handler) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 793 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — 1reqe932muim6l8g
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 26/9/2026, 10:08:55 pm (Life OS 0.1.0) with 1000 records. This will replace the 0 records currentl…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 20,000 more records — 7833 ms
- ✅ Month query on 21,000 records < 1 s — 1040 rows in 67 ms
- ✅ Export of 21,000 records < 5 s — 794 ms, 3.0 MB
- ℹ️ Storage persisted / estimate — false · 7.3 MB / 10247.3 MB
- ✅ Restored + stress data survive another restart — 21000 records
- ℹ️ Cold open with 21,000 records — 1413 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 21,000 records — export 940 ms, validate 118 ms, restore 11710 ms
- ✅ Offline reload works (service worker) + data readable

## Google Chrome (installed) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 515 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — ki5ejsusmuim7f0m
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 9/26/2026, 10:09:33 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currentl…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 20,000 more records — 7251 ms
- ✅ Month query on 21,000 records < 1 s — 1040 rows in 50 ms
- ✅ Export of 21,000 records < 5 s — 516 ms, 3.0 MB
- ℹ️ Storage persisted / estimate — false · 4.7 MB / 10244.7 MB
- ✅ Restored + stress data survive another restart — 21000 records
- ℹ️ Cold open with 21,000 records — 1171 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 21,000 records — export 620 ms, validate 80 ms, restore 10568 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module false, fetch() sibling false

## Google Chrome (installed) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 487 ms
- ℹ️ navigator.storage.persist() — false
- ✅ Test value survives full browser restart — 3f7bgta9muim85gj
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 9/26/2026, 10:10:07 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currentl…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 20,000 more records — 7225 ms
- ✅ Month query on 21,000 records < 1 s — 1040 rows in 52 ms
- ✅ Export of 21,000 records < 5 s — 539 ms, 3.0 MB
- ℹ️ Storage persisted / estimate — false · 7.3 MB / 10247.3 MB
- ✅ Restored + stress data survive another restart — 21000 records
- ℹ️ Cold open with 21,000 records — 1031 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 21,000 records — export 818 ms, validate 87 ms, restore 10817 ms
- ✅ Offline reload works (service worker) + data readable

## Edge app-window launcher (msedge --app=file://…) — file

- ✅ App window opens the local file + writes
- ✅ Data survives closing/reopening the app window — 250 records

## Date strategy under different time zones (Edge) — file

- ✅ Day key correct at 11:30 pm Sep 15 in Los Angeles — local key 2026-09-15 (naive toISOString would say 2026-09-16)
- ✅ Day arithmetic across DST in America/Los_Angeles — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
- ✅ Day key correct at 1:30 am Sep 16 in Auckland — local key 2026-09-16 (naive toISOString would say 2026-09-15)
- ✅ Day arithmetic across DST in Pacific/Auckland — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
- ✅ Day key correct at 12:15 am Sep 16 in India — local key 2026-09-16 (naive toISOString would say 2026-09-15)
- ✅ Day arithmetic across DST in Asia/Kolkata — 2026-11-01 2026-11-02 2026-03-09 2026-09-28
