@echo off
REM Atalho para publicar: corre scripts\publicar.ps1 sem esbarrar na politica de scripts do Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publicar.ps1"
