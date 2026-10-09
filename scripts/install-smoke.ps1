$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $Root)
$Version = (Get-Content -LiteralPath (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
$Installer = Join-Path $WorkspaceRoot "outputs\ElectronEasel\ElectronEasel-$Version-win-x64-Setup.exe"
$InstallTarget = [System.IO.Path]::GetFullPath((Join-Path $WorkspaceRoot 'work\installer-smoke-final'))
if (-not $InstallTarget.StartsWith($WorkspaceRoot + '\',[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Test install directory is outside the workspace.' }
. (Join-Path $PSScriptRoot 'assert-test-install.ps1')
Assert-TestInstallOwnership $InstallTarget
if (Test-Path -LiteralPath $InstallTarget) { throw 'Test install directory already exists; inspect it before another installation.' }
if (-not (Test-Path -LiteralPath $Installer)) { throw 'Installer is not ready.' }
$Process = Start-Process -FilePath $Installer -ArgumentList @('/S',"/D=$InstallTarget") -WindowStyle Hidden -PassThru
$Process.WaitForExit()
if ($Process.ExitCode -ne 0) { throw "Installer exited with $($Process.ExitCode)" }
$Exe = Join-Path $InstallTarget 'ElectronEasel.exe'
foreach ($Relative in @('ElectronEasel.exe','resources\runtime\node\node.exe','resources\runtime\python\cpython-3.11.15-windows-x86_64-none\python.exe','resources\runtime\ffmpeg\ffmpeg.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $InstallTarget $Relative))) { throw "Missing installed file: $Relative" }
}
$Backend = Get-Content -LiteralPath (Join-Path $InstallTarget 'resources\payload\easel\web\app.py') -Raw
if (-not $Backend.Contains("models[0]['name'] = model")) { throw 'Installer contains a stale payload.' }
Write-Output 'INSTALLER EXTRACTED COMPLETE RUNTIME AND LATEST PAYLOAD'
$env:EASEL_TEST_EXE = $Exe
$env:EASEL_TEST_DATA = Join-Path $Root ('.test-data\全新安装 ' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$env:EASEL_TEST_CLEAN_PATH = '1'
Set-Location $Root
& build/runtime/node/node.exe scripts/smoke-electron.cjs
if ($LASTEXITCODE -ne 0) { throw 'Installed application verification failed.' }
# Uninstall only this dedicated test installation; preserve all user-data directories.
$Uninstaller = Join-Path $InstallTarget 'Uninstall ElectronEasel.exe'
if (-not (Test-Path -LiteralPath $Uninstaller)) { throw 'Test uninstaller missing.' }
$Process = Start-Process -FilePath $Uninstaller -ArgumentList '/S' -WindowStyle Hidden -PassThru
$Process.WaitForExit()
if ($Process.ExitCode -ne 0) { throw "Uninstaller exited with $($Process.ExitCode)" }
Write-Output 'INSTALLATION, INSTALLED-APP STARTUP AND UNINSTALL COMPLETED'
