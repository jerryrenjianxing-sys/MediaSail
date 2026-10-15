param([int]$InstallerPid,[string]$ExpectedExecutable,[string]$Screenshot)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
if($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows'){throw 'Disposable GitHub-hosted Windows only'}
$allowedRoot=[IO.Path]::GetFullPath((Join-Path $env:GITHUB_WORKSPACE 'release-input\candidate')).TrimEnd('\')+'\'
$expected=[IO.Path]::GetFullPath($ExpectedExecutable)
if(-not $expected.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($expected) -notmatch '^MediaSail-0\.5\.[0-9]+-win-x64-Setup\.exe$'){throw 'Unexpected installer fixture path'}
$process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$InstallerPid)
if($null -eq $process){Write-Output '[]';exit 0}
if($process.ExecutablePath -ine $expected){throw 'Installer process is not the verified candidate fixture'}
$screenshotRoot=[IO.Path]::GetFullPath((Join-Path $env:GITHUB_WORKSPACE 'installer-evidence')).TrimEnd('\')+'\'
if(-not [IO.Path]::GetFullPath($Screenshot).StartsWith($screenshotRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Screenshot must be inside fixture evidence'}
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public class InstallerFailureWindow {
 public delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr value);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,EnumProc callback,IntPtr value);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder text,int count);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder text,int count);
 [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int message,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 public struct Rect { public int Left,Top,Right,Bottom; }
}
'@
$observed=[System.Collections.Generic.List[object]]::new()
$callback=[InstallerFailureWindow+EnumProc]{param($handle,$unused)
 [uint32]$owner=0;[void][InstallerFailureWindow]::GetWindowThreadProcessId($handle,[ref]$owner)
 if($owner -ne $InstallerPid -or -not [InstallerFailureWindow]::IsWindowVisible($handle)){return $true}
 $class=[Text.StringBuilder]::new(256);[void][InstallerFailureWindow]::GetClassName($handle,$class,256)
 if($class.ToString() -ne '#32770'){return $true}
 $children=[System.Collections.Generic.List[object]]::new()
 $childCallback=[InstallerFailureWindow+EnumProc]{param($child,$unused2)
  $text=[Text.StringBuilder]::new(2048);$kind=[Text.StringBuilder]::new(256)
  [void][InstallerFailureWindow]::GetWindowText($child,$text,2048);[void][InstallerFailureWindow]::GetClassName($child,$kind,256)
  $children.Add(@{handle=$child;text=$text.ToString();class=$kind.ToString();id=[InstallerFailureWindow]::GetDlgCtrlID($child)})
  return $true
 }
 [void][InstallerFailureWindow]::EnumChildWindows($handle,$childCallback,[IntPtr]::Zero)
 $message=($children | Where-Object {$_.class -eq 'Static'} | ForEach-Object {$_.text}) -join ' | '
 # The native builder tries the actual old uninstaller five times, then offers
 # Retry/Cancel before reaching its final error handler. Cancel only that known
 # fixture dialog; the next known uninstall-failed dialog is acknowledged with OK.
 # Other recovery/copy errors remain untouched and make the test fail.
 $action='';$buttonId=0;$capture=$Screenshot
 if($message -match 'Failed to uninstall old application files|\u5378\u8f7d\u65e7.*\u5931\u8d25|\u7121\u6cd5.*\u820a\u7684\u61c9\u7528'){$action='confirm-uninstall-failed';$buttonId=1}
 elseif($message -match 'MediaSail cannot be closed'){$action='cancel-exhausted-uninstall-retries';$buttonId=2;$capture=$Screenshot -replace '\.png$','-retry-cancel.png'}
 else{return $true}
 $buttons=@($children | Where-Object {$_.class -eq 'Button' -and $_.id -eq $buttonId})
 if($buttons.Count -ne 1){throw 'Expected one known fixture error button'}
 if(-not (Test-Path -LiteralPath $capture)){
  $rect=[InstallerFailureWindow+Rect]::new();[void][InstallerFailureWindow]::GetWindowRect($handle,[ref]$rect)
  $bitmap=[Drawing.Bitmap]::new($rect.Right-$rect.Left,$rect.Bottom-$rect.Top)
  $graphics=[Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
  try{[void][InstallerFailureWindow]::PrintWindow($handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
  try{$bitmap.Save($capture,[Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
 }
 $confirmed=[InstallerFailureWindow]::PostMessage($buttons[0].handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)
 $observed.Add(@{pid=$InstallerPid;message=$message;action=$action;confirmed=$confirmed;screenshot=$capture})
 return $true
}
[void][InstallerFailureWindow]::EnumWindows($callback,[IntPtr]::Zero)
ConvertTo-Json -InputObject @($observed.ToArray()) -Depth 5 -Compress
