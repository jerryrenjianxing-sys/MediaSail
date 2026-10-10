param([int]$InstallerPid,[string]$Screenshot)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public class InstallerWindow {
 public delegate bool EnumProc(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc f, IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 public struct Rect {public int Left,Top,Right,Bottom;}
}
'@
$windows=[System.Collections.Generic.List[object]]::new()
$callback=[InstallerWindow+EnumProc]{param($handle,$unused)
 [uint32]$owner=0; [void][InstallerWindow]::GetWindowThreadProcessId($handle,[ref]$owner)
 if ($owner -eq $InstallerPid -and [InstallerWindow]::IsWindowVisible($handle)) {
  $title=[Text.StringBuilder]::new(2048);[void][InstallerWindow]::GetWindowText($handle,$title,2048)
  $children=[System.Collections.Generic.List[object]]::new()
  $childCallback=[InstallerWindow+EnumProc]{param($child,$unused2)
   $text=[Text.StringBuilder]::new(2048);$class=[Text.StringBuilder]::new(256)
   [void][InstallerWindow]::GetWindowText($child,$text,2048);[void][InstallerWindow]::GetClassName($child,$class,256)
   $position=$null;if($class.ToString() -eq 'msctls_progress32'){$position=[InstallerWindow]::SendMessage($child,0x408,[IntPtr]::Zero,[IntPtr]::Zero).ToInt64()}
   $children.Add(@{text=$text.ToString();class=$class.ToString();position=$position});return $true
  }
  [void][InstallerWindow]::EnumChildWindows($handle,$childCallback,[IntPtr]::Zero)
  $windows.Add(@{title=$title.ToString();children=@($children.ToArray())})
  if ($Screenshot -and -not (Test-Path -LiteralPath $Screenshot)) {
   $rect=[InstallerWindow+Rect]::new();[void][InstallerWindow]::GetWindowRect($handle,[ref]$rect)
   $bitmap=[Drawing.Bitmap]::new($rect.Right-$rect.Left,$rect.Bottom-$rect.Top)
   $graphics=[Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
   try{[void][InstallerWindow]::PrintWindow($handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
   $bitmap.Save($Screenshot,[Drawing.Imaging.ImageFormat]::Png);$graphics.Dispose();$bitmap.Dispose()
  }
 }
 return $true
}
[void][InstallerWindow]::EnumWindows($callback,[IntPtr]::Zero)
ConvertTo-Json -InputObject @($windows.ToArray()) -Depth 5 -Compress
