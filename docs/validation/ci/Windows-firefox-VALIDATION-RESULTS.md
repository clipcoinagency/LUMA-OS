# Phase 0 — automated validation results

Run: 2026-09-26T18:09:28.949Z on Windows_NT 10.0.26100 (x64), Node v22.23.2.
Project path contains spaces and lives in OneDrive: `D:\a\LUMA-OS\LUMA-OS\poc\web`.

| Target | Launch mode | Version | Passed | Failed | Result |
|---|---|---|---|---|---|
| Firefox (Playwright build) | file:// (double-click) | 155.0 | 25 | 0 | ✅ |
| Firefox (Playwright build) | http://127.0.0.1 (served) | 155.0 | 26 | 0 | ✅ |

## Firefox (Playwright build) — file

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 121 ms
- ℹ️ navigator.storage.persist() — no answer yet (browser is asking the user)
- ✅ Test value survives full browser restart — et7pk3bemuipf8pk
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 9/26/2026, 6:09:40 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 570 ms
- ✅ Month query on 6,000 records < 1 s — 1040 rows in 7 ms
- ✅ Export of 6,000 records < 5 s — 53 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.0 MB / 10240.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 285 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 65 ms, validate 18 ms, restore 1080 ms
- ℹ️ Folder moved/copied → data still visible? — YES (storage shared by all file:// pages)
- ℹ️ file:// script loading — inline classic true, external classic true, inline module true, external module true, fetch() sibling true

## Firefox (Playwright build) — http

UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0`

- ✅ IndexedDB opens (launch #1)
- ✅ Write test value + 1,000 dated records — 158 ms
- ℹ️ navigator.storage.persist() — no answer yet (browser is asking the user)
- ✅ Test value survives full browser restart — 70786ck3muipfnok
- ✅ Launch counter = 2 — 2
- ✅ All 1,000 records survive restart — 1000
- ✅ Survives page refresh
- ✅ Export downloads a dated backup file — LifeOS-PoC-Backup-2026-09-26.json
- ✅ Backup contains every record + schema version — 1000 records, 144 KB
- ✅ Backup excludes device-only diagnostics
- ✅ Clear → Cancel leaves data untouched
- ✅ Clear → Confirm deletes data — 0
- ✅ Restore via file picker brings everything back — restore:ok, 1000 records
- ✅ Restore warns before replacing (shows counts) — Backup from 9/26/2026, 6:09:58 PM (Life OS 0.1.0) with 1000 records. This will replace the 0 records currently…
- ✅ Restore → Cancel changes nothing
- ✅ Rejects invalid backup: empty.json — This file is empty.
- ✅ Rejects invalid backup: not-json.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ✅ Rejects invalid backup: wrong-kind.json — This file isn't a Life OS backup.
- ✅ Rejects invalid backup: newer-version.json — This backup was made by a newer version of Life OS (data version 99). Please update Life OS, then restore again.
- ✅ Rejects invalid backup: edited.json — This backup appears damaged or was edited (integrity check failed).
- ✅ Rejects invalid backup: truncated.json — This file couldn't be read as a Life OS backup. It may be damaged or a different kind of file.
- ℹ️ Stress: write 5,000 more records — 713 ms
- ✅ Month query on 6,000 records < 1 s — 1040 rows in 8 ms
- ✅ Export of 6,000 records < 5 s — 58 ms, 0.8 MB
- ℹ️ Storage persisted / estimate — false · 3.2 MB / 10240.0 MB
- ✅ Restored + stress data survive another restart — 6000 records
- ℹ️ Cold open with 6,000 records — 255 ms (incl. browser page load)
- ✅ Launch counter keeps counting across restore + restart
- ✅ Full backup → restore of 6,000 records — export 60 ms, validate 16 ms, restore 784 ms
- ✅ Offline reload works (service worker) + data readable
