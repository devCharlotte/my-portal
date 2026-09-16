param(
    [ValidateSet("start", "monitor", "status", "stop")]
    [string]$Mode = "start"
)

$ErrorActionPreference = "Stop"

$AppName = "TA Windows Galaxy Tab Auto Presenter"
$WorkRoot = Join-Path $env:TEMP "TA-Windows-Galaxy-Tab-Auto-Presenter"
$RuntimeRoot = Join-Path $WorkRoot "runtime"
$ScrcpyHome = Join-Path $RuntimeRoot "scrcpy-win64-v4.1"
$ScrcpyZip = Join-Path $RuntimeRoot "scrcpy-win64-v4.1.zip"
$Scrcpy = Join-Path $ScrcpyHome "scrcpy.exe"
$Adb = Join-Path $ScrcpyHome "adb.exe"
$LogDir = Join-Path $WorkRoot "logs"
$LogFile = Join-Path $LogDir "presenter.log"

$ScrcpyUrl = "https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-win64-v4.1.zip"
$ScrcpySha256 = "5b12172b3264b2889f4583ee64752ce832e29bc8b1089dca81093459697165db"

function Add-Forms {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
}

function Show-Info([string]$Text) {
    Add-Forms
    [System.Windows.Forms.MessageBox]::Show(
        $Text,
        $AppName,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
}

function Show-Error([string]$Text) {
    Add-Forms
    [System.Windows.Forms.MessageBox]::Show(
        $Text,
        "$AppName - Error",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Write-Log([string]$Text) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    $Stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Add-Content -Path $LogFile -Value "[$Stamp] $Text" -Encoding UTF8
}

function Stop-OldPresenterProcesses {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ProcessId -ne $PID -and
            $_.CommandLine -and (
                $_.CommandLine -match "TA-Windows-Galaxy-Tab-Auto-Presenter" -or
                $_.CommandLine -match "TA_Windows_Galaxy_Tab_Auto_Presenter" -or
                $_.CommandLine -match "FlexcilAutoPresenter" -or
                $_.CommandLine -match "FlexcilUSBPresenter"
            )
        } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }

    Get-Process -Name "scrcpy" -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Ensure-Scrcpy {
    if ((Test-Path $Scrcpy) -and (Test-Path $Adb)) {
        return
    }

    New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null

    if (Test-Path $ScrcpyZip) {
        try {
            $ExistingHash = (Get-FileHash -Path $ScrcpyZip -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($ExistingHash -ne $ScrcpySha256) {
                Remove-Item $ScrcpyZip -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            Remove-Item $ScrcpyZip -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not (Test-Path $ScrcpyZip)) {
        $Downloaded = $false
        $Curl = Join-Path $env:SystemRoot "System32\curl.exe"

        if (Test-Path $Curl) {
            & $Curl -L --fail --silent --show-error $ScrcpyUrl -o $ScrcpyZip
            if (($LASTEXITCODE -eq 0) -and (Test-Path $ScrcpyZip)) {
                $Downloaded = $true
            }
            else {
                Remove-Item $ScrcpyZip -Force -ErrorAction SilentlyContinue
            }
        }

        if (-not $Downloaded) {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $ScrcpyUrl -OutFile $ScrcpyZip -UseBasicParsing
        }
    }

    if (-not (Test-Path $ScrcpyZip)) {
        throw "Could not download scrcpy v4.1."
    }

    $Hash = (Get-FileHash -Path $ScrcpyZip -Algorithm SHA256).Hash.ToLowerInvariant()

    if ($Hash -ne $ScrcpySha256) {
        Remove-Item $ScrcpyZip -Force -ErrorAction SilentlyContinue
        throw "scrcpy v4.1 SHA-256 verification failed."
    }

    if (Test-Path $ScrcpyHome) {
        Remove-Item $ScrcpyHome -Recurse -Force -ErrorAction SilentlyContinue
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ScrcpyZip, $RuntimeRoot)

    if (-not ((Test-Path $Scrcpy) -and (Test-Path $Adb))) {
        throw "scrcpy extraction failed."
    }

    Get-ChildItem -Path $ScrcpyHome -File -Recurse -ErrorAction SilentlyContinue |
        Unblock-File -ErrorAction SilentlyContinue
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

function Has-Unauthorized {
    foreach ($Line in (Get-DeviceLines)) {
        if ($Line -match '^([^\s]+)\s+unauthorized') {
            return $true
        }
    }
    return $false
}

function Get-GalaxyTablet {
    foreach ($Line in (Get-DeviceLines)) {
        if ($Line -match '^([^\s]+)\s+device\s*(.*)$') {
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

        $Resolved = @(
            & $Adb -s $Serial shell cmd package resolve-activity --brief $Package 2>$null
        )

        $Component = $Resolved |
            Where-Object { $_ -match '/' } |
            Select-Object -Last 1

        if ($Component) {
            & $Adb -s $Serial shell am start --display 0 -n $Component.Trim() 2>$null |
                Out-Null

            Write-Log "Flexcil opened on tablet display."
            return
        }

        & $Adb -s $Serial shell monkey -p $Package -c android.intent.category.LAUNCHER 1 2>$null |
            Out-Null

        Write-Log "Flexcil opened by fallback."
    }
    catch {
        Write-Log "Flexcil launch failed."
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

    $Process = Start-Process -FilePath $Scrcpy -WorkingDirectory $ScrcpyHome -ArgumentList $Arguments -PassThru

    Write-Log "scrcpy started. PID=$($Process.Id), model=$Model, serial=$Serial"

    Start-Sleep -Milliseconds 1800

    if (-not (Get-Process -Id $Process.Id -ErrorAction SilentlyContinue)) {
        Write-Log "scrcpy exited during startup."
        return $false
    }

    Open-Flexcil $Serial
    return $true
}

function Run-Monitor {
    Add-Forms

    $Mutex = New-Object System.Threading.Mutex(
        $false,
        "Local\TA-Windows-Galaxy-Tab-Auto-Presenter-v6"
    )

    if (-not $Mutex.WaitOne(0, $false)) {
        exit 0
    }

    Write-Log "Monitor started."

    $ConnectedSerial = $null
    $Started = $false
    $EverConnected = $false
    $UnauthorizedShown = $false

    while ($true) {
        if (-not ((Test-Path $Adb) -and (Test-Path $Scrcpy))) {
            Write-Log "Runtime missing. Monitor exits."
            exit 2
        }

        if (Has-Unauthorized) {
            if (-not $UnauthorizedShown) {
                $UnauthorizedShown = $true

                [System.Windows.Forms.MessageBox]::Show(
                    "Allow USB debugging on the Galaxy Tab. The presentation will continue automatically after authorization.",
                    $AppName,
                    [System.Windows.Forms.MessageBoxButtons]::OK,
                    [System.Windows.Forms.MessageBoxIcon]::Information
                ) | Out-Null
            }

            Start-Sleep -Seconds 1
            continue
        }

        $UnauthorizedShown = $false
        $Tablet = Get-GalaxyTablet

        if (-not $Tablet) {
            if ($EverConnected) {
                Write-Log "Tablet disconnected. Closing ADB server and monitor."
                & $Adb kill-server 2>$null | Out-Null
                exit 0
            }

            Start-Sleep -Seconds 1
            continue
        }

        $EverConnected = $true

        if ($Tablet.Serial -ne $ConnectedSerial) {
            $ConnectedSerial = $Tablet.Serial
            $Started = $false
            Write-Log "Tablet connected. model=$($Tablet.Model), serial=$($Tablet.Serial)"
        }

        if (-not $Started) {
            $Started = $true
            $Ok = Start-Presentation -Serial $Tablet.Serial -Model $Tablet.Model

            if (-not $Ok) {
                Write-Log "Presentation startup failed. Reconnect USB-C before retrying."
            }
        }

        Start-Sleep -Seconds 1
    }
}

function Show-Status {
    Write-Host ""
    Write-Host "============================================================"
    Write-Host "TA Windows Galaxy Tab Auto Presenter - STATUS"
    Write-Host "============================================================"
    Write-Host ""
    Write-Host "WorkRoot : $WorkRoot"
    Write-Host "scrcpy   : $(Test-Path $Scrcpy)"
    Write-Host "adb      : $(Test-Path $Adb)"
    Write-Host ""

    Write-Host "[ADB]"
    if (Test-Path $Adb) {
        & $Adb start-server 2>$null | Out-Null
        & $Adb devices -l
    }
    else {
        Write-Host "Runtime not prepared yet."
    }

    Write-Host ""
    Write-Host "[Windows USB devices]"
    Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FriendlyName -match 'Samsung|Android|ADB|MTP'
        } |
        Select-Object Status, Class, FriendlyName |
        Format-Table -AutoSize

    Write-Host ""
    Write-Host "[Recent log]"
    if (Test-Path $LogFile) {
        Get-Content $LogFile -Tail 60
    }
    else {
        Write-Host "No log yet."
    }

    Write-Host ""
    Read-Host "Press Enter to close"
}

function Stop-Presenter {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ProcessId -ne $PID -and
            $_.CommandLine -and
            $_.CommandLine -match "TA-Windows-Galaxy-Tab-Auto-Presenter\.ps1" -and
            $_.CommandLine -match "monitor"
        } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }

    Get-Process -Name "scrcpy" -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue

    if (Test-Path $Adb) {
        & $Adb kill-server 2>$null | Out-Null
    }

    Show-Info "Presenter stopped and ADB server closed."
}

try {
    switch ($Mode) {
        "start" {
            Stop-OldPresenterProcesses
            Ensure-Scrcpy

            & $Adb start-server 2>$null | Out-Null

            $ScriptPath = $PSCommandPath

            Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
                "-NoLogo",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-File",
                $ScriptPath,
                "-Mode",
                "monitor"
            )

            Show-Info @"
Ready.

Connect the Galaxy Tab S7+ by USB-C.
If Android asks for USB debugging permission, tap Allow.

The presentation window will open automatically.
"@
        }

        "monitor" {
            Run-Monitor
        }

        "status" {
            Show-Status
        }

        "stop" {
            Stop-Presenter
        }
    }
}
catch {
    Show-Error $_.Exception.Message
    exit 1
}
