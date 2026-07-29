@echo off
rem ---------------------------------------------------------------
rem  Genba Keiro app - desktop version launcher
rem  (This file is kept in plain ASCII on purpose: Japanese text
rem   inside a .bat breaks depending on the console code page.)
rem ---------------------------------------------------------------
setlocal
set "APPDIR=%~dp0desktop"
set "EXE=%APPDIR%\node_modules\electron\dist\electron.exe"

if not exist "%EXE%" (
  echo.
  echo   First run: downloading the parts it needs.
  echo   Please stay online and wait a few minutes...
  echo.
  pushd "%APPDIR%"
  call npm install
  popd
)

if not exist "%EXE%" (
  echo.
  echo   Setup failed. Please check your internet connection and try again.
  echo.
  pause
  exit /b 1
)

start "" "%EXE%" "%APPDIR%"
