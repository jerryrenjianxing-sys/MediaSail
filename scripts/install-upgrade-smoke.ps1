param([ValidateSet('seed','upgrade')][string]$Phase)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $Root)
$InstallTarget = [IO.Path]::GetFullPath((Join-Path $WorkspaceRoot 'work\安装升级 测试 v020'))
if (-not $InstallTarget.StartsWith($WorkspaceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Test install path escaped workspace.' }
. (Join-Path $PSScriptRoot 'assert-test-install.ps1')
Assert-TestInstallOwnership $InstallTarget
if ($Phase -eq 'seed' -and (Test-Path -LiteralPath $InstallTarget)) { throw 'Inspect the existing test directory before seeding.' }
if ($Phase -eq 'upgrade' -and -not (Test-Path -LiteralPath (Join-Path $InstallTarget 'ElectronEasel.exe'))) { throw 'Seed installation is missing.' }
$Version = if ($Phase -eq 'seed') { '0.1.0' } else { '0.2.0' }
$Installer = Join-Path $WorkspaceRoot "outputs\ElectronEasel\ElectronEasel-$Version-win-x64-Setup.exe"
$SetupProcess = Start-Process -FilePath $Installer -ArgumentList @('/S',"/D=$InstallTarget") -WindowStyle Hidden -PassThru
$SetupProcess.WaitForExit()
if ($SetupProcess.ExitCode -ne 0) { throw "Installer failed: $($SetupProcess.ExitCode)" }
Write-Output "INSTALLED $Version IN CHINESE AND SPACE PATH"
$env:EASEL_TEST_EXE = Join-Path $InstallTarget 'ElectronEasel.exe'
Set-Location $Root
if ($Phase -eq 'seed') { & build/runtime/node/node.exe scripts/upgrade-smoke.cjs --seed } else { & build/runtime/node/node.exe scripts/upgrade-smoke.cjs }
if ($LASTEXITCODE -ne 0) { throw 'Upgrade verification failed.' }
if ($Phase -eq 'upgrade') {
    $UninstallProcess = Start-Process -FilePath (Join-Path $InstallTarget 'Uninstall ElectronEasel.exe') -ArgumentList '/S' -WindowStyle Hidden -PassThru
    $UninstallProcess.WaitForExit()
    if ($UninstallProcess.ExitCode -ne 0) { throw 'Test uninstall failed.' }
    $Deadline = [DateTime]::UtcNow.AddSeconds(90)
    while ((Test-Path -LiteralPath (Join-Path $InstallTarget 'ElectronEasel.exe')) -and [DateTime]::UtcNow -lt $Deadline) { Start-Sleep -Milliseconds 500 }
    if (Test-Path -LiteralPath (Join-Path $InstallTarget 'ElectronEasel.exe')) { throw 'Test application still exists after uninstall.' }
    $RetainedContent = Join-Path $Root '.test-data\升级 验证 v020\workspace\outputs\升级保留\成品.txt'
    if ((Get-Content -LiteralPath $RetainedContent -Raw) -ne '覆盖升级必须保留的内容') { throw 'Uninstall did not preserve the test data.' }
    Write-Output 'UPGRADE INSTALLATION AND UNINSTALL PASSED'
}
