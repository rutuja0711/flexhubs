@echo off
setlocal

echo.
echo FlexHubs Desktop - Windows install helper
echo ==========================================
echo.

set "INSTALLER="
if exist "%~dp0Setup.exe" set "INSTALLER=%~dp0Setup.exe"
if exist "%~dp0RELEASES" if exist "%~dp0FlexHubs Desktop Setup.exe" set "INSTALLER=%~dp0FlexHubs Desktop Setup.exe"

if "%INSTALLER%"=="" (
  echo Could not find Setup.exe in this folder.
  echo.
  echo Put this file in the same folder as Setup.exe from the download,
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
echo If SmartScreen appears: click "More info" then "Run anyway".
echo If nothing happens, right-click Setup.exe -^> Run as administrator.
echo.
pause
