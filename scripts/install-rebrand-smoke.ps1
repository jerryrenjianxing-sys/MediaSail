param([ValidateSet('seed','upgrade','verify')][string]$Phase)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $Root)
$InstallTarget = [IO.Path]::GetFullPath((Join-Path $WorkspaceRoot 'work\品牌升级 测试 v030'))
if (-not $InstallTarget.StartsWith($WorkspaceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Test path escaped workspace.' }
. (Join-Path $PSScriptRoot 'assert-test-install.ps1')
Assert-TestInstallOwnership $InstallTarget
if ($Phase -eq 'seed' -and (Test-Path -LiteralPath $InstallTarget)) { throw 'Inspect the existing test directory before seeding.' }
if ($Phase -eq 'upgrade' -and -not (Test-Path -LiteralPath (Join-Path $InstallTarget 'ElectronEasel.exe'))) { throw 'Seed installation missing.' }
$Relative = if ($Phase -eq 'seed') { 'outputs\ElectronEasel\ElectronEasel-0.2.0-win-x64-Setup.exe' } else { 'outputs\MediaSail\MediaSail-0.3.0-win-x64-Setup.exe' }
$Installer = Join-Path $WorkspaceRoot $Relative
if ($Phase -ne 'verify') {
    $SetupProcess = Start-Process -FilePath $Installer -ArgumentList @('/S',"/D=$InstallTarget") -WindowStyle Hidden -PassThru
    $SetupProcess.WaitForExit()
    if ($SetupProcess.ExitCode -ne 0) { throw "Installer failed: $($SetupProcess.ExitCode)" }
}
$ExeName = if ($Phase -eq 'seed') { 'ElectronEasel.exe' } else { 'MediaSail.exe' }
$env:EASEL_TEST_EXE = Join-Path $InstallTarget $ExeName
Set-Location $Root
if ($Phase -eq 'seed') { & build/runtime/node/node.exe scripts/rebrand-upgrade.cjs --seed } else { & build/runtime/node/node.exe scripts/rebrand-upgrade.cjs }
if ($LASTEXITCODE -ne 0) { throw 'Brand upgrade verification failed.' }
if ($Phase -ne 'seed') {
    if (Test-Path -LiteralPath (Join-Path $InstallTarget 'ElectronEasel.exe')) { throw 'Old executable remains after upgrade.' }
    $UninstallProcess = Start-Process -FilePath (Join-Path $InstallTarget 'Uninstall MediaSail.exe') -ArgumentList '/S' -WindowStyle Hidden -PassThru
    $UninstallProcess.WaitForExit()
    if ($UninstallProcess.ExitCode -ne 0) { throw 'Test uninstall failed.' }
    $Deadline = [DateTime]::UtcNow.AddSeconds(90)
    while ((Test-Path -LiteralPath (Join-Path $InstallTarget 'MediaSail.exe')) -and [DateTime]::UtcNow -lt $Deadline) { Start-Sleep -Milliseconds 500 }
    if (Test-Path -LiteralPath (Join-Path $InstallTarget 'MediaSail.exe')) { throw 'Test application remains after uninstall.' }
    $RetainedContent = Join-Path $Root '.test-data\品牌 升级 v030\workspace\outputs\升级保留\成品.txt'
    if ((Get-Content -LiteralPath $RetainedContent -Raw) -ne 'MediaSail 改名后保留内容') { throw 'Uninstall did not preserve test data.' }
    Write-Output 'BRAND UPGRADE INSTALLATION AND DATA-PRESERVING UNINSTALL PASSED'
}
