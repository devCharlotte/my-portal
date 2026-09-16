param(
    [ValidateSet("install","monitor","start","status","uninstall")]
    [string]$Mode = "install"
)

$ErrorActionPreference = "Stop"

$AppId = "TA-Windows-Galaxy-Tab-Auto-Presenter"
$AppName = "TA Windows Galaxy Tab Auto Presenter"
$InstallRoot = Join-Path $env:LOCALAPPDATA $AppId
$InstalledScript = Join-Path $InstallRoot "TA-Windows-Galaxy-Tab-Auto-Presenter.ps1"
$RuntimeRoot = Join-Path $InstallRoot "runtime"
$ScrcpyHome = Join-Path $RuntimeRoot "scrcpy-win64-v4.1"
$ScrcpyZip = Join-Path $RuntimeRoot "scrcpy-win64-v4.1.zip"
$Scrcpy = Join-Path $ScrcpyHome "scrcpy.exe"
$Adb = Join-Path $ScrcpyHome "adb.exe"
$LogDir = Join-Path $InstallRoot "logs"
$LogFile = Join-Path $LogDir "presenter.log"

$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$PowerShellExe = Join-Path $PSHOME "powershell.exe"

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
                $_.CommandLine -match "FlexcilUSBPresenter" -or
                $_.CommandLine -match "FlexcilUSBOneClick"
            )
        } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }

    Get-Process -Name "scrcpy" -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Remove-OldAutoStartEntries {
    foreach ($Name in @(
        "FlexcilAutoPresenter",
        "FlexcilUSBPresenter",
        "FlexcilUSBOneClick",
        "TA_Windows_Galaxy_Tab_Auto_Presenter",
        "TA-Windows-Galaxy-Tab-Auto-Presenter"
    )) {
        Remove-ItemProperty -Path $RunKey -Name $Name -Force -ErrorAction SilentlyContinue
    }

    $Startup = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup)

    foreach ($Name in @(
        "FlexcilAutoPresenter.vbs",
        "FlexcilUSBPresenter.vbs",
        "Flexcil USB OneClick.vbs",
        "TA_Windows_Galaxy_Tab_Auto_Presenter.vbs",
        "TA-Windows-Galaxy-Tab-Auto-Presenter.vbs"
    )) {
        Remove-Item (Join-Path $Startup $Name) -Force -ErrorAction SilentlyContinue
    }
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

function Create-DesktopShortcuts {
    $Desktop = [Environment]::GetFolderPath("Desktop")
    $Shell = New-Object -ComObject WScript.Shell

    $ShortcutSpecs = @(
        @{ Name = "TA Windows Galaxy Tab Auto Presenter.lnk"; Mode = "start" },
        @{ Name = "TA Windows Galaxy Tab Auto Presenter Status.lnk"; Mode = "status" },
        @{ Name = "TA Windows Galaxy Tab Auto Presenter Uninstall.lnk"; Mode = "uninstall" }
    )

    foreach ($Spec in $ShortcutSpecs) {
        $ShortcutPath = Join-Path $Desktop $Spec.Name
        $Shortcut = $Shell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = $PowerShellExe
        $Shortcut.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $InstalledScript + '" -Mode ' + $Spec.Mode
        $Shortcut.WorkingDirectory = $InstallRoot

        if (Test-Path $Scrcpy) {
            $Shortcut.IconLocation = "$Scrcpy,0"
        }

        $Shortcut.Save()
    }
}

function Register-AutoStart {
    New-Item -Path $RunKey -Force | Out-Null

    $Command = '"' + $PowerShellExe + '" -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $InstalledScript + '" -Mode monitor'

    New-ItemProperty `
        -Path $RunKey `
        -Name $AppId `
        -Value $Command `
        -PropertyType String `
        -Force |
        Out-Null
}

function Start-Monitor {
    $Existing = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -match "TA-Windows-Galaxy-Tab-Auto-Presenter\.ps1" -and
            $_.CommandLine -match "Mode monitor"
        }

    if ($Existing) {
        return
    }

    $Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $InstalledScript + '" -Mode monitor'

    Start-Process `
        -FilePath $PowerShellExe `
        -WindowStyle Hidden `
        -ArgumentList $Arguments
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

    try {
        $Process = Start-Process `
            -FilePath $Scrcpy `
            -WorkingDirectory $ScrcpyHome `
            -ArgumentList $Arguments `
            -PassThru

        Write-Log "scrcpy started. PID=$($Process.Id), model=$Model, serial=$Serial"

        Start-Sleep -Milliseconds 1800

        if (-not (Get-Process -Id $Process.Id -ErrorAction SilentlyContinue)) {
            Write-Log "scrcpy exited during startup."
            return $null
        }

        Open-Flexcil $Serial
        return $Process.Id
    }
    catch {
        Write-Log "scrcpy start failed: $($_.Exception.Message)"
        return $null
    }
}

function Run-Monitor {
    Add-Forms
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

    $Mutex = New-Object System.Threading.Mutex(
        $false,
        "Local\TA-Windows-Galaxy-Tab-Auto-Presenter-v9"
    )

    if (-not $Mutex.WaitOne(0, $false)) {
        exit 0
    }

    Write-Log "Monitor started."

    $Connected = $false
    $CurrentSerial = $null
    $PresentationPid = $null
    $UnauthorizedShown = $false

    while ($true) {
        if (-not ((Test-Path $Adb) -and (Test-Path $Scrcpy))) {
            Write-Log "Runtime missing. Attempting self-repair."

            try {
                Ensure-Scrcpy
            }
            catch {
                Write-Log "Self-repair failed: $($_.Exception.Message)"
                Start-Sleep -Seconds 5
                continue
            }
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

            if ($Connected) {
                Write-Log "Tablet authorization lost."
                $Connected = $false
                $CurrentSerial = $null
                $PresentationPid = $null
            }

            Start-Sleep -Seconds 1
            continue
        }

        $UnauthorizedShown = $false
        $Tablet = Get-GalaxyTablet

        if (-not $Tablet) {
            if ($Connected) {
                Write-Log "Tablet disconnected."

                if ($PresentationPid) {
                    Stop-Process -Id $PresentationPid -Force -ErrorAction SilentlyContinue
                }

                $Connected = $false
                $CurrentSerial = $null
                $PresentationPid = $null

                & $Adb kill-server 2>$null | Out-Null
                Start-Sleep -Milliseconds 700
            }

            Start-Sleep -Seconds 1
            continue
        }

        if ((-not $Connected) -or ($Tablet.Serial -ne $CurrentSerial)) {
            $Connected = $true
            $CurrentSerial = $Tablet.Serial
            $PresentationPid = $null

            Write-Log "Tablet connected. model=$($Tablet.Model), serial=$($Tablet.Serial)"

            $PresentationPid = Start-Presentation `
                -Serial $Tablet.Serial `
                -Model $Tablet.Model
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
    Write-Host "InstallRoot : $InstallRoot"
    Write-Host "Installed   : $(Test-Path $InstalledScript)"
    Write-Host "scrcpy      : $(Test-Path $Scrcpy)"
    Write-Host "adb         : $(Test-Path $Adb)"

    $RunValue = Get-ItemPropertyValue -Path $RunKey -Name $AppId -ErrorAction SilentlyContinue
    Write-Host "AutoStart   : $([bool]$RunValue)"
    Write-Host ""

    Write-Host "[Monitor process]"
    $Monitors = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -match "TA-Windows-Galaxy-Tab-Auto-Presenter\.ps1" -and
            $_.CommandLine -match "Mode monitor"
        }

    if ($Monitors) {
        $Monitors | ForEach-Object {
            Write-Host "RUNNING PID=$($_.ProcessId)"
        }
    }
    else {
        Write-Host "NOT RUNNING"
    }

    Write-Host ""
    Write-Host "[ADB]"
    if (Test-Path $Adb) {
        & $Adb start-server 2>$null | Out-Null
        & $Adb devices -l
    }
    else {
        Write-Host "adb.exe not found"
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
        Get-Content $LogFile -Tail 80
    }
    else {
        Write-Host "No log yet."
    }

    Write-Host ""
    Read-Host "Press Enter to close"
}

function Uninstall-Presenter {
    Stop-OldPresenterProcesses

    if (Test-Path $Adb) {
        & $Adb kill-server 2>$null | Out-Null
    }

    Remove-ItemProperty -Path $RunKey -Name $AppId -Force -ErrorAction SilentlyContinue

    $Desktop = [Environment]::GetFolderPath("Desktop")
    foreach ($ShortcutName in @(
        "TA Windows Galaxy Tab Auto Presenter.lnk",
        "TA Windows Galaxy Tab Auto Presenter Status.lnk",
        "TA Windows Galaxy Tab Auto Presenter Uninstall.lnk"
    )) {
        Remove-Item (Join-Path $Desktop $ShortcutName) -Force -ErrorAction SilentlyContinue
    }

    Remove-Item $InstallRoot -Recurse -Force -ErrorAction SilentlyContinue

    Show-Info "TA Windows Galaxy Tab Auto Presenter was removed."
}

try {
    switch ($Mode) {
        "install" {
            Stop-OldPresenterProcesses
            Remove-OldAutoStartEntries

            New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
            New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

            if (-not $PSCommandPath) {
                throw "Installer script path is unavailable."
            }

            [System.IO.File]::Copy($PSCommandPath, $InstalledScript, $true)

            Ensure-Scrcpy
            Register-AutoStart
            Create-DesktopShortcuts
            Start-Monitor

            Show-Info @"
Installed successfully.

From now on:
- It starts automatically when Windows signs in.
- You can disconnect and reconnect the Galaxy Tab at any time.
- The same installation continues working after the PC is restarted.
- Disconnecting and reconnecting USB-C starts a new presentation automatically.
- Desktop shortcuts are created for manual Start, Status, and Uninstall.
- scrcpy v4.1 is stored under LocalAppData and does not need to be downloaded again.

If Android asks for USB debugging permission after reconnecting, tap Allow.
"@
        }

        "monitor" {
            Run-Monitor
        }

        "start" {
            Stop-OldPresenterProcesses
            Ensure-Scrcpy
            Register-AutoStart
            Create-DesktopShortcuts
            Start-Monitor
            Show-Info "Presenter monitor is running."
        }

        "status" {
            Show-Status
        }

        "uninstall" {
            Uninstall-Presenter
        }
    }
}
catch {
    Show-Error $_.Exception.Message
    exit 1
}
