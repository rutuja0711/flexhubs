@echo off
setlocal

echo.
echo FlexHubs Desktop - Windows install helper
echo ==========================================
echo.

set "INSTALLER="
if exist "%~dp0FlexHubs-Setup.exe" set "INSTALLER=%~dp0FlexHubs-Setup.exe"
if exist "%~dp0Setup.exe" set "INSTALLER=%~dp0Setup.exe"

if "%INSTALLER%"=="" (
  echo Could not find FlexHubs-Setup.exe in this folder.
  echo.
  echo Download FlexHubs-Setup.exe from GitHub Releases, place it in this folder,
  echo then double-click install-flexhubs.bat again.
  echo.
  pause
  exit /b 1
)

echo Found: %INSTALLER%
echo Unblocking file...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%INSTALLER%'"

echo Starting installer...
start "" "%INSTALLER%"

echo.
echo If SmartScreen appears: click "More info" then "Run anyway" (unsigned builds only).
echo If nothing happens, right-click the installer -^> Run as administrator.
echo.
pause
