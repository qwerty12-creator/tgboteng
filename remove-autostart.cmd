@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\autostart.ps1" remove
set "rc=%errorlevel%"
if "%~1"=="" pause
exit /b %rc%
