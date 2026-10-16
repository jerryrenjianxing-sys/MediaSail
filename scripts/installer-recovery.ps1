param(
  [ValidateSet('Probe','Stage','Rollback')][string]$Mode = 'Probe',
  [string]$ConnectionFile,
  [string]$ResultFile,
  [string]$StateFile,
  [string]$InstallKey,
  [string]$UninstallKey,
  [string]$ExpectedDirectory,
  [switch]$LibraryOnly
)
$ErrorActionPreference = 'Stop'

function Get-RecoveryHash([string]$File) {
  $algorithm = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($File)
  try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
  finally { $stream.Dispose(); $algorithm.Dispose() }
}

function Assert-PlainPath([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path) -or $Path -match '[\r\n"]' -or $Path -notmatch '^[A-Za-z]:\\') { throw 'Expected an absolute local Windows path' }
  $full = [IO.Path]::GetFullPath($Path)
  if ($full.StartsWith('\\') -or $full.TrimEnd('\') -eq [IO.Path]::GetPathRoot($full).TrimEnd('\')) { throw 'The installation cannot be a volume root' }
  $item = Get-Item -LiteralPath $full -Force
  while ($null -ne $item) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse points are not eligible for installation recovery' }
    if ($item -is [IO.FileInfo]) { $item = $item.Directory } else { $item = $item.Parent }
  }
  return $full.TrimEnd('\')
}

function Assert-RecoveryDirectory([string]$Directory, [string]$DataDirectory) {
  if ($Directory -notmatch '^[A-Za-z]:\\') { throw 'Expected an absolute local installation directory' }
  $directoryPath = [IO.Path]::GetFullPath($Directory).TrimEnd('\')
  if ($directoryPath -ieq [IO.Path]::GetPathRoot($Directory).TrimEnd('\')) { throw 'The installation cannot be a volume root' }
  $windows = [Environment]::GetFolderPath([Environment+SpecialFolder]::Windows)
  if (-not $windows) { $windows = $env:WINDIR }
  if ($windows) {
    $windows = [IO.Path]::GetFullPath($windows).TrimEnd('\')
    if ($directoryPath -ieq $windows -or $directoryPath.StartsWith($windows + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'The Windows directory cannot be recovered as an application installation' }
  }
  $protected = @($env:ProgramFiles,${env:ProgramFiles(x86)},$env:ProgramW6432,$env:PUBLIC)
  foreach ($folder in @('UserProfile','DesktopDirectory','MyDocuments','LocalApplicationData','ApplicationData','CommonApplicationData','ProgramFiles','ProgramFilesX86','CommonProgramFiles','CommonProgramFilesX86','Programs','CommonPrograms','StartMenu','CommonStartMenu','CommonDesktopDirectory','CommonDocuments','MyPictures','MyMusic','MyVideos')) {
    $value = [Environment]::GetFolderPath([Environment+SpecialFolder]$folder)
    if ($value) { $protected += $value }
  }
  $local = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
  if ($local) { $protected += Join-Path $local 'Programs' }
  $profile = [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
  if ($profile) { $protected += @((Split-Path -Parent $profile),(Join-Path $profile 'Downloads')) }
  foreach ($value in $protected) {
    if ($value -and $directoryPath -ieq [IO.Path]::GetFullPath($value).TrimEnd('\')) { throw 'A system or shared directory root cannot be recovered as an application installation' }
  }
  $data = [IO.Path]::GetFullPath($DataDirectory).TrimEnd('\')
  if ($directoryPath -ieq $data -or $directoryPath.StartsWith($data + '\',[StringComparison]::OrdinalIgnoreCase) -or $data.StartsWith($directoryPath + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Application and user data directories overlap' }
}

function Get-RecoveryCandidate([string]$Descriptor, $Identities) {
  $connection = Get-Content -LiteralPath $Descriptor -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($connection.schema -ne 1 -or $connection.product -cne 'MediaSail') { throw 'The connection descriptor does not identify MediaSail' }
  $data = [IO.Path]::GetFullPath((Split-Path -Parent $Descriptor)).TrimEnd('\')
  if ($connection.dataDir -and [IO.Path]::GetFullPath($connection.dataDir).TrimEnd('\') -ine $data) {
    # The stable AppData descriptor is a public mirror after library migration.
    # Resolve it only through the committed library choice and matching marker.
    $location = Get-Content -LiteralPath (Join-Path $data 'library-location.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($location.schema -ne 1 -or $location.product -cne 'MediaSail' -or $location.state -cne 'ready') { throw 'The library location is not committed' }
    $libraryRoot = [IO.Path]::GetFullPath($location.libraryRoot).TrimEnd('\')
    $marker = Get-Content -LiteralPath (Join-Path $libraryRoot '.mediasail-library.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($marker.schema -ne 1 -or $marker.product -cne 'MediaSail' -or $marker.state -cne 'ready' -or $marker.libraryId -cne $location.libraryId -or $connection.libraryId -cne $location.libraryId) { throw 'The selected library identity does not match' }
    if ([IO.Path]::GetFullPath($connection.libraryRoot).TrimEnd('\') -ine $libraryRoot) { throw 'The connection library directory does not match' }
    $actualData = Join-Path $libraryRoot 'runtime'
    $canonicalFile = Join-Path $actualData 'agent-connection.json'
    if ([IO.Path]::GetFullPath($connection.dataDir).TrimEnd('\') -ine $actualData -or [IO.Path]::GetFullPath($connection.connectionFile) -ine $canonicalFile) { throw 'The canonical connection location does not match' }
    $canonical = Get-Content -LiteralPath $canonicalFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($canonical.schema -ne 1 -or $canonical.product -cne 'MediaSail' -or $canonical.libraryId -cne $location.libraryId -or $canonical.instanceId -cne $connection.instanceId -or $canonical.executable -ine $connection.executable -or $canonical.version -cne $connection.version) { throw 'The mirrored connection does not match the library instance' }
    $connection = $canonical
    $data = $actualData
  }
  $exe = Assert-PlainPath $connection.executable
  if ([IO.Path]::GetFileName($exe) -cne 'MediaSail.exe') { throw 'Unexpected application filename' }
  $directory = Split-Path -Parent $exe
  Assert-RecoveryDirectory $directory $data
  $uninstaller = Assert-PlainPath (Join-Path $directory 'Uninstall MediaSail.exe')
  $asar = Assert-PlainPath (Join-Path $directory 'resources\app.asar')
  $version = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
  $identity = @($Identities.releases | Where-Object { $_.version -eq $connection.version -and ($_.version -eq $version -or ($_.version + '.0') -eq $version) })
  if ($identity.Count -ne 1) { throw 'This original application version is not in the verified recovery list' }
  foreach ($entry in @(@($exe,'executable'),@($uninstaller,'uninstaller'),@($asar,'asar'))) {
    $hash = Get-RecoveryHash $entry[0]
    $expected = $identity[0].sha256.($entry[1])
    if ($expected -notmatch '^[0-9a-f]{64}$' -or $hash -cne $expected) { throw ('Original application identity failed: ' + $entry[1]) }
  }
  return [pscustomobject]@{ directory=$directory; executable=$exe; uninstaller=$uninstaller; version=$identity[0].version }
}

function Get-RegistrySnapshot([Microsoft.Win32.RegistryKey]$Root, [string]$Name) {
  $key = $Root.OpenSubKey($Name)
  if ($null -eq $key) { return @{ exists=$false; values=@(); children=@() } }
  try {
    $values = @($key.GetValueNames() | ForEach-Object { @{ name=$_; kind=[string]$key.GetValueKind($_); value=$key.GetValue($_,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) } })
    $children = @($key.GetSubKeyNames() | ForEach-Object { @{ name=$_; tree=(Get-RegistrySnapshot $key $_) } })
    return @{ exists=$true; values=$values; children=$children }
  } finally { $key.Dispose() }
}

function Set-RegistrySnapshot([Microsoft.Win32.RegistryKey]$Root, [string]$Name, $Snapshot) {
  $Root.DeleteSubKeyTree($Name,$false)
  if (-not $Snapshot.exists) { return }
  $key = $Root.CreateSubKey($Name)
  try {
    foreach ($value in $Snapshot.values) {
      $kind = [Microsoft.Win32.RegistryValueKind]$value.kind
      $data = $value.value
      switch ($value.kind) {
        'Binary' { $data = [byte[]]$data }
        'DWord' { $data = [int]$data }
        'QWord' { $data = [long]$data }
        'MultiString' { $data = [string[]]$data }
      }
      $key.SetValue($value.name,$data,$kind)
    }
    foreach ($child in $Snapshot.children) { Set-RegistrySnapshot $key $child.name $child.tree }
  } finally { $key.Dispose() }
}

function Write-RecoveryResult([string]$State, $Candidate, [string]$Message) {
  $lines = @('[recovery]', ('state=' + $State), 'registryScope=HKCU64 MediaSail installation and uninstallation keys only')
  if ($null -ne $Candidate) { $lines += @(('directory=' + $Candidate.directory), ('version=' + $Candidate.version)) }
  if ($Message) { $lines += 'message=' + ($Message -replace '[\r\n]', ' ') }
  [IO.File]::WriteAllText($ResultFile,($lines -join "`r`n") + "`r`n",[Text.Encoding]::Unicode)
}

function Assert-RecoveryRegistration([string]$Location, [string]$Command, $Candidate) {
  if ($Location -and [IO.Path]::GetFullPath($Location).TrimEnd('\') -ine $Candidate.directory) { throw 'Existing installation registration points elsewhere' }
  if ($Command -and $Command -ine ('"' + $Candidate.uninstaller + '" /currentuser')) { throw 'Existing uninstaller registration is inconsistent' }
}

function Assert-RecoveryKeys {
  # The caller supplies the build's stable identifiers; refuse arbitrary registry paths.
  if ($InstallKey -cne 'Software\f524de6d-ce52-54ca-a07e-a51e0d556196' -or $UninstallKey -cne 'Software\Microsoft\Windows\CurrentVersion\Uninstall\f524de6d-ce52-54ca-a07e-a51e0d556196') { throw 'Unexpected MediaSail registry identity' }
}

if ($LibraryOnly) { return }
try {
  Assert-RecoveryKeys
  $registry = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64)
  try {
    if ($Mode -eq 'Rollback') {
      $state = Get-Content -LiteralPath $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($state.installKey -cne $InstallKey -or $state.uninstallKey -cne $UninstallKey -or $state.status -ne 'staged') { throw 'Invalid recovery rollback record' }
      Set-RegistrySnapshot $registry $InstallKey $state.install
      Set-RegistrySnapshot $registry $UninstallKey $state.uninstall
      $state.status = 'rolled-back'
      [IO.File]::WriteAllText($StateFile,($state | ConvertTo-Json -Depth 50),[Text.Encoding]::UTF8)
      Write-RecoveryResult 'rolled-back' $null ''
      exit 0
    }
    $identities = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'installer-identities.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $candidate = Get-RecoveryCandidate $ConnectionFile $identities
    if ($ExpectedDirectory -and $candidate.directory -ine $ExpectedDirectory) { throw 'The original installation location changed during the update' }
    $install = $registry.OpenSubKey($InstallKey)
    $uninstall = $registry.OpenSubKey($UninstallKey)
    try {
      $location = if ($install) { $install.GetValue('InstallLocation','') } else { '' }
      $command = if ($uninstall) { $uninstall.GetValue('UninstallString','') } else { '' }
      Assert-RecoveryRegistration $location $command $candidate
    } finally { if ($install) { $install.Dispose() }; if ($uninstall) { $uninstall.Dispose() } }
    if ($Mode -eq 'Stage') {
      if (Test-Path -LiteralPath $StateFile) { throw 'Recovery registry backup already exists' }
      $state = @{ schema=1; status='staged'; installKey=$InstallKey; uninstallKey=$UninstallKey; directory=$candidate.directory; install=(Get-RegistrySnapshot $registry $InstallKey); uninstall=(Get-RegistrySnapshot $registry $UninstallKey) }
      [IO.File]::WriteAllText($StateFile,($state | ConvertTo-Json -Depth 50),[Text.Encoding]::UTF8)
      try {
        $install = $registry.CreateSubKey($InstallKey)
        try { $install.SetValue('InstallLocation',$candidate.directory); $install.SetValue('KeepShortcuts','true'); $install.SetValue('ShortcutName','MediaSail') } finally { $install.Dispose() }
        $uninstall = $registry.CreateSubKey($UninstallKey)
        try { $uninstall.SetValue('UninstallString',('"' + $candidate.uninstaller + '" /currentuser')); $uninstall.SetValue('DisplayVersion',$candidate.version) } finally { $uninstall.Dispose() }
      } catch {
        Set-RegistrySnapshot $registry $InstallKey $state.install
        Set-RegistrySnapshot $registry $UninstallKey $state.uninstall
        throw
      }
    }
    Write-RecoveryResult 'verified' $candidate ''
  } finally { $registry.Dispose() }
  exit 0
} catch {
  if ($ResultFile) { Write-RecoveryResult 'error' $null $_.Exception.Message }
  Write-Error $_ -ErrorAction Continue
  exit 2
}

