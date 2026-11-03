@echo off
cd /d "%~dp0"
title LeadForge v1.0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 (
 echo.
 echo LeadForge could not start. Review the PowerShell error above.
 pause
)
