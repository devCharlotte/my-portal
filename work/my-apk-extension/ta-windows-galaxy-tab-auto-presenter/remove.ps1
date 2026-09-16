$ErrorActionPreference = "SilentlyContinue"

$Root = Join-Path $env:LOCALAPPDATA "TA-Presenter"
$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object {
        $_.ProcessId -ne $PID -and
        $_.CommandLine -and
        $_.CommandLine -like "*\TA-Presenter\*"
    } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

$OurScrcpy = Join-Path $Root "scrcpy\scrcpy.exe"

Get-CimInstance Win32_Process -Filter "Name='scrcpy.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
        $_.ExecutablePath -and
        $_.ExecutablePath -eq $OurScrcpy
    } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

$Adb = Join-Path $Root "scrcpy\adb.exe"
if (Test-Path $Adb) {
    & $Adb kill-server 2>$null | Out-Null
}

Remove-ItemProperty -Path $RunKey -Name "TA-Presenter" -Force -ErrorAction SilentlyContinue

$Desktop = [Environment]::GetFolderPath("Desktop")
Remove-Item (Join-Path $Desktop "TA Presenter Status.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $Desktop "TA Presenter Remove.lnk") -Force -ErrorAction SilentlyContinue

Remove-Item $Root -Recurse -Force -ErrorAction SilentlyContinue

Add-Type -AssemblyName System.Windows.Forms

[System.Windows.Forms.MessageBox]::Show(
    "Removed.",
    "TA Windows Galaxy Tab Auto Presenter",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
