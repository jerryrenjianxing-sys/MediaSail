param([int]$ApplicationPid,[string]$ExpectedExecutable,[string]$Screenshot)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows'){throw 'Disposable GitHub-hosted Windows only'}
$allowedRoot=[IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\')+'\'
$expected=[IO.Path]::GetFullPath($ExpectedExecutable)
if(-not $expected.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($expected) -cne 'MediaSail.exe'){throw 'Unexpected application fixture path'}
$process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ApplicationPid)
if($null -eq $process){Write-Output '[]';exit 0}
if($process.ExecutablePath -ine $expected){throw 'Application is not the verified installed fixture'}
$captureRoot=[IO.Path]::GetFullPath((Join-Path $env:GITHUB_WORKSPACE 'installer-evidence')).TrimEnd('\')+'\'
if(-not [IO.Path]::GetFullPath($Screenshot).StartsWith($captureRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Screenshot must be fixture evidence'}
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public class LibraryFixtureWindow {
 public delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr value);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,EnumProc callback,IntPtr value);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder text,int count);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder text,int count);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int message,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 public struct Rect { public int Left,Top,Right,Bottom; }
}
'@
$observed=[System.Collections.Generic.List[object]]::new()
$callback=[LibraryFixtureWindow+EnumProc]{param($handle,$unused)
 [uint32]$owner=0;[void][LibraryFixtureWindow]::GetWindowThreadProcessId($handle,[ref]$owner)
 if($owner -ne $ApplicationPid -or -not [LibraryFixtureWindow]::IsWindowVisible($handle)){return $true}
 $children=[System.Collections.Generic.List[object]]::new()
 $childCallback=[LibraryFixtureWindow+EnumProc]{param($child,$unused2)
  $text=[Text.StringBuilder]::new(2048);$kind=[Text.StringBuilder]::new(256)
  [void][LibraryFixtureWindow]::GetWindowText($child,$text,2048);[void][LibraryFixtureWindow]::GetClassName($child,$kind,256)
  $children.Add(@{handle=$child;text=$text.ToString();class=$kind.ToString()});return $true
 }
 [void][LibraryFixtureWindow]::EnumChildWindows($handle,$childCallback,[IntPtr]::Zero)
 $buttons=@($children|Where-Object{$_.class -eq 'Button' -and $_.text.Contains('选择位置并迁移')})
 if($buttons.Count -ne 1){return $true}
 if(-not (Test-Path -LiteralPath $Screenshot)){
  $rect=[LibraryFixtureWindow+Rect]::new();[void][LibraryFixtureWindow]::GetWindowRect($handle,[ref]$rect)
  $bitmap=[Drawing.Bitmap]::new($rect.Right-$rect.Left,$rect.Bottom-$rect.Top);$graphics=[Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
  try{[void][LibraryFixtureWindow]::PrintWindow($handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
  try{$bitmap.Save($Screenshot,[Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
 }
 $confirmed=[LibraryFixtureWindow]::PostMessage($buttons[0].handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)
 $observed.Add(@{pid=$ApplicationPid;action='choose-location-and-migrate';confirmed=$confirmed;screenshot=$Screenshot});return $true
}
[void][LibraryFixtureWindow]::EnumWindows($callback,[IntPtr]::Zero)
ConvertTo-Json -InputObject @($observed.ToArray()) -Depth 5 -Compress
