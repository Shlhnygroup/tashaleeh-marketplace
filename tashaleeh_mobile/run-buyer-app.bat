@echo off
chcp 65001 >nul
title Tashaleeh - Buyer App Server
set "PATH=%USERPROFILE%\Downloads\nodejs-portable\node-v24.17.0-win-x64;%PATH%"
set "NODE_TLS_REJECT_UNAUTHORIZED=0"
cd /d "%USERPROFILE%\Downloads\tashaleeh-marketplace\tashaleeh_mobile"
echo ============================================================
echo   Tashaleeh - BUYER app  (phone testing via Expo Go)
echo ------------------------------------------------------------
echo   1) Keep this window OPEN while testing.
echo   2) In Expo Go, enter the exp:// URL shown below.
echo   3) Press Ctrl+C here to stop the server.
echo ============================================================
echo.
node phone-dev.cjs
echo.
echo (Server stopped. Press any key to close.)
pause >nul
