param([string]$Url = 'http://127.0.0.1:8765/')
# Run in the background after the local web service starts.
# Intentionally do not create a new Chrome profile: existing localhost lead data lives there.
$chrome = @(
    (Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:LOCALAPPDATA} 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) {
    $cmd = Get-Command 'chrome.exe' -ErrorAction SilentlyContinue
    if ($cmd) { $chrome = $cmd.Source }
}
if (-not $chrome) { Start-Process $Url; exit 0 }

try {
    Add-Type -AssemblyName System.Windows.Forms
    $primary = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $xy = "{0},{1}" -f $primary.X, $primary.Y
    $size = "{0},{1}" -f $primary.Width, $primary.Height
} catch { $primary = $null }

# Chrome can reuse an existing process, so detect the NEW top-level window rather
# than relying only on Start-Process.MainWindowHandle.
$native = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class LeadForgeWindow {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr data);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd,int x,int y,int width,int height,bool repaint);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd,int cmd);
  public static IntPtr[] ChromeWindows() {
    var result=new List<IntPtr>();
    EnumWindows((hWnd,data)=> {
      if(IsWindowVisible(hWnd)) {
        var c=new StringBuilder(128); GetClassName(hWnd,c,c.Capacity);
        if(c.ToString()=="Chrome_WidgetWin_1") result.Add(hWnd);
      }
      return true;
    },IntPtr.Zero);
    return result.ToArray();
  }
  public static string Caption(IntPtr hWnd) {
    var t=new StringBuilder(512); GetWindowText(hWnd,t,t.Capacity);return t.ToString();
  }
}
'@
try { Add-Type -TypeDefinition $native -ErrorAction Stop } catch { $primary = $null }
$before = @()
if ($primary) { try { $before = @([LeadForgeWindow]::ChromeWindows()) } catch { $primary=$null } }
$args = @('--new-window','--start-maximized')
if ($primary) {
    $args += "--window-position=$xy"
    $args += "--window-size=$size"
}
$args += $Url
try { Start-Process -FilePath $chrome -ArgumentList $args -ErrorAction Stop }
catch { Start-Process $Url; exit 0 }
if (-not $primary) { exit 0 }

$deadline = (Get-Date).AddSeconds(12)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 300
    try {
        $candidates = @([LeadForgeWindow]::ChromeWindows()) | Where-Object { $before -notcontains $_ }
        foreach($win in $candidates) {
            $caption = [LeadForgeWindow]::Caption($win)
            if($caption -match 'LeadForge') {
                [void][LeadForgeWindow]::ShowWindow($win,9) # Restore first to permit relocation.
                [void][LeadForgeWindow]::MoveWindow($win,$primary.X,$primary.Y,$primary.Width,$primary.Height,$true)
                [void][LeadForgeWindow]::ShowWindow($win,3) # Maximize on primary monitor.
                exit 0
            }
        }
    } catch { break }
}
# CLI window-position/start-maximized still apply if Win32 matching timed out.
