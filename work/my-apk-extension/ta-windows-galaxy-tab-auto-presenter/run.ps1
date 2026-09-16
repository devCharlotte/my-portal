$ErrorActionPreference = "Stop"

$Root = Join-Path $env:LOCALAPPDATA "TA-Presenter"
$Runtime = Join-Path $Root "scrcpy"
$Adb = Join-Path $Runtime "adb.exe"
$Scrcpy = Join-Path $Runtime "scrcpy.exe"

if (-not ((Test-Path $Adb) -and (Test-Path $Scrcpy))) {
    throw "Runtime not found. Run TA-Presenter-Setup.cmd first."
}

& $Adb start-server 2>$null | Out-Null

$Serial = $null

foreach ($Line in @(& $Adb devices -l 2>$null)) {
    if ($Line -match '^([^\s:]+)\s+device\s*(.*)$') {
        $Candidate = $Matches[1]
        $Model = (& $Adb -s $Candidate shell getprop ro.product.model 2>$null | Out-String).Trim()
        $Characteristics = (& $Adb -s $Candidate shell getprop ro.build.characteristics 2>$null | Out-String).Trim()

        if (($Model -match '^SM-T') -or ($Characteristics -match '(?i)tablet')) {
            $Serial = $Candidate
            break
        }
    }
}

if (-not $Serial) {
    throw "Galaxy Tab was not detected by ADB."
}

$Arguments = @(
    "--serial=$Serial",
    "--new-display=1920x1080/240",
    "--flex-display",
    "--no-vd-system-decorations",
    "--keep-active",
    "--no-audio",
    "--window-title=Flexcil-Presentation"
)

Start-Process -FilePath $Scrcpy -WorkingDirectory $Runtime -ArgumentList $Arguments
