function Assert-TestInstallOwnership([string]$InstallTarget) {
    $ExpectedUninstallers = @('Uninstall ElectronEasel.exe','Uninstall MediaSail.exe') | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $InstallTarget $_)) }
    foreach ($RegistryRoot in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')) {
        if (-not (Test-Path -LiteralPath $RegistryRoot)) { continue }
        $Existing = Get-ChildItem -LiteralPath $RegistryRoot | Get-ItemProperty | Where-Object { $_.DisplayName -like 'ElectronEasel*' -or $_.DisplayName -like 'MediaSail*' }
        foreach ($Entry in $Existing) {
            if ($Entry.UninstallString -notmatch '^"([^"]+)"') { throw 'Cannot identify existing ElectronEasel installation; refusing to replace it.' }
            $RegisteredUninstaller = [IO.Path]::GetFullPath($Matches[1])
            if ($RegisteredUninstaller -notin $ExpectedUninstallers) {
                throw 'An unrelated ElectronEasel installation exists; refusing to replace it.'
            }
        }
    }
}
