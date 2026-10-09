$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$Root = (Get-Location).Path
$Lock = Get-Content runtime-lock.json -Raw | ConvertFrom-Json
function Checked([scriptblock]$Action) { & $Action; if ($LASTEXITCODE -ne 0) { throw "Build command failed: $Action" } }
if (-not (Test-Path vendor/easel/README.md)) {
    Checked { git clone https://github.com/ZJU-REAL/Easel.git vendor/easel }
    Checked { git -C vendor/easel checkout --detach $Lock.easel }
}
if (Test-Path vendor/easel/.git) {
    foreach ($PatchFile in Get-ChildItem -LiteralPath "$Root\patches" -Filter '*.patch') {
        git -C vendor/easel apply --reverse --check $PatchFile.FullName 2>$null
        if ($LASTEXITCODE -ne 0) { Checked { git -C vendor/easel apply $PatchFile.FullName } }
    }
} elseif (-not (Test-Path upstream-files.json)) { throw 'Source snapshot manifest is missing.' }
if (-not (Test-Path build/runtime/node/node.exe)) { Checked { python scripts/prepare.py node } }
$env:PATH = "$Root\build\runtime\node;$env:PATH"
Checked { uv python install $Lock.python --install-dir build/runtime/python --no-bin --no-registry }
$Python = "$Root\build\runtime\python\cpython-3.11.15-windows-x86_64-none\python.exe"
Checked { uv pip install --python $Python --break-system-packages --require-hashes -r requirements.lock }
Checked { & build/runtime/node/npm.cmd ci --no-audit --no-fund --ignore-scripts }
if (-not (Test-Path node_modules/electron/dist/electron.exe)) { Checked { python scripts/prepare.py electron } }
Checked { & build/runtime/node/npm.cmd install --global --prefix "$Root\build\runtime\node" "openclaw@$($Lock.openclaw)" --ignore-scripts --no-audit --no-fund }
Copy-Item -LiteralPath openclaw-shrinkwrap.json -Destination build/runtime/node/node_modules/openclaw/npm-shrinkwrap.json
Checked { & build/runtime/node/npm.cmd ci --prefix build/runtime/node/node_modules/openclaw --omit=dev --ignore-scripts --no-audit --no-fund }
Remove-Item -LiteralPath build/runtime/node/node_modules/openclaw/npm-shrinkwrap.json
Checked { & build/runtime/node/node.exe build/runtime/node/node_modules/openclaw/scripts/postinstall-bundled-plugins.mjs }
Checked { & $Python scripts/prepare.py assets }
Checked { & build/runtime/node/npm.cmd --prefix vendor/easel/web/frontend ci --ignore-scripts --no-audit --no-fund }
Checked { & build/runtime/node/npm.cmd --prefix vendor/easel/web/frontend run build }
$env:PLAYWRIGHT_BROWSERS_PATH = "$Root\build\runtime\browsers"
Checked { & $Python -m playwright install chromium }
Checked { & $Python scripts/launchers.py }
if (-not (Test-Path build/runtime/ffmpeg/ffmpeg.exe)) {
    throw 'Provide the pinned Gyan FFmpeg 8.1.1 full build: python scripts/prepare.py ffmpeg <extracted-build-directory>. Verify ffmpeg-lock.json, then run this build again.'
}
Checked { & $Python scripts/inventory.py }
Checked { & build/runtime/node/npm.cmd test }
$env:ELECTRON_BUILDER_COMPRESSION_LEVEL = '1'
Checked { & build/runtime/node/npm.cmd run dist }
