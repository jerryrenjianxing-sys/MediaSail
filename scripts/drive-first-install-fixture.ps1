param(
 [Parameter(Mandatory=$true)][int]$InstallerPid,
 [Parameter(Mandatory=$true)][string]$ExpectedExecutable,
 [Parameter(Mandatory=$true)][string]$ProgramDirectory,
 [Parameter(Mandatory=$true)][string]$LibraryRoot,
 [Parameter(Mandatory=$true)][string]$EvidenceDirectory
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
if($env:GITHUB_ACTIONS -cne 'true' -or $env:RUNNER_ENVIRONMENT -cne 'github-hosted' -or $env:RUNNER_OS -cne 'Windows' -or $env:GITHUB_RUN_ID -notmatch '^\d+$'){throw 'Ephemeral GitHub-hosted Windows only; never run on a user PC'}
$workspace=[IO.Path]::GetFullPath($env:GITHUB_WORKSPACE)
$fixture=[IO.Path]::GetFullPath((Join-Path $env:RUNNER_TEMP ('mediasail-first-install-'+$env:GITHUB_RUN_ID)))
$expected=[IO.Path]::GetFullPath((Join-Path $workspace 'release-input\candidate\MediaSail-0.5.2-win-x64-Setup.exe'))
if([IO.Path]::GetFullPath($ExpectedExecutable) -ine $expected -or [IO.Path]::GetFullPath($ProgramDirectory) -ine (Join-Path $fixture '中文 程序\MediaSail') -or [IO.Path]::GetFullPath($LibraryRoot) -ine (Join-Path $fixture '中文 资料库') -or [IO.Path]::GetFullPath($EvidenceDirectory) -ine (Join-Path $workspace 'installer-evidence\first-install')){throw 'Unexpected fixture scope'}
$process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$InstallerPid)
if(-not $process -or $process.ExecutablePath -ine $expected){throw 'Installer PID is not the exact downloaded fixture'}
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public static class FirstInstallWindow {
 public delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,EnumProc f,IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",EntryPoint="SendMessageTimeoutW",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr ReadTextMessage(IntPtr h,uint m,UIntPtr w,StringBuilder text,uint flags,uint timeout,out UIntPtr result);
 [DllImport("user32.dll",EntryPoint="SendMessageTimeoutW",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr WriteTextMessage(IntPtr h,uint m,UIntPtr w,string text,uint flags,uint timeout,out UIntPtr result);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 public struct Rect{public int Left,Top,Right,Bottom;}
}
'@
function Window-Text([IntPtr]$handle){
 [uint32]$owner=0;[void][FirstInstallWindow]::GetWindowThreadProcessId($handle,[ref]$owner);if($owner -ne $InstallerPid){throw 'Refusing text read outside the fixture PID'}
 $text=[Text.StringBuilder]::new(8192);$read=[UIntPtr]::Zero
 # Caption reads do not block on the installer while it extracts files. Edit
 # content belongs to the other process and requires the marshaled WM_GETTEXT.
 if((Window-Class $handle) -cne 'Edit'){[void][FirstInstallWindow]::GetWindowText($handle,$text,8192);return $text.ToString()}
 if([FirstInstallWindow]::ReadTextMessage($handle,0x000D,[UIntPtr]::new([uint64]8192),$text,3,2000,[ref]$read) -eq [IntPtr]::Zero){throw 'Fixture control WM_GETTEXT timed out'}
 return $text.ToString()
}
function Window-Class([IntPtr]$handle){$text=[Text.StringBuilder]::new(256);[void][FirstInstallWindow]::GetClassName($handle,$text,256);return $text.ToString()}
function Set-ControlText([IntPtr]$handle,[string]$text){
 [uint32]$owner=0;[void][FirstInstallWindow]::GetWindowThreadProcessId($handle,[ref]$owner)
 if($owner -ne $InstallerPid -or (Window-Class $handle) -cne 'Edit' -or -not [FirstInstallWindow]::IsWindowVisible($handle) -or -not [FirstInstallWindow]::IsWindowEnabled($handle)){throw 'Refusing text write outside an enabled fixture Edit'}
 $written=[UIntPtr]::Zero
 if([FirstInstallWindow]::WriteTextMessage($handle,0x000C,[UIntPtr]::Zero,$text,3,2000,[ref]$written) -eq [IntPtr]::Zero -or $written.ToUInt64() -ne 1){throw 'Fixture control WM_SETTEXT failed or timed out'}
 if((Window-Text $handle) -cne $text){throw 'Fixture Edit did not retain the chosen Unicode path'}
}
function Save-Window([IntPtr]$handle,[string]$name){
 $rect=[FirstInstallWindow+Rect]::new();if(-not [FirstInstallWindow]::GetWindowRect($handle,[ref]$rect)){throw 'Window rectangle unavailable'}
 $bitmap=[Drawing.Bitmap]::new($rect.Right-$rect.Left,$rect.Bottom-$rect.Top);$graphics=[Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
 try{$printed=[FirstInstallWindow]::PrintWindow($handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
 try{if(-not $printed){throw 'Actual installer window screenshot failed'};$bitmap.Save((Join-Path $EvidenceDirectory $name),[Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
}
$result=@{passed=$false;installerPid=$InstallerPid;startedAt=[DateTime]::UtcNow.ToString('o');programPageObserved=$false;libraryPageObserved=$false;programInputMatched=$false;libraryInputMatched=$false;finishObserved=$false;actions=@();validationProcesses=@();lastWindows=@()}
function Persist-Result{[IO.File]::WriteAllText((Join-Path $EvidenceDirectory 'wizard.json'),($result|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))}
function Click-Control($control,[string]$action){
 [uint32]$owner=0;[void][FirstInstallWindow]::GetWindowThreadProcessId($control.handle,[ref]$owner)
 if($owner -ne $InstallerPid -or $control.class -cne 'Button' -or -not [FirstInstallWindow]::IsWindowVisible($control.handle) -or -not [FirstInstallWindow]::IsWindowEnabled($control.handle)){throw 'Refusing non-fixture or disabled button'}
 $before=[FirstInstallWindow]::GetForegroundWindow();[uint32]$beforeOwner=0;[void][FirstInstallWindow]::GetWindowThreadProcessId($before,[ref]$beforeOwner)
 $dialog=[FirstInstallWindow]::GetAncestor($control.handle,2);[uint32]$dialogOwner=0;[void][FirstInstallWindow]::GetWindowThreadProcessId($dialog,[ref]$dialogOwner)
 if($dialogOwner -ne $InstallerPid -or (Window-Class $dialog) -cne '#32770'){throw 'Refusing activation outside the fixture main dialog'}
 $activated=[FirstInstallWindow]::SetForegroundWindow($dialog)
 $method='BM_CLICK'
 if($control.id -eq 1){
  $element=[Windows.Automation.AutomationElement]::FromHandle($control.handle)
  if($element.Current.ProcessId -ne $InstallerPid -or $element.Current.ControlType -ne [Windows.Automation.ControlType]::Button -or -not $element.Current.IsEnabled){throw 'UIAutomation target is not the enabled fixture navigation button'}
  $pattern=$null
  if(-not $element.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){throw 'The actual fixture button does not expose InvokePattern'}
  ([Windows.Automation.InvokePattern]$pattern).Invoke();$method='UIAutomation.InvokePattern'
 }elseif(-not [FirstInstallWindow]::PostMessage($control.handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)){throw 'Fixture radio button message failed'}
 $after=[FirstInstallWindow]::GetForegroundWindow();[uint32]$afterOwner=0;[void][FirstInstallWindow]::GetWindowThreadProcessId($after,[ref]$afterOwner)
 $result.actions+=@(@{action=$action;method=$method;text=$control.text;id=$control.id;foregroundPidBefore=$beforeOwner;foregroundPidAfter=$afterOwner;activationReturned=$activated;at=[DateTime]::UtcNow.ToString('o')});Persist-Result;Start-Sleep -Milliseconds 500
 Write-Output ('fixture GUI action: '+$action)
}
try{
 $deadline=[DateTime]::UtcNow.AddMinutes(20);$lastSignature='';$lastChange=[DateTime]::UtcNow
 while([DateTime]::UtcNow -lt $deadline){
  if(-not (Get-Process -Id $InstallerPid -ErrorAction SilentlyContinue)){if($result.finishObserved){$result.passed=$true;break};throw 'Installer exited before the real finish page'}
  foreach($worker in @(Get-CimInstance Win32_Process -Filter ("Name='powershell.exe' AND ParentProcessId="+$InstallerPid))){
   if($worker.CommandLine -match 'installer-library\.ps1' -and $worker.CommandLine -match '-Mode\s+"?(Validate|Commit|Cache)"?' -and @($result.validationProcesses|Where-Object{$_.pid -eq $worker.ProcessId}).Count -eq 0){$result.validationProcesses+=@(@{pid=$worker.ProcessId;parentPid=$InstallerPid;mode=$Matches[1];observedAt=[DateTime]::UtcNow.ToString('o')})}
  }
  $windows=[Collections.Generic.List[object]]::new()
  $callback=[FirstInstallWindow+EnumProc]{param($handle,$unused)
   [uint32]$owner=0;[void][FirstInstallWindow]::GetWindowThreadProcessId($handle,[ref]$owner)
   if($owner -ne $InstallerPid -or -not [FirstInstallWindow]::IsWindowVisible($handle) -or (Window-Class $handle) -cne '#32770'){return $true}
   $children=[Collections.Generic.List[object]]::new()
   $childCallback=[FirstInstallWindow+EnumProc]{param($child,$unused2)
    if([FirstInstallWindow]::IsWindowVisible($child)){$children.Add(@{handle=$child;class=(Window-Class $child);text=(Window-Text $child);id=[FirstInstallWindow]::GetDlgCtrlID($child);enabled=[FirstInstallWindow]::IsWindowEnabled($child)})};return $true
   }
   [void][FirstInstallWindow]::EnumChildWindows($handle,$childCallback,[IntPtr]::Zero)
   $windows.Add(@{handle=$handle;title=(Window-Text $handle);children=@($children.ToArray())});return $true
  }
  [void][FirstInstallWindow]::EnumWindows($callback,[IntPtr]::Zero)
  $result.lastWindows=@($windows.ToArray());Persist-Result
  foreach($window in $windows){
   $texts=($window.children|ForEach-Object{$_.text}) -join "`n"
   if(@($window.children|Where-Object{$_.class -ceq 'msctls_progress32'}).Count -gt 0 -and $result.libraryInputMatched){if(-not (Test-Path -LiteralPath (Join-Path $EvidenceDirectory 'installer-progress.png'))){Save-Window $window.handle 'installer-progress.png'}}
   $buttons=@($window.children|Where-Object{$_.class -ceq 'Button' -and $_.id -eq 1 -and $_.enabled})
   if($buttons.Count -ne 1){continue};$next=$buttons[0]
   $edits=@($window.children|Where-Object{$_.class -ceq 'Edit' -and $_.enabled})
   if($texts.Contains('选择 MediaSail 资料库')){
    if($result.libraryInputMatched){
     $elapsed=([DateTime]::UtcNow-[DateTime]::Parse($result.libraryClickAt)).TotalSeconds
     if($elapsed -ge 3 -and -not $result.libraryStableRetry){
      if($edits.Count -ne 1 -or (Window-Text $edits[0].handle) -cne $LibraryRoot -or $next.text.Replace('&','') -cne 'Install'){throw 'Library page changed unexpectedly before bounded retry'}
      Save-Window $window.handle 'installer-library-stable-before-retry.png';$result.libraryStableRetry=$true;Persist-Result
      Click-Control $next 'confirm-stable-library-once-more'
     }
     if($elapsed -ge 60){throw 'The actual library page did not advance after two bounded clicks; control tree and screenshots preserved'}
     continue
    }
    if(-not $result.programInputMatched -or $edits.Count -ne 1){throw 'Unexpected library page structure or order'}
    $result.libraryPageObserved=$true
    Set-ControlText $edits[0].handle $LibraryRoot
    $result.libraryInputMatched=$true;$result.libraryClickAt=[DateTime]::UtcNow.ToString('o');Save-Window $window.handle 'installer-library-selection.png';Persist-Result
    Click-Control $next 'confirm-library-and-install';continue
   }
   if(-not $result.programInputMatched -and $edits.Count -eq 1 -and $edits[0].text -match '^[A-Za-z]:\\' -and $texts -match 'Choose Install Location|Destination Folder|选择安装位置|目标文件夹'){
    $result.programPageObserved=$true
    Set-ControlText $edits[0].handle $ProgramDirectory
    $result.programInputMatched=$true;Save-Window $window.handle 'installer-program-selection.png';Persist-Result
    Click-Control $next 'confirm-program-directory';continue
   }
   if($next.text -match 'Finish|完成|结束'){
    if($result.finishObserved){continue}
    if(-not $result.libraryInputMatched){throw 'Finish reached without the library selection page'}
    $result.finishObserved=$true;Save-Window $window.handle 'installer-finish.png';Click-Control $next 'finish';continue
   }
   if(-not $result.programInputMatched -and $next.text -match 'Next|下一步|I Agree|我接受|同意'){
    $current=@($window.children|Where-Object{$_.class -ceq 'Button' -and $_.text.Replace('&','') -match 'Only for me|仅为我|仅为当前用户|只为我|仅当前用户'})
    if($current.Count -eq 1){Click-Control $current[0] 'select-current-user';Click-Control $next 'continue-current-user';continue}
    if($texts -match 'Welcome|欢迎|License Agreement|许可协议|授权协议'){Click-Control $next 'continue-recognized-intro';continue}
   }
  }
  $signature=($result.lastWindows|ConvertTo-Json -Depth 10 -Compress)
  if($signature -cne $lastSignature){$lastSignature=$signature;$lastChange=[DateTime]::UtcNow}
  if([DateTime]::UtcNow-$lastChange -gt [TimeSpan]::FromMinutes(4)){throw 'Unrecognized or stalled wizard; actual control tree retained without broad UI actions'}
  Start-Sleep -Milliseconds 350
 }
 if(-not $result.passed){throw 'Actual first-install wizard timed out'}
}catch{$result.error=$_.Exception.Message;throw}finally{$result.finishedAt=[DateTime]::UtcNow.ToString('o');Persist-Result}
