@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bot-ctl.ps1" start
set "rc=%errorlevel%"
if "%~1"=="" pause
exit /b %rc%
