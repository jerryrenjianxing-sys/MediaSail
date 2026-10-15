$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$BuildRoot = (Get-Location).Path
$Lock = Get-Content runtime-lock.json -Raw | ConvertFrom-Json
function Checked([scriptblock]$Action) { & $Action; if ($LASTEXITCODE -ne 0) { throw "Build failed: $Action" } }
if (-not (Test-Path vendor/easel/README.md)) {
 Checked { git clone https://github.com/ZJU-REAL/Easel.git vendor/easel }
 Checked { git -C vendor/easel checkout --detach $Lock.easel }
}
if (Test-Path vendor/easel/.git) {
 foreach ($PatchFile in Get-ChildItem -LiteralPath "$BuildRoot\patches" -Filter '*.patch') {
  git -C vendor/easel apply --reverse --check $PatchFile.FullName 2>$null
  if ($LASTEXITCODE -ne 0) { Checked { git -C vendor/easel apply $PatchFile.FullName } }
 }
} elseif (-not (Test-Path upstream-files.json)) { throw 'Source snapshot manifest is missing.' }
# Build-time Node is never shipped in the business runtime.
if (-not (Test-Path build/runtime/node/node.exe)) { Checked { python scripts/prepare.py node } }
$env:PATH = "$BuildRoot\build\runtime\node;$env:PATH"
Checked { uv python install $Lock.python --install-dir build/runtime-business/python --no-bin --no-registry }
$BusinessPython = "$BuildRoot\build\runtime-business\python\cpython-3.11.15-windows-x86_64-none\python.exe"
Checked { uv pip sync --python $BusinessPython --break-system-packages --require-hashes requirements-business.lock }
Checked { & build/runtime/node/npm.cmd ci --no-audit --no-fund --ignore-scripts }
if (-not (Test-Path node_modules/electron/dist/electron.exe)) { Checked { & $BusinessPython scripts/prepare.py electron } }
Checked { & $BusinessPython scripts/prepare.py assets }
Checked { & $BusinessPython scripts/launchers.py }
Checked { & build/runtime/node/npm.cmd --prefix vendor/easel/web/frontend ci --ignore-scripts --no-audit --no-fund }
Checked { & build/runtime/node/npm.cmd --prefix vendor/easel/web/frontend run build }
Checked { & build/runtime/node/node.exe scripts/stage.cjs }
Checked { & $BusinessPython scripts/export-agent-api.py }
Checked { & $BusinessPython scripts/inventory.py }
Checked { & build/runtime/node/npm.cmd test }
$env:ELECTRON_BUILDER_COMPRESSION_LEVEL = '5'
Checked { & build/runtime/node/npm.cmd run dist }
