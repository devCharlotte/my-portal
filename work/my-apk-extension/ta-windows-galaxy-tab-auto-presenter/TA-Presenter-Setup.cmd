@echo off
setlocal
set "TA_SETUP=%TEMP%\TA-Presenter-setup-%RANDOM%-%RANDOM%.ps1"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$u='https://raw.githubusercontent.com/devCharlotte/my-portal/main/work/my-apk-extension/ta-windows-galaxy-tab-auto-presenter/setup.ps1';$p=$env:TA_SETUP;[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;try{Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $p -ErrorAction Stop}catch{Write-Host $_.Exception.Message;exit 91};& $p"
set "TA_RC=%ERRORLEVEL%"
del /q "%TA_SETUP%" >nul 2>&1

if not "%TA_RC%"=="0" (
  echo.
  echo TA Presenter setup failed. Error code: %TA_RC%
  pause
)

exit /b %TA_RC%
