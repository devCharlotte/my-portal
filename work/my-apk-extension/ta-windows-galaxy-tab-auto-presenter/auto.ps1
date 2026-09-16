$ErrorActionPreference = "SilentlyContinue"

Add-Type -AssemblyName System.Windows.Forms

$AppName = "TA Windows Galaxy Tab Auto Presenter"
$Root = Join-Path $env:LOCALAPPDATA "TA-Presenter"
$Runtime = Join-Path $Root "scrcpy"
$Adb = Join-Path $Runtime "adb.exe"
$Scrcpy = Join-Path $Runtime "scrcpy.exe"
$LogFile = Join-Path $Root "logs\auto.log"

function Write-Log([string]$Text) {
    $Time = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Add-Content -Path $LogFile -Value "[$Time] $Text" -Encoding UTF8
}

$Mutex = New-Object System.Threading.Mutex($false, "Local\TA-Presenter-Auto")
if (-not $Mutex.WaitOne(0, $false)) {
    exit
}

function Get-DeviceLines {
    try {
        & $Adb start-server 2>$null | Out-Null
        return @(& $Adb devices -l 2>$null)
    }
    catch {
        return @()
    }
}

function Test-UnauthorizedDevice {
    foreach ($Line in (Get-DeviceLines)) {
        if ($Line -match '^([^\s:]+)\s+unauthorized') {
            return $true
        }
    }

    return $false
}

function Get-GalaxyTablet {
    foreach ($Line in (Get-DeviceLines)) {
        if ($Line -match '^([^\s:]+)\s+device\s*(.*)$') {
            $Serial = $Matches[1]

            try {
                $Model = (& $Adb -s $Serial shell getprop ro.product.model 2>$null | Out-String).Trim()
                $Characteristics = (& $Adb -s $Serial shell getprop ro.build.characteristics 2>$null | Out-String).Trim()

                if (($Model -match '^SM-T') -or ($Characteristics -match '(?i)tablet')) {
                    return [PSCustomObject]@{
                        Serial = $Serial
                        Model = $Model
                    }
                }
            }
            catch {}
        }
    }

    return $null
}

function Open-Flexcil([string]$Serial) {
    try {
        $PackageLine = @(& $Adb -s $Serial shell pm list packages 2>$null) |
            Where-Object { $_ -match '(?i)flexcil' } |
            Select-Object -First 1

        if (-not $PackageLine) {
            Write-Log "Flexcil package not found."
            return
        }

        $Package = ($PackageLine -replace '^package:', '').Trim()
        $Resolved = @(& $Adb -s $Serial shell cmd package resolve-activity --brief $Package 2>$null)

        $Component = $Resolved |
            Where-Object { $_ -match '/' } |
            Select-Object -Last 1

        if ($Component) {
            & $Adb -s $Serial shell am start --display 0 -n $Component.Trim() 2>$null | Out-Null
            Write-Log "Flexcil opened on tablet display 0."
            return
        }

        & $Adb -s $Serial shell monkey -p $Package -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
        Write-Log "Flexcil opened with fallback."
    }
    catch {
        Write-Log "Flexcil launch error: $($_.Exception.Message)"
    }
}

function Start-Presentation([string]$Serial, [string]$Model) {
    $Arguments = @(
        "--serial=$Serial",
        "--new-display=1920x1080/240",
        "--flex-display",
        "--no-vd-system-decorations",
        "--keep-active",
        "--no-audio",
        "--window-title=Flexcil-Presentation"
    )

    try {
        $Process = Start-Process `
            -FilePath $Scrcpy `
            -WorkingDirectory $Runtime `
            -ArgumentList $Arguments `
            -PassThru

        Write-Log "scrcpy started. PID=$($Process.Id), model=$Model, serial=$Serial"

        Start-Sleep -Milliseconds 1800

        if (-not (Get-Process -Id $Process.Id -ErrorAction SilentlyContinue)) {
            Write-Log "scrcpy exited during startup."
            return
        }

        Open-Flexcil $Serial
    }
    catch {
        Write-Log "scrcpy start error: $($_.Exception.Message)"
    }
}

New-Item -ItemType Directory -Path (Join-Path $Root "logs") -Force | Out-Null
Write-Log "Auto process started."

$ConnectedSerial = $null
$StartedForConnection = $false
$UnauthorizedNoticeShown = $false

while ($true) {
    if (-not ((Test-Path $Adb) -and (Test-Path $Scrcpy))) {
        Write-Log "Runtime missing."
        Start-Sleep -Seconds 2
        continue
    }

    if (Test-UnauthorizedDevice) {
        if (-not $UnauthorizedNoticeShown) {
            $UnauthorizedNoticeShown = $true

            [System.Windows.Forms.MessageBox]::Show(
                "Allow USB debugging on the Galaxy Tab. The presentation will continue automatically after you tap Allow.",
                $AppName,
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            ) | Out-Null
        }

        Start-Sleep -Seconds 1
        continue
    }

    $UnauthorizedNoticeShown = $false
    $Tablet = Get-GalaxyTablet

    if (-not $Tablet) {
        $ConnectedSerial = $null
        $StartedForConnection = $false
        Start-Sleep -Seconds 1
        continue
    }

    if ($Tablet.Serial -ne $ConnectedSerial) {
        $ConnectedSerial = $Tablet.Serial
        $StartedForConnection = $false
        Write-Log "Tablet connected. model=$($Tablet.Model), serial=$($Tablet.Serial)"
    }

    if (-not $StartedForConnection) {
        $StartedForConnection = $true
        Start-Presentation -Serial $Tablet.Serial -Model $Tablet.Model
    }

    Start-Sleep -Seconds 1
}
