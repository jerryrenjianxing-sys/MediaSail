# MediaSail Agent-first homepage

Implemented and verified on 2026-10-15. This is a local preview of the homepage
change, built from the existing 0.4.2 source; it is not a new GitHub release.

## Result

Each launch starts on a full-width Agent homepage with the MediaSail purple logo
and copy. The primary “控制台” button and footer button open the existing dashboard.
The original console sidebar, personas, chat and business pages appear there;
“连接 Agent” returns to the standalone homepage. The root App remains mounted, so
chat requests and history persist across those navigation changes. The existing
first-use persona recommendation is deferred until entering the console.

The homepage reuses the product family's header, typography, spacing, buttons,
Agent marquee and footer. The circular theme wipe is adapted from Media Deep
Researcher with pinned GSAP 3.15.0: 0.48-second expansion, 0.16-second fade and
0.55-second icon motion. Both interfaces use the original `easel_theme` key and
desktop UI-state storage. The root theme listener follows system preferences
until the user explicitly chooses a theme. No business HTTP or desktop IPC
interface, Skill content or account storage was added or changed.

## Verification

- Frontend TypeScript and production build passed.
- The full independent Windows application payload passed 1,065 file hashes and
  clean workspace initialization.
- The exported patch applied to a fresh copy of the pinned upstream. All eight
  homepage/theme/dependency files matched after Git line-ending normalization.
- `scripts/smoke-home.cjs` passed against the actual packaged application, using a
  new Chinese/space-containing data directory and the bundled real local services.
- Startup, console/footer entry, returning home and deferred onboarding passed.
- A synthetic slow chat stream continued while the homepage was visible and its
  complete result was saved to desktop UI storage. No model or account was used.
- Actual clipboard copy, full-format clipboard restoration, selected manual-copy
  fallback, service-error feedback and retry passed.
- Actual circular wipe frames, rapid toggles, navigating during animation,
  reduced-motion mode, reload/restart persistence and system preference passed.
- The Agent marquee pause/resume and reduced-motion static list passed.
- Light/dark screenshots covered normal and 1100×700 content windows, plus
  Electron page zoom at 125% and 150%. Page zoom is **not** a change to Windows
  system DPI; the capture environment reported devicePixelRatio 2.
- Homepage/console update state, closing the banner across navigation/reload/tray,
  the next-launch reminder and the existing update window passed. Two process
  launches made two metadata requests, zero installer requests, with zero page
  errors. The offered 0.4.3 version is a **local fixture**, not a published version.

[Machine-readable passing result](evidence/home-2026-10-15.json).

The earlier test runs corrected harness-only scrollbar width, duplicate-text
selection and Windows clipboard line-ending assumptions. They did not require
product changes; their evidence is retained alongside the local preview.

## Preview and media

The independent full Windows build and `打开首页预览.cmd` are in
`outputs/MediaSail/home-preview-2026-10-15` under this workspace's output directory.
The launcher uses its own `preview-data` folder. Acceptance closed its test
processes; it did not replace the user's registered installation or real data.

![Light homepage](images/home-2026-10-15-light.png)
![Dark homepage](images/home-2026-10-15-dark.png)

[Theme transition recording](images/home-2026-10-15-theme.mp4) contains actual
Playwright Electron rendered frames, trimmed and encoded with the bundled FFmpeg.
The complete WebM/MP4, animation frame samples, small-window and zoom screenshots
remain in the preview's `evidence` directory. No replacement graphics were drawn.
