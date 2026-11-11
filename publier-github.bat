@echo off
chcp 65001 >nul
title XOXO PARTY - Publication du lien fixe GitHub
cd /d "%~dp0"

echo.
echo   XOXO PARTY - Publication sur GitHub Pages (lien fixe)
echo   =====================================================
echo   Cree le depot public naulio/xoxo-party (si besoin),
echo   envoie le code, puis publie le site :
echo   https://naulio.github.io/xoxo-party/
echo.

gh auth status >nul 2>&1
if errorlevel 1 (
  echo   Connexion a GitHub requise : une page va s'ouvrir dans ton navigateur.
  gh auth login --web --git-protocol https
)

gh repo view naulio/xoxo-party >nul 2>&1
if errorlevel 1 (
  echo   Creation du depot public naulio/xoxo-party...
  gh repo create naulio/xoxo-party --public --description "XOXO PARTY - carte du bar en direct, commandes via l'app, file d'attente live"
)

git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin https://github.com/naulio/xoxo-party.git

echo   Envoi du code...
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -u origin main

if not exist node_modules call npm install --no-audit --no-fund

echo   Publication du site...
call npm run deploy

echo.
echo   Termine. Lance maintenant start-en-ligne.bat : le serveur
echo   branchera automatiquement le lien fixe sur ton PC.
echo.
pause
