# MediaSail 0.3.1 verification

Environment: Windows 11 x64, 2026-10-09. Easel baseline and runtime versions are
unchanged from 0.3.0. No real model credentials or social-platform publication.

## Completed before publication

- 23 unit checks passed, including the restricted settings open-and-check caller,
  rejection of remote pages/iframes, shared update-operation serialization,
  checksum failure, cancellation and user-data preservation.
- Frontend TypeScript and production build passed. Packaged payload inventory
  verified all 1,012 hashes and clean workspace initialization.
- Real Electron + local HTTP fixture passed settings-triggered checking, unsaved
  model configuration retention, offline retry, invalid SHA-512 rejection, tray
  download, no automatic installation, verified-cache reuse across restart,
  busy-task installation cancellation and real local-service recovery after a
  simulated installer-launch failure. Fixture target 0.4.0 is not a real release.
- The settings screenshot was inspected; it follows the existing settings layout.

## Publication and real upgrade measurement

The real GitHub 0.3.0 -> 0.3.1 measurement is performed after publication so an
unmodified anonymous 0.3.0 client can discover it. Its result will be appended to
this document on the main branch and to the release notes. The released source
snapshot records only checks completed when the artifact was built.

`scripts/benchmark-update.cjs` records actual response body bytes separately for
installer data, blockmaps and metadata; HTTP/TLS overhead is excluded. Download
phase time includes local reconstruction and integrity verification. Installation
to automatic process launch and service readiness are separate observations.
The test uses a temporary installation, backs up/restores pre-existing data and
cache, and verifies content/config/localStorage/non-auth session-cookie retention.
