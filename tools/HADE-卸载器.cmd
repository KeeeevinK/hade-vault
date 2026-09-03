@echo off
rem  HADE uninstaller launcher.
rem
rem  ASCII ONLY -- never put non-ASCII text in this file.
rem  After "chcp 65001" cmd.exe seeks by byte but counts by char, so every
rem  multi-byte character here shifts its file pointer and corrupts later
rem  lines (verified: the drift grows with each Chinese char above).
rem  All Chinese output comes from node, which handles UTF-8 correctly.
setlocal
title HADE Uninstaller
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 goto nonode

set "OUTLOG=%TEMP%\hade-ui.out.log"
set "ERRLOG=%TEMP%\hade-ui.err.log"
if exist "%OUTLOG%" del "%OUTLOG%" >nul 2>nul
if exist "%ERRLOG%" del "%ERRLOG%" >nul 2>nul

rem  Start node hidden; this window closes once the server is up.
rem  Stop it with the page's own button, or let it idle out after 15 minutes.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process node -ArgumentList 'tools\hade-ui.js' -WorkingDirectory '%CD%' -WindowStyle Hidden -RedirectStandardOutput '%OUTLOG%' -RedirectStandardError '%ERRLOG%'" >nul 2>nul

set /a _n=0
:wait
ping -n 2 127.0.0.1 >nul 2>nul
findstr /c:"http://127.0.0.1" "%OUTLOG%" >nul 2>nul && goto ok
set /a _n+=1
if %_n% lss 12 goto wait

rem  Hidden start failed -- re-run in the foreground so the real error shows.
chcp 65001 >nul
echo.
node "tools\hade-ui.js"
echo.
pause
exit /b 1

:nonode
echo.
echo   Node.js not found.
echo   HADE needs it anyway - the wake hook runs on node.
echo   Install from https://nodejs.org then double-click this again.
echo.
pause
exit /b 1

:ok
exit
