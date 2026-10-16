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
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr SetActiveWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetActiveWindow();
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from,uint to,bool attach);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder text,int count);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder text,int count);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int message,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 public struct Rect { public int Left,Top,Right,Bottom; }
 public static bool ActivateDialog(IntPtr h) {
  uint owner; uint target=GetWindowThreadProcessId(h,out owner),current=GetCurrentThreadId();
  bool attached=current!=target && AttachThreadInput(current,target,true);
  try {
   SetForegroundWindow(h); SetActiveWindow(h);
   return GetForegroundWindow()==h || GetActiveWindow()==h;
  } finally { if(attached) AttachThreadInput(current,target,false); }
 }
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
 $buttons=@($children|Where-Object{$_.class -eq 'Button' -and $_.text.Contains('选择位置并迁移') -and [LibraryFixtureWindow]::IsWindowVisible($_.handle) -and [LibraryFixtureWindow]::IsWindowEnabled($_.handle)})
 if($buttons.Count -ne 1){return $true}
 if(-not (Test-Path -LiteralPath $Screenshot)){
  $rect=[LibraryFixtureWindow+Rect]::new();[void][LibraryFixtureWindow]::GetWindowRect($handle,[ref]$rect)
  $bitmap=[Drawing.Bitmap]::new($rect.Right-$rect.Left,$rect.Bottom-$rect.Top);$graphics=[Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
  try{[void][LibraryFixtureWindow]::PrintWindow($handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
  try{$bitmap.Save($Screenshot,[Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
 }
 $activated=[LibraryFixtureWindow]::ActivateDialog($handle);$queued=$false
 if($activated){$queued=[LibraryFixtureWindow]::PostMessage($buttons[0].handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)}
 $deadline=[DateTime]::UtcNow.AddMilliseconds(1500)
 while($queued -and [LibraryFixtureWindow]::IsWindow($handle) -and [LibraryFixtureWindow]::IsWindowVisible($handle) -and [LibraryFixtureWindow]::IsWindow($buttons[0].handle) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 50}
 $confirmed=$queued -and (-not [LibraryFixtureWindow]::IsWindow($handle) -or -not [LibraryFixtureWindow]::IsWindowVisible($handle))
 $fallbackQueued=$false;$buttonId=0
 if(-not $confirmed -and [LibraryFixtureWindow]::IsWindow($handle) -and [LibraryFixtureWindow]::IsWindowVisible($handle) -and [LibraryFixtureWindow]::IsWindow($buttons[0].handle) -and [LibraryFixtureWindow]::IsWindowEnabled($buttons[0].handle)){
  # A native Button's BN_CLICKED notification is a fallback only for this exact
  # verified label, live control ID and same-process direct parent. No fixed
  # NSIS ID is assumed for Electron's native confirmation dialog.
  $button=$buttons[0].handle;$parent=[LibraryFixtureWindow]::GetParent($button)
  [uint32]$buttonOwner=0;[uint32]$parentOwner=0
  [void][LibraryFixtureWindow]::GetWindowThreadProcessId($button,[ref]$buttonOwner)
  [void][LibraryFixtureWindow]::GetWindowThreadProcessId($parent,[ref]$parentOwner)
  $kindNow=[Text.StringBuilder]::new(256);$textNow=[Text.StringBuilder]::new(2048)
  [void][LibraryFixtureWindow]::GetClassName($button,$kindNow,256);[void][LibraryFixtureWindow]::GetWindowText($button,$textNow,2048)
  $buttonId=[LibraryFixtureWindow]::GetDlgCtrlID($button)
  if($buttonOwner -eq $ApplicationPid -and $parentOwner -eq $ApplicationPid -and $buttonId -gt 0 -and $buttonId -le 65535 -and $kindNow.ToString() -eq 'Button' -and $textNow.ToString().Contains('选择位置并迁移')){
   $fallbackQueued=[LibraryFixtureWindow]::PostMessage($parent,0x111,[IntPtr]$buttonId,$button)
   $deadline=[DateTime]::UtcNow.AddMilliseconds(1500)
   while($fallbackQueued -and [LibraryFixtureWindow]::IsWindow($handle) -and [LibraryFixtureWindow]::IsWindowVisible($handle) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 50}
   $confirmed=$fallbackQueued -and (-not [LibraryFixtureWindow]::IsWindow($handle) -or -not [LibraryFixtureWindow]::IsWindowVisible($handle))
  }
 }
 $observed.Add(@{pid=$ApplicationPid;action='choose-location-and-migrate';activated=$activated;queued=$queued;fallbackQueued=$fallbackQueued;buttonId=$buttonId;confirmed=$confirmed;screenshot=$Screenshot});return $true
}
[void][LibraryFixtureWindow]::EnumWindows($callback,[IntPtr]::Zero)
ConvertTo-Json -InputObject @($observed.ToArray()) -Depth 5 -Compress
