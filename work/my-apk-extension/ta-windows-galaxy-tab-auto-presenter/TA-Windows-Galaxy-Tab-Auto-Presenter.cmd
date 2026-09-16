@echo off
setlocal
set "WORK=%TEMP%\TA-Windows-Galaxy-Tab-Auto-Presenter"
if not exist "%WORK%" mkdir "%WORK%" >nul 2>&1
set "SCRIPT=%WORK%\TA-Windows-Galaxy-Tab-Auto-Presenter.ps1"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://devcharlotte.github.io/my-portal/work/my-apk-extension/ta-windows-galaxy-tab-auto-presenter/TA-Windows-Galaxy-Tab-Auto-Presenter.ps1?v=2026-09-16-06' -OutFile '%SCRIPT%'"

if errorlevel 1 (
  echo.
  echo DOWNLOAD FAILED.
  echo Check internet access and try again.
  pause
  exit /b 1
)

start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%" -Mode start
exit /b 0
