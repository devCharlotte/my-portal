@echo off
setlocal
set "SCRIPT=%TEMP%\TA-Windows-Galaxy-Tab-Auto-Presenter\TA-Windows-Galaxy-Tab-Auto-Presenter.ps1"
if not exist "%SCRIPT%" (
  echo Run TA-Windows-Galaxy-Tab-Auto-Presenter.cmd first.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Mode status
