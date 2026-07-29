@echo off
chcp 65001 >nul
cd /d "%~dp0desktop"

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo   はじめての起動です。必要なものを入れます。
  echo   ネットにつないだまま、5分ほどお待ちください…
  echo.
  call npm install
  if not exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo   うまく入りませんでした。ネットにつながっているか確かめてください。
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" .
