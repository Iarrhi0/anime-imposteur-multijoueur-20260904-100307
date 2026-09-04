@echo off
cd /d "%~dp0"
start "Anime Imposteur - Firebase FIX V4" cmd.exe /k powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-firebase-fix-v4.ps1"
