@echo off
chcp 65001 >nul
title XOXO PARTY - Serveur local
cd /d "%~dp0"

echo.
echo   XOXO PARTY - Demarrage (mode Wi-Fi local)...
echo.

echo   Nettoyage des instances precedentes...
taskkill /f /im cloudflared.exe >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -match 'server[\\/]index\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

if not exist node_modules (
  echo   Premiere utilisation : installation des dependances...
  call npm install --no-audit --no-fund
)

if not exist dist (
  echo   Construction de l'application...
  call npm run build
)

start "" http://localhost:8787
node server\index.js

pause
