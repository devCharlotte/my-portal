$ErrorActionPreference = "SilentlyContinue"

$Root = Join-Path $env:LOCALAPPDATA "TA-Presenter"
$Runtime = Join-Path $Root "scrcpy"
$Adb = Join-Path $Runtime "adb.exe"
$Scrcpy = Join-Path $Runtime "scrcpy.exe"
$Auto = Join-Path $Root "auto.ps1"
$LogFile = Join-Path $Root "logs\auto.log"
$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$AutoRun = Get-ItemPropertyValue -Path $RunKey -Name "TA-Presenter" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "============================================================"
Write-Host "TA Windows Galaxy Tab Auto Presenter - STATUS"
Write-Host "============================================================"
Write-Host ""
Write-Host "Root      : $Root"
Write-Host "scrcpy    : $(Test-Path $Scrcpy)"
Write-Host "adb       : $(Test-Path $Adb)"
Write-Host "auto      : $(Test-Path $Auto)"
Write-Host "autorun   : $([bool]$AutoRun)"
Write-Host ""

Write-Host "[Runtime]"
if (Test-Path $Adb) { & $Adb version } else { Write-Host "adb.exe not found" }
if (Test-Path $Scrcpy) { & $Scrcpy --version } else { Write-Host "scrcpy.exe not found" }

Write-Host ""
Write-Host "[Auto process]"
$Processes = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object {
        $_.CommandLine -and
        $_.CommandLine -like "*\TA-Presenter\auto.ps1*"
    }

if ($Processes) {
    $Processes | ForEach-Object { Write-Host "RUNNING PID=$($_.ProcessId)" }
}
else {
    Write-Host "NOT RUNNING"
}

Write-Host ""
Write-Host "[ADB devices]"
if (Test-Path $Adb) {
    & $Adb start-server 2>$null | Out-Null
    & $Adb devices -l
}

Write-Host ""
Write-Host "[Recent log]"
if (Test-Path $LogFile) {
    Get-Content $LogFile -Tail 60
}
else {
    Write-Host "No log yet."
}

Write-Host ""
Write-Host "============================================================"
Read-Host "Press Enter to close"
