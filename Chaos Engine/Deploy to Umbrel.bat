@echo off
rem Builds the Chaos Engine and installs it on the Umbrel. Pass a host to override: Deploy to Umbrel.bat umbrel@100.x.y.z
cd /d "%~dp0"
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-umbrel.ps1
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-umbrel.ps1 -UmbrelHost %1
)
pause
