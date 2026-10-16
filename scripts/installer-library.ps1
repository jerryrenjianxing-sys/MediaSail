param(
  [ValidateSet('Validate','Commit','Cache')][string]$Mode='Validate',
  [string]$Root,
  [Parameter(Mandatory=$true)][string]$BootstrapRoot,
  [Parameter(Mandatory=$true)][string]$InstallDirectory,
  [string]$InstallerFile,
  [string]$ResultFile,
  [switch]$LibraryOnly
)
$ErrorActionPreference='Stop'
function Test-LibraryWithin([string]$Parent,[string]$Child) {
  $p=[IO.Path]::GetFullPath($Parent).TrimEnd('\')
  $c=[IO.Path]::GetFullPath($Child).TrimEnd('\')
  return $c -ieq $p -or $c.StartsWith($p+'\',[StringComparison]::OrdinalIgnoreCase)
}
function Assert-LibraryRoot([string]$Candidate,[string]$Bootstrap,[string]$Program) {
  if($Candidate -notmatch '^[A-Za-z]:\\' -or $Candidate -match '[\r\n\x00"]'){throw '请选择本地磁盘内的完整资料库路径。'}
  $full=[IO.Path]::GetFullPath($Candidate).TrimEnd('\')
  if($full -ieq [IO.Path]::GetPathRoot($Candidate).TrimEnd('\')){throw '请选择专用资料库目录，不能使用磁盘根目录。'}
  foreach($protected in @($Bootstrap,$Program,[Environment]::GetFolderPath('LocalApplicationData'),[Environment]::GetFolderPath('ApplicationData'),$env:ProgramFiles,${env:ProgramFiles(x86)},$env:WINDIR)){
    if($protected -and ((Test-LibraryWithin $protected $full) -or (Test-LibraryWithin $full $protected))){throw '资料库不能位于 AppData、程序或系统目录中。'}
  }
  $ancestor=$full
  while($ancestor){
    if(Test-Path -LiteralPath $ancestor){$item=Get-Item -LiteralPath $ancestor -Force;if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw '资料库路径不能经过目录链接或联接点。'}}
    $parent=[IO.Path]::GetDirectoryName($ancestor);if($parent -eq $ancestor){break};$ancestor=$parent
  }
  if(Test-Path -LiteralPath $full){
    if(-not (Get-Item -LiteralPath $full).PSIsContainer){throw '资料库路径不是目录。'}
    $entries=@(Get-ChildItem -LiteralPath $full -Force)
    if($entries.Count -gt 0){
      $marker=Get-Content -LiteralPath (Join-Path $full '.mediasail-library.json') -Raw -Encoding UTF8 | ConvertFrom-Json
      if($marker.schema -ne 1 -or $marker.product -cne 'MediaSail' -or $marker.state -notin @('ready','initializing') -or $marker.libraryId -notmatch '^[a-zA-Z0-9-]{8,80}$'){throw '所选目录已有其他内容，请选择新目录或有效的 MediaSail 资料库。'}
      if($marker.state -eq 'ready'){foreach($name in @('workspace','runtime')){if(-not (Test-Path -LiteralPath (Join-Path $full $name) -PathType Container)){throw '所选资料库目录不完整，请检查原位置。'}}}
      elseif($marker.owner -cne 'nsis'){throw '所选目录不是本安装器准备的资料库。'}
    }
  }
  return $full
}
if($LibraryOnly){return}
try {
  if($Mode -eq 'Cache'){
    if(-not $InstallerFile -or -not (Test-Path -LiteralPath $InstallerFile -PathType Leaf)){throw '无法找到当前安装包，未报告安装成功。'}
    $locationFile=Join-Path $BootstrapRoot 'library-location.json'
    $selectionFile=Join-Path $BootstrapRoot 'library-selection.ini'
    $libraryRoot=$null;$ready=$false
    if(Test-Path -LiteralPath $locationFile){$location=Get-Content -LiteralPath $locationFile -Raw -Encoding UTF8|ConvertFrom-Json;if($location.schema -ne 1 -or $location.product -cne 'MediaSail' -or $location.state -cne 'ready'){throw '资料库位置尚未提交，不能写入更新缓存。'};$libraryRoot=Assert-LibraryRoot $location.libraryRoot $BootstrapRoot $InstallDirectory;$identity=Get-Content -LiteralPath (Join-Path $libraryRoot '.mediasail-library.json') -Raw -Encoding UTF8|ConvertFrom-Json;if($identity.state -cne 'ready' -or $identity.libraryId -cne $location.libraryId){throw '资料库身份已经变化，未覆盖安装包缓存。'};$ready=$true}
    elseif(Test-Path -LiteralPath $selectionFile){$choice=Get-Content -LiteralPath $selectionFile -Encoding UTF8;$rootLine=@($choice|Where-Object{$_ -match '^root='});if($rootLine.Count -ne 1){throw '安装时选择的资料库位置无效。'};$libraryRoot=Assert-LibraryRoot $rootLine[0].Substring(5) $BootstrapRoot $InstallDirectory}
    if($libraryRoot){$destination=Join-Path $libraryRoot 'runtime\update-cache\mediasail-updater\installer.exe'}
    else{$destination=Join-Path $BootstrapRoot 'update-cache\mediasail-updater\installer.exe'}
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try{$stream=[IO.File]::OpenRead($InstallerFile);try{$expected=([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose()}}
    finally{$algorithm.Dispose()}
    if($libraryRoot -and -not $ready){
      [IO.Directory]::CreateDirectory($libraryRoot)|Out-Null
      $markerFile=Join-Path $libraryRoot '.mediasail-library.json';$marker=$null
      if(Test-Path -LiteralPath $markerFile){$marker=Get-Content -LiteralPath $markerFile -Raw -Encoding UTF8|ConvertFrom-Json}
      if($marker -and $marker.state -eq 'ready'){$ready=$true}
      else{
        $id=if($marker -and $marker.owner -ceq 'nsis'){$marker.libraryId}else{[guid]::NewGuid().ToString()}
        $seed=@{schema=1;product='MediaSail';libraryId=$id;state='initializing';owner='nsis';cache=@{path='runtime/update-cache/mediasail-updater/installer.exe';sha256=$expected}}
        [IO.File]::WriteAllText($markerFile,($seed|ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding($false)))
      }
    }
    if([IO.Path]::GetFullPath($InstallerFile) -ine [IO.Path]::GetFullPath($destination)){
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))|Out-Null
      $temporary=$destination+'.'+$PID+'.tmp';[IO.File]::Copy($InstallerFile,$temporary,$true)
      $algorithm=[Security.Cryptography.SHA256]::Create();try{$stream=[IO.File]::OpenRead($temporary);try{$actual=([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose()}}finally{$algorithm.Dispose()}
      if($actual -cne $expected){throw '安装包缓存校验失败，原缓存已保留。'}
      if(Test-Path -LiteralPath $destination){[IO.File]::Replace($temporary,$destination,$null)}else{[IO.File]::Move($temporary,$destination)}
    }
    if($ResultFile){[IO.File]::WriteAllText($ResultFile,"[library]`r`nstate=ok`r`ncache=$destination`r`nsha256=$expected`r`n",[Text.Encoding]::Unicode)}
    exit 0
  }
  $selected=Assert-LibraryRoot $Root $BootstrapRoot $InstallDirectory
  if($Mode -eq 'Commit'){
    $location=Join-Path $BootstrapRoot 'library-location.json'
    $selection=Join-Path $BootstrapRoot 'library-selection.ini'
    # Installation and update must never replace an existing user's choice.
    if(-not (Test-Path -LiteralPath $location) -and -not (Test-Path -LiteralPath $selection)){
      [IO.Directory]::CreateDirectory($BootstrapRoot)|Out-Null
      $temp=$selection+'.'+$PID+'.tmp'
      [IO.File]::WriteAllText($temp,"[library]`r`nroot=$selected`r`n",(New-Object Text.UTF8Encoding($false)))
      [IO.File]::Move($temp,$selection)
    }
  }
  if($ResultFile){[IO.File]::WriteAllText($ResultFile,"[library]`r`nstate=ok`r`nroot=$selected`r`n",[Text.Encoding]::Unicode)}
  exit 0
} catch {
  if($ResultFile){[IO.File]::WriteAllText($ResultFile,"[library]`r`nstate=error`r`nmessage=$($_.Exception.Message.Replace("`r",' ').Replace("`n",' '))`r`n",[Text.Encoding]::Unicode)}
  Write-Error $_.Exception.Message -ErrorAction Continue
  exit 2
}
