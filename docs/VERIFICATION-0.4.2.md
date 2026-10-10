# MediaSail 0.4.2 verification

This release includes the complete 0.4.0 Agent connection/startup update-banner
features, the 0.4.1 long-path installer copy repair, and a compatibility repair for
old uninstallers' rollback temporary paths. 0.4.0 and 0.4.1 were retained as
prereleases after upgrade verification did not pass. Their assets are unchanged.

## Old-uninstaller compatibility

The 0.4.1 hosted upgrade had not reached the recorded `old-version-removed` stage.
Free-space changes showed files moving back during the legacy uninstall operation;
it was cancelled before an installation success was established. A separate,
corrected NSIS fixture reproduced a child uninstaller's normal-TEMP Rename failure
with long paths. Passing an extended-length form of that same temporary directory
to the child made the same file operation succeed with exact contents.

The incoming installer now scopes TEMP/TMP changes around the old-uninstaller
process only. It preserves its exit code and execution-error flag and restores
both environment values after success or launch failure. No persistent environment
or registry settings are changed. The hash-checked pinned-template patch wraps
both normal and fallback old-uninstaller calls; the known 0.1.0 compatibility retry
uses the same wrapper. The new-file copying repair remains in place.

The regression fixture verifies:
- Normal TEMP reproduces the old child Rename failure.
- The actual installer wrapper permits the same deep Unicode destination.
- Moved contents match, child exit code 17 is preserved, and launch errors propagate.
- Parent TEMP/TMP are restored after both success and failure.
- No registered installation or real user profile is used.

The UI/application code is unchanged from the packaged 0.4.1 feature check:
[Agent and banner evidence](evidence/agent-0.4.1.json), including copied Skill,
profile updates, actual content-library import, light/dark themes, port changes,
startup/dismissal behavior, tray restore and offline recovery. Only the application
version and incoming installer compatibility changed in 0.4.2. The final hosted
run below also checks the actual new version, local service and Agent page.

Release assets and the real 0.3.3 upgrade result will be recorded after verification.
