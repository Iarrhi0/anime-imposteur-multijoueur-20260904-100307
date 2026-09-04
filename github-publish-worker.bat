@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Anime Imposteur Multiplayer - GitHub

echo ============================================================
echo      ANIME IMPOSTEUR MULTIPLAYER - GITHUB
echo ============================================================
echo.

findstr /C:"firebaseConfig = null" "firebase-config.js" >nul 2>nul
if not errorlevel 1 (
  echo [ERREUR] Firebase n'est pas encore configure.
  echo Lance d'abord 1_SETUP_FIREBASE.bat
  goto :end
)

where git.exe >nul 2>nul
if errorlevel 1 (
  winget install --id Git.Git --exact --accept-package-agreements --accept-source-agreements
  set "PATH=%PATH%;C:\Program Files\Git\cmd"
)

where gh.exe >nul 2>nul
if errorlevel 1 (
  winget install --id GitHub.cli --exact --accept-package-agreements --accept-source-agreements
  set "PATH=%PATH%;C:\Program Files\GitHub CLI"
)

gh auth status -h github.com >nul 2>nul
if errorlevel 1 (
  echo GitHub va ouvrir Microsoft Edge.
  gh auth login --hostname github.com --git-protocol https --web --scopes "repo,workflow"
  if errorlevel 1 goto :autherror
)

gh auth setup-git >nul 2>nul
for /f "delims=" %%U in ('gh api user --jq ".login"') do set "GH_USER=%%U"

if not defined GH_USER goto :autherror

echo [OK] Compte : !GH_USER!

if exist ".git" rmdir /s /q ".git"

git init
git branch -M main
git config user.name "!GH_USER!"
git config user.email "!GH_USER!@users.noreply.github.com"
git add .
git commit -m "Anime Imposteur Multiplayer"

set "REPO=anime-imposteur-multijoueur"
gh repo view "!GH_USER!/!REPO!" >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%T in ('powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%T"
  set "REPO=anime-imposteur-multijoueur-!STAMP!"
)

echo.
echo Creation de !GH_USER!/!REPO! ...

gh repo create "!GH_USER!/!REPO!" --public --description "Anime Imposteur multijoueur" --source "." --remote origin --push
if errorlevel 1 goto :repoerror

echo.
echo Activation GitHub Pages...

gh api --method POST -H "Accept: application/vnd.github+json" "repos/!GH_USER!/!REPO!/pages" -f "build_type=workflow" >nul 2>nul
if errorlevel 1 (
  gh api --method PUT -H "Accept: application/vnd.github+json" "repos/!GH_USER!/!REPO!/pages" -f "build_type=workflow" >nul 2>nul
)

set "SITE=https://!GH_USER!.github.io/!REPO!/"
gh repo edit "!GH_USER!/!REPO!" --homepage "!SITE!" >nul 2>nul

git commit --allow-empty -m "Deploy GitHub Pages" >nul 2>nul
git push origin main

echo.
echo ============================================================
echo DEPLOIEMENT LANCE
echo ============================================================
echo.
echo Depot : https://github.com/!GH_USER!/!REPO!
echo Site  : !SITE!
echo.
echo J'ouvre GitHub Actions. Quand le workflow devient vert,
echo le site multijoueur est disponible.
start "" "https://github.com/!GH_USER!/!REPO!/actions"
goto :end

:autherror
echo [ERREUR] Connexion GitHub impossible.
goto :end

:repoerror
echo [ERREUR] Creation ou push du depot impossible.

:end
echo.
echo Cette fenetre reste ouverte.
set /p _CLOSE=Appuie sur ENTREE pour fermer :
