@echo off
setlocal
set "SCRIPT=%LOCALAPPDATA%\TA-Windows-Galaxy-Tab-Auto-Presenter\TA-Windows-Galaxy-Tab-Auto-Presenter.ps1"
if not exist "%SCRIPT%" (
  echo TA Windows Galaxy Tab Auto Presenter is not installed.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Mode uninstall
