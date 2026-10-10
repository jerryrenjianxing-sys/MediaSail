# Updates and releases

MediaSail 0.3.0 introduces `electron-updater` 6.8.9, pinned in package-lock.json.
The public feed is GitHub Releases in `jerryrenjianxing-sys/MediaSail`. Applications
contain no GitHub token. They use builder-generated `resources/app-update.yml`.
Only stable versions greater than the installed version are offered.

Since 0.3.1, Settings > Software update shows the installed version, last successful
check, shared status and download progress. Its button opens the local update window
and immediately checks, without discarding unsaved settings. The sidebar and tray
also open that same update window. A background check runs once,
15 seconds after launch. Downloads start only on a user click. Progress survives
closing to the tray. Both automatic download and install-on-quit are disabled.
The user explicitly chooses restart/install; active Easel tasks, AitoEarn uploads
and uncertain service status trigger the existing confirmation. Services owned by
this app stop before installation. Canceling the confirmation keeps them running.

Electron-updater verifies the downloaded SHA-512 against release metadata. The
current Windows build is unsigned; no Authenticode publisher certificate is
configured. The updater attempts NSIS differential downloads using blockmaps and
falls back to downloading the complete installer. Keep older release assets:
the previous blockmap can be needed. A first update or large runtime change can
require the full installer (~1.8 GB). Complete downloads are cached; after restart,
checking and downloading the same version revalidates and reuses the cached file.
Partial failed downloads may restart. Offline errors do not stop the local app.

Version 0.3.2 completes MediaSail branding in chat, static pages, skill descriptions,
AI import copy and default agent identity. Only recognized unmodified old identity
templates are migrated, with original bytes backed up in the agent workspace's
`.mediasail-brand-backup-0.3.2` directory. Existing cloud group names, user content,
custom identities and legacy storage keys are preserved. This is still a full NSIS
installation update; it does not split or accelerate runtime installation.
See [the 0.3.2 verification record](VERIFICATION-0.3.2.md), including the observed
limitation when another service forces the local browser origin to change ports.

As one size estimate, comparing the 0.2.0 and 0.3.0 NSIS blockmaps found
1,777,733,201 reusable bytes out of a 1,785,234,218-byte new installer. Changed
blocks total 7,501,017 bytes (0.42%). This excludes blockmap downloads and HTTP
overhead, and is not a measured end-to-end update: 0.2.0 did not have an updater.
It does not guarantee the size of future releases. Differential transfer still
reconstructs a complete installer locally; installation replaces program files.
Separately versioned code/runtime packages would be a distinct future design.

The real 0.3.0 -> 0.3.1 test transferred 6,857,098 response-body bytes including
metadata, with no full-download fallback. Download/reconstruction/verification took
28.035 s; installation through automatic relaunch took 730.372 s, followed by
80.024 s until ready. See [the measurement and its limits](VERIFICATION-0.3.1.md).

An updater IPC caller must be a trusted top-level local window. The main Easel
window can read status, open the update window, and use a restricted open-and-check
action. Only the bundled update window can download/install. The remote AitoEarn view has no updater preload or local
file/command API. Renderers cannot set a feed URL or an arbitrary installer path.

## Compatibility

Keep `build.appId = org.electroneasel.desktop`, the NSIS installation identity,
`%LOCALAPPDATA%\ElectronEasel`, and `persist:aitoearn-cn` stable. They intentionally
retain the old name so ElectronEasel 0.1/0.2 data and sessions survive the rebrand.
Install MediaSail 0.3 once manually over the old app. Subsequent updates happen
inside the app. Uninstall defaults to keeping data.

## Publish a version

1. Bump package.json and package-lock.json together. Build and verify on Windows.
2. Use `scripts/build.ps1`, which sets `ELECTRON_BUILDER_COMPRESSION_LEVEL=1`.
   For an already prepared build, set that same environment variable before
   `npm run dist` or the prepackaged NSIS command. Keeping compression consistent
   prevents unchanged runtime files from producing different compressed blocks.
   Then run `python scripts/source-bundle.py` using the build Python.
3. Commit and push the tested source. Create a matching tag such as `v0.3.0`.
4. Create a **draft** GitHub Release and upload all of:
   - `MediaSail-VERSION-win-x64-Setup.exe`
   - `MediaSail-VERSION-win-x64-Setup.exe.blockmap`
   - `latest.yml` (generated for those exact bytes; never hand-edit its hash)
   - matching source archive and SHA256SUMS.txt
5. Verify the asset names and checksums, then publish the release as stable/latest.

Do not publish `latest.yml` before its installer is available. Do not overwrite
already published version binaries: fix forward with a new version. Pushing code
alone does not ship an app update. Authentication is used only by maintainers/CI;
never embed GH_TOKEN/GITHUB_TOKEN in the installer. `--publish never` prevents a
local build from accidentally uploading anything.

Official reference: https://www.electron.build/docs/features/auto-update/

## Reproducing the 0.3.0 -> 0.3.1 benchmark

`node scripts/benchmark-update.cjs` requires the published baseline installer in
the output directory and v0.3.1 on the real public GitHub feed. It refuses another
installed/running MediaSail. The test backs up the existing data/cache directories
and shortcuts, installs 0.3.0 in a temporary path, and performs an actual update.
Its HTTP response listeners count body bytes without changing the updater requests,
download source, checksums, or installation. No credentials or real social posts
are used. Raw logs stay in ignored `.test-data`, never the public source bundle.

The old installation can be prepared while the new release is being built using
`--prepare-only`; after publication use `--resume`. The recovery journal is kept at
`.test-data/update-speed-v031/recovery.json`. On an interrupted run inspect it and use
`--restore` to uninstall only the registered test copy and restore the backups.
Successful runs restore the machine automatically and retain a JSON measurement
report beside the installer. Do not delete backups until restoration is confirmed.

The helper checkpoints results at each phase. If only the post-upgrade UI checks
were interrupted after installation, `--verify-installed` resumes those checks
against the owned temporary copy without repeating download/install. The actual
automatic restart is observed through a temporary loopback Node inspector attached
only to the verified test-process PID; this adds no debugger to the published app.
`--retain-on-failure` is for diagnosis and deliberately defers cleanup; follow it
with successful verification or `--restore`. Never leave the test profile occupying
the user's standard paths after a diagnostic run.
