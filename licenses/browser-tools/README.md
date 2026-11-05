# Dedicated browser components

The unmodified browser ZIP is pinned in `browser-tools.lock.json`. The browser,
BrowserSkill, extension dependencies and native dependencies retain their own
licenses and attribution; this project's Apache license does not replace them.

The Microsoft SDK terms and notices in this directory apply **only to the
unchanged Microsoft d3dcompiler_47.dll** shipped alongside the browser, to the
extent applicable to that component. Microsoft retains its rights in that DLL.
The complete SDK text is retained as the original source of those conditions;
MediaSail does not install the complete SDK or distribute its unrelated features.

MediaSail, Chromium, BrowserSkill and the other open-source components continue
under their respective licenses. This component-specific presentation does not
restrict obtaining their source, modifying them, using modified versions, or
reverse engineering those open-source portions as necessary to debug those
modifications. It does not grant additional rights to modify or reverse engineer
Microsoft's DLL.

The installer obtains agreement for this Microsoft component before installing
it, including upgrades from versions which did not contain the component.
Agreement to identical terms is remembered separately from the installation
registry. An explicit silent deployment must first read the terms and pass the
versioned `/ACCEPT_MS_D3D_LICENSE=<SHA256-of-original-license>` option; `/S` alone
does not imply agreement. Distributors must preserve the unmodified component,
Microsoft notices and applicable downstream agreement/distribution conditions.

`Microsoft-Windows-SDK-SOURCES.json` records the official SDK package, matching
DLL, signed publisher and license provenance. The official REDIST snapshot lists
this DLL for classic Windows applications. Other components' declarations follow
in the original notice files. Browser corresponding sources, patches, build
preparation materials, MPL sources and locked Rust crate sources are available in
the same MediaSail Release's separate Browser Sources assets. They are optional
developer downloads, not additional user runtime downloads.
