@echo off
setlocal
set "TMPDIR=%TEMP%\TA-Windows-Galaxy-Tab-Auto-Presenter-Installer"
if not exist "%TMPDIR%" mkdir "%TMPDIR%" >nul 2>&1
set "SCRIPT=%TMPDIR%\TA-Windows-Galaxy-Tab-Auto-Presenter.ps1"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://devcharlotte.github.io/my-portal/work/my-apk-extension/ta-windows-galaxy-tab-auto-presenter/TA-Windows-Galaxy-Tab-Auto-Presenter.ps1?v=2026-09-16-10' -OutFile '%SCRIPT%'"

if errorlevel 1 (
  echo.
  echo DOWNLOAD FAILED.
  echo Check internet access and try again.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Mode install
if errorlevel 1 pause
