@echo off
title Multiverso dos Desenhos — Processar Pasta
color 0A
cd /d "%~dp0\.."
echo.
echo  =====================================================
echo   MULTIVERSO DOS DESENHOS — Processar Pasta
echo  =====================================================
echo.
node scripts/process-folder.js
pause
