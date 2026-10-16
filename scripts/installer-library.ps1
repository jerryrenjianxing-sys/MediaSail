param(
  [ValidateSet('Cache')][string]$Mode='Cache',
  [Parameter(Mandatory=$true)][string]$BootstrapRoot,
  [Parameter(Mandatory=$true)][string]$Version,
  [Parameter(Mandatory=$true)][string]$InstallerFile,
  [string]$ResultFile
)
$ErrorActionPreference='Stop'
function Assert-PlainCachePath([string]$Path) {
  $full=[IO.Path]::GetFullPath($Path)
  if($full -notmatch '^[A-Za-z]:\\' -or $full -match '[\r\n\x00"]'){throw '安装缓存必须使用本地磁盘内的完整路径。'}
  $ancestor=$full
  while($ancestor){
    if(Test-Path -LiteralPath $ancestor){$item=Get-Item -LiteralPath $ancestor -Force;if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw '安装缓存路径不能经过目录或文件链接。'}}
    $parent=[IO.Path]::GetDirectoryName($ancestor);if($parent -eq $ancestor){break};$ancestor=$parent
  }
  return $full
}
function Installer-Hash([string]$File) {
  $algorithm=[Security.Cryptography.SHA256]::Create()
  try{$stream=[IO.File]::OpenRead($File);try{return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose()}}
  finally{$algorithm.Dispose()}
}
function Commit-CacheFile([string]$Temporary,[string]$Destination) {
  [void](Assert-PlainCachePath $Destination)
  if(Test-Path -LiteralPath $Destination){[IO.File]::Replace($Temporary,$Destination,[NullString]::Value)}else{[IO.File]::Move($Temporary,$Destination)}
}
try {
  if($Version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$'){throw '安装缓存版本无效。'}
  if(-not (Test-Path -LiteralPath $InstallerFile -PathType Leaf)){throw '无法找到当前安装包，未报告缓存成功。'}
  $bootstrap=Assert-PlainCachePath $BootstrapRoot
  if($bootstrap.TrimEnd('\') -ieq [IO.Path]::GetPathRoot($bootstrap).TrimEnd('\')){throw '安装缓存不能使用磁盘根目录。'}
  # Never read an old location, selection, library or workspace. Only this exact
  # version's verified installer is staged for later single-file adoption.
  $staging=Assert-PlainCachePath (Join-Path $bootstrap ('installer-staging\'+$Version))
  $destination=Join-Path $staging 'installer.exe';$receiptFile=Join-Path $staging 'baseline.json'
  [void](Assert-PlainCachePath $destination);[void](Assert-PlainCachePath $receiptFile)
  $source=[IO.Path]::GetFullPath($InstallerFile)
  if($source -ieq [IO.Path]::GetFullPath($destination)){throw '安装来源与暂存目标不能相同。'}
  $expected=Installer-Hash $source;$bytes=([IO.FileInfo]::new($source)).Length
  [void][IO.Directory]::CreateDirectory($staging)
  $suffix='.'+$PID+'.'+[guid]::NewGuid().ToString('N')+'.tmp'
  $temporary=$destination+$suffix;$receiptTemporary=$receiptFile+$suffix
  try{
    [IO.File]::Copy($source,$temporary,$false)
    if((Installer-Hash $temporary) -cne $expected -or ([IO.FileInfo]::new($temporary)).Length -ne $bytes){throw '本次安装包暂存校验失败，旧资料未改动。'}
    $receipt=@{schema=1;product='MediaSail';version=$Version;sha256=$expected;bytes=$bytes;createdAt=[DateTime]::UtcNow.ToString('o')}
    [IO.File]::WriteAllText($receiptTemporary,($receipt|ConvertTo-Json -Depth 3),[Text.UTF8Encoding]::new($false))
    Commit-CacheFile $temporary $destination
    Commit-CacheFile $receiptTemporary $receiptFile
  }finally{
    foreach($file in @($temporary,$receiptTemporary)){if([IO.File]::Exists($file)){[void](Assert-PlainCachePath $file);[IO.File]::Delete($file)}}
  }
  if($ResultFile){[IO.File]::WriteAllText($ResultFile,"[cache]`r`nstate=ok`r`nversion=$Version`r`ncache=$destination`r`nsha256=$expected`r`n",[Text.Encoding]::Unicode)}
  exit 0
}catch{
  if($ResultFile){[IO.File]::WriteAllText($ResultFile,"[cache]`r`nstate=error`r`nmessage=$($_.Exception.Message.Replace("`r",' ').Replace("`n",' '))`r`n",[Text.Encoding]::Unicode)}
  Write-Error $_.Exception.Message -ErrorAction Continue
  exit 2
}
