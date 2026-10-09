# MediaSail 0.3.0 verification

Environment: Windows 11 x64; Electron 44.7.0; electron-updater 6.8.9.
Test data is isolated from normal user data. No real social-account writes occur.

## Completed

- Frontend TypeScript/Vite production build passed.
- `npm test`: 22 passed, covering data preservation, runtime paths, occupied ports,
  AitoEarn import safety and updater state/security behavior.
- Packaged payload: 1,011 file SHA-256 hashes matched; clean workspace initialization
  passed. Packaged GitHub feed configuration was also verified.
- `scripts/smoke-updates.cjs`: real packaged Electron window and real electron-updater
  against a local HTTP fixture. Offline/retry, rejected SHA-512, download while hidden
  in the tray, no automatic installation, verified cache reuse after process restart,
  canceling an install while an Easel task is active, and recovery of Easel/AitoEarn
  after an intercepted installer failure all passed.
- Update fixture binaries are random inert bytes. The install invocation is replaced
  by a test spy; those files are never executed. The fixture feed is injected by the
  test process, not exposed through an application setting or renderer API.

- Actual Electron smoke: branded interface, 114 upstream skills, bundled services,
  tray background operation, second-instance activation and canceling busy exit passed.
- Packaged AitoEarn integration regression: isolated browser session, streaming image
  and video imports, FFmpeg cover, duplicate guard, navigation persistence, interrupted
  upload, popup/network recovery and restart persistence passed against a mock website.
- Both patches apply cleanly to the pinned upstream Git archive.
- NSIS long-path rename/uninstall regression passed without modifying Windows policy.
- GitHub Windows CI passed with the same portable Python 3.11.15 distribution.
- Actual ElectronEasel 0.2 → MediaSail 0.3 installation into a path with Chinese
  characters and spaces passed. Content, config, localStorage and the non-auth fixture
  cookie survived. Desktop and Start-menu shortcuts both point to MediaSail.exe.
  The old executable was removed; subsequent test uninstall preserved the test data.
  App launch used a Windows-only PATH, without global Python/Node/OpenClaw.
- Release installer: 1,785,234,218 bytes. SHA-256:
  `786d89d60038a8167d9fcee8eea71a4d0718dd328a6871433857a159466e79ba`.
  latest.yml version, file size and SHA-512 matched. GitHub's uploaded asset digest
  matched the local installer, blockmap and update manifest before publishing.

The public feed can be checked after publishing with `scripts/smoke-github-update.cjs`;
it checks the real GitHub endpoint without downloading or installing an update.

## Limits

Real model-provider and social-platform logins/publication are deferred to the owner,
as requested. Preserved-session tests use non-authentication fixture cookies.
The updater HTTP fixture proves protocol, checksum, caching and UI behavior; it is
not a claim that an actual future 0.4 release has been published or installed.
