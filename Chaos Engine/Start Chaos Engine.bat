@echo off
rem Game night: builds the Chaos Engine, serves it on port 4200 and opens the DM screen.
rem The port stays 4200 because the browser's autosave belongs to that address.
title Chaos Engine
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing packages. This takes a minute.
  call npm ci
  if errorlevel 1 goto failed
)

echo Preparing the war table...
call npx ng build --configuration production >build.log 2>&1
if errorlevel 1 (
  echo The build failed. Details are in build.log.
  goto failed
)

start "" "http://localhost:4200/dm"
node tools\serve.mjs 4200
if %errorlevel%==2 (
  echo Opened the Chaos Engine that is already running.
  timeout /t 5 >nul
  exit /b 0
)
exit /b 0

:failed
pause
exit /b 1
