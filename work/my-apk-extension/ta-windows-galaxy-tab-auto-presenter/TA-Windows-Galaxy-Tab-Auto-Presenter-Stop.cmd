@echo off
setlocal
set "SCRIPT=%TEMP%\TA-Windows-Galaxy-Tab-Auto-Presenter\TA-Windows-Galaxy-Tab-Auto-Presenter.ps1"
if not exist "%SCRIPT%" exit /b 0
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Mode stop
