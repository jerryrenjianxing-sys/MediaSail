# MediaSail 0.3.3 verification

Date: 2026-10-10, Asia/Shanghai. Full Windows x64 release, same runtime versions,
installation identity, account partitions and data root as 0.3.2.

## Data and security checks

- 30 Node checks passed, including the existing Python default-identity checks.
  New cases cover merged origins, conflicting copies, more than 100 chats,
  repeated startup, deletion, corrupted-file recovery, failed writes and retry,
  forbidden keys and main-frame-only IPC access.
- The actual Chromium migration fixture created data at multiple loopback origins,
  deleted the records at one origin, and restarted before reading the snapshot.
  Only live app keys were imported; deleted records and unrelated keys were absent.
  The reader handled origins internally and did not connect to their old services.
- Packaged UI checks forced occupied preferred ports on two consecutive launches.
  The final run changed from port 55585 to 52776 and retained 125 nonempty chats,
  a Chinese draft, the theme changed through the real UI, a finished-content file,
  a custom persona and a persistent non-authentication AitoEarn cookie.
- The rendered migrated conversation was opened and its screenshot inspected.
  Tests used isolated profiles and no model credentials or real platform accounts.
- TypeScript/Vite build and 1,017 packaged payload hashes passed, including clean
  workspace initialization. New read-only CCL sources have pinned commits,
  SHA-256 records and MIT notices.
- The existing NSIS long-path rename/uninstall regression passed without changing
  Windows policy or touching a registered MediaSail installation.

![Conversation after changing ports](images/state-0.3.3.png)

## Installer and release gate

The final full installer will be checked on an ephemeral GitHub-hosted Windows
runner: install genuine 0.3.2 into a custom directory, seed disposable data, then
run the final 0.3.3 installer with the exact old-client arguments
`--updated /S --force-run`. The observer reads the native progress window and
captures it without changing installation behavior. The restarted application's
version, path, local gateway and data are checked before test uninstall.

The user's installed application is not the test target. No real account or
publishing action is used. These checks do not repeat the previous download-speed
benchmark and do not claim real platform login validity from a fixture cookie.

Release publication, remote asset digests, installer evidence and old-client update
discovery results will be appended on main once verified. Published assets are not
overwritten after release.

## Reproduction

- `node --test tests/*.test.cjs`
- `node scripts/test-ui-migration.cjs` (local Electron fixture; bundled Python required)
- `node scripts/smoke-state.cjs` (packaged build; optional `EASEL_TEST_EXE` for a copy)
- GitHub Actions: **Verify actual Windows installer** (ephemeral hosted runner only)

Backups live under `ui-state-migration-0.3.3`. The original browser storage remains
untouched. A failed initial migration stops at the startup retry page instead of
opening an empty chat list and persisting it. `ui-state.json.previous` is the last
valid saved snapshot; damaged main files are retained separately before recovery.
