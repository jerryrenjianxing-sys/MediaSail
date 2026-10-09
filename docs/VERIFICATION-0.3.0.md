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

## Release checks in progress

- Final installer compression, release asset hashes and GitHub public feed check.
- Actual ElectronEasel 0.2 → MediaSail 0.3 installation into a path with Chinese
  characters/spaces, data/session preservation and data-preserving uninstall.

## Limits

Real model-provider and social-platform logins/publication are deferred to the owner,
as requested. Preserved-session tests use non-authentication fixture cookies.
The updater HTTP fixture proves protocol, checksum, caching and UI behavior; it is
not a claim that an actual future 0.4 release has been published or installed.
