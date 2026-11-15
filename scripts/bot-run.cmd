@echo off
rem Launcher for start-bot-hidden.vbs: sets working directory and writes both logs.
cd /d "%~dp0.."
node src\index.js >> "%~dp0..\logs\bot.out.log" 2>> "%~dp0..\logs\bot.err.log"
exit /b %errorlevel%
