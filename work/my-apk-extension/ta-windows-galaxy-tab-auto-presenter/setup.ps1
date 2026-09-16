$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

$AppName = "TA Windows Galaxy Tab Auto Presenter"
$AppId = "TA-Presenter"
$Root = Join-Path $env:LOCALAPPDATA $AppId
$Runtime = Join-Path $Root "scrcpy"
$Logs = Join-Path $Root "logs"
$RawBase = "https://raw.githubusercontent.com/devCharlotte/my-portal/main/work/my-apk-extension/ta-windows-galaxy-tab-auto-presenter"

$Adb = Join-Path $Runtime "adb.exe"
$Scrcpy = Join-Path $Runtime "scrcpy.exe"

$ScrcpyUrl = "https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-win64-v4.1.zip"
$ScrcpySha256 = "5b12172b3264b2889f4583ee64752ce832e29bc8b1089dca81093459697165db"

$SupportFiles = @("auto.ps1", "run.ps1", "status.ps1", "remove.ps1")

function Show-Info([string]$Text) {
    [System.Windows.Forms.MessageBox]::Show(
        $Text,
        $AppName,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
}

function Show-Error([string]$Text) {
    [System.Windows.Forms.MessageBox]::Show(
        $Text,
        "$AppName - Setup Error",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Download-File([string]$Url, [string]$Destination) {
    Remove-Item $Destination -Force -ErrorAction SilentlyContinue

    $Curl = Join-Path $env:SystemRoot "System32\curl.exe"

    if (Test-Path $Curl) {
        & $Curl -L --fail --silent --show-error $Url -o $Destination

        if ($LASTEXITCODE -ne 0) {
            Remove-Item $Destination -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not (Test-Path $Destination)) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
    }

    if (-not (Test-Path $Destination)) {
        throw "Download failed: $Url"
    }

    Unblock-File -Path $Destination -ErrorAction SilentlyContinue
}

function Stop-PreviousVersions {
    $Patterns = @(
        "FlexcilAutoPresenter",
        "FlexcilUSBPresenter",
        "FlexcilUSBOneClick",
        "TA_Windows_Galaxy_Tab_Auto_Presenter",
        "TA-Windows-Galaxy-Tab-Auto-Presenter",
        "TA-Presenter"
    )

    $Processes = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue

    foreach ($Process in $Processes) {
        if ($Process.ProcessId -eq $PID) {
            continue
        }

        if (-not $Process.CommandLine) {
            continue
        }

        foreach ($Pattern in $Patterns) {
            if ($Process.CommandLine -like "*$Pattern*") {
                Stop-Process -Id $Process.ProcessId -Force -ErrorAction SilentlyContinue
                break
            }
        }
    }

    $RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

    foreach ($Name in $Patterns) {
        Remove-ItemProperty -Path $RunKey -Name $Name -Force -ErrorAction SilentlyContinue
    }
}

function Install-SupportFiles {
    foreach ($Name in $SupportFiles) {
        $Destination = Join-Path $Root $Name
        $Url = "$RawBase/$Name"

        Download-File -Url $Url -Destination $Destination

        $Tokens = $null
        $Errors = $null

        [void][System.Management.Automation.Language.Parser]::ParseFile(
            $Destination,
            [ref]$Tokens,
            [ref]$Errors
        )

        if ($Errors.Count -gt 0) {
            $FirstError = $Errors[0].Message
            throw "PowerShell syntax check failed for $Name. $FirstError"
        }
    }
}

function Install-Scrcpy {
    if ((Test-Path $Scrcpy) -and (Test-Path $Adb)) {
        return
    }

    Remove-Item $Runtime -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $Runtime -Force | Out-Null

    $TempRoot = Join-Path $env:TEMP ("ta-presenter-" + [Guid]::NewGuid().ToString("N"))
    $ZipFile = Join-Path $TempRoot "scrcpy.zip"
    $ExtractRoot = Join-Path $TempRoot "extract"

    try {
        New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
        New-Item -ItemType Directory -Path $ExtractRoot -Force | Out-Null

        Download-File -Url $ScrcpyUrl -Destination $ZipFile

        $ActualHash = (Get-FileHash -Path $ZipFile -Algorithm SHA256).Hash.ToLowerInvariant()

        if ($ActualHash -ne $ScrcpySha256) {
            throw "Official scrcpy SHA-256 verification failed."
        }

        Expand-Archive -Path $ZipFile -DestinationPath $ExtractRoot -Force

        Get-ChildItem -Path $ExtractRoot -File -Recurse -ErrorAction SilentlyContinue |
            Unblock-File -ErrorAction SilentlyContinue

        $FoundScrcpy = Get-ChildItem -Path $ExtractRoot -Filter "scrcpy.exe" -File -Recurse |
            Select-Object -First 1

        if (-not $FoundScrcpy) {
            throw "scrcpy.exe was not found after extraction."
        }

        $SourceDir = $FoundScrcpy.Directory.FullName
        $Robocopy = Join-Path $env:SystemRoot "System32\robocopy.exe"

        & $Robocopy $SourceDir $Runtime /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null

        if ($LASTEXITCODE -gt 7) {
            throw "scrcpy runtime copy failed. robocopy code: $LASTEXITCODE"
        }

        Get-ChildItem -Path $Runtime -File -Recurse -ErrorAction SilentlyContinue |
            Unblock-File -ErrorAction SilentlyContinue
    }
    finally {
        Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-Runtime {
    if (-not ((Test-Path $Scrcpy) -and (Test-Path $Adb))) {
        throw "scrcpy runtime is incomplete."
    }

    & $Adb version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "adb self-test failed."
    }

    & $Scrcpy --version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "scrcpy self-test failed."
    }

    $Help = (& $Scrcpy --help 2>&1 | Out-String)

    if ($Help -notmatch "--new-display") {
        throw "scrcpy does not support --new-display."
    }

    if ($Help -notmatch "--flex-display") {
        throw "scrcpy does not support --flex-display."
    }
}

function Write-CommandFiles {
    $RunCmd = @'
@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\TA-Presenter\run.ps1"
if errorlevel 1 pause
'@

    $StatusCmd = @'
@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\TA-Presenter\status.ps1"
'@

    $RemoveCmd = @'
@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\TA-Presenter\remove.ps1"
if errorlevel 1 pause
'@

    [System.IO.File]::WriteAllText((Join-Path $Root "run.cmd"), $RunCmd, [System.Text.Encoding]::ASCII)
    [System.IO.File]::WriteAllText((Join-Path $Root "status.cmd"), $StatusCmd, [System.Text.Encoding]::ASCII)
    [System.IO.File]::WriteAllText((Join-Path $Root "remove.cmd"), $RemoveCmd, [System.Text.Encoding]::ASCII)
}

function Register-AutoStart {
    $RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $AutoScript = Join-Path $Root "auto.ps1"
    $Command = 'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $AutoScript + '"'

    New-Item -Path $RunKey -Force | Out-Null
    New-ItemProperty -Path $RunKey -Name $AppId -Value $Command -PropertyType String -Force | Out-Null
}

function Start-Auto {
    $AutoScript = Join-Path $Root "auto.ps1"
    $Shell = New-Object -ComObject WScript.Shell
    $Command = 'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $AutoScript + '"'
    $null = $Shell.Run($Command, 0, $false)
}

function Create-DesktopShortcuts {
    $Desktop = [Environment]::GetFolderPath("Desktop")
    $Shell = New-Object -ComObject WScript.Shell

    $StatusLink = $Shell.CreateShortcut((Join-Path $Desktop "TA Presenter Status.lnk"))
    $StatusLink.TargetPath = (Join-Path $Root "status.cmd")
    $StatusLink.WorkingDirectory = $Root
    $StatusLink.Save()

    $RemoveLink = $Shell.CreateShortcut((Join-Path $Desktop "TA Presenter Remove.lnk"))
    $RemoveLink.TargetPath = (Join-Path $Root "remove.cmd")
    $RemoveLink.WorkingDirectory = $Root
    $RemoveLink.Save()
}

try {
    Stop-PreviousVersions

    New-Item -ItemType Directory -Path $Root -Force | Out-Null
    New-Item -ItemType Directory -Path $Logs -Force | Out-Null

    Install-SupportFiles
    Install-Scrcpy
    Test-Runtime
    Write-CommandFiles
    Register-AutoStart

    & $Adb start-server 2>$null | Out-Null

    Start-Auto
    Create-DesktopShortcuts

    Show-Info @"
Setup completed successfully.

Official scrcpy v4.1 and adb are installed and verified.

Connect the Galaxy Tab S7+ with a USB-C data cable.
If Android asks for USB debugging permission, tap Allow.

The Flexcil presentation window will start automatically.
"@
}
catch {
    Show-Error $_.Exception.Message
    exit 1
}
