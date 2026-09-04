@echo off
cd /d "%~dp0"
start "Anime Imposteur Multiplayer - GitHub" cmd.exe /k call "%~dp0github-publish-worker.bat"
