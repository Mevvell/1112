@echo off
chcp 65001 > nul
title My fav - 推し活ポータル
echo My fav を起動しています...
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
