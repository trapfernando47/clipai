@echo off
title Multiverso dos Desenhos — Seletor de Episodios
color 0D
cd /d "%~dp0\.."
echo.
echo  =====================================================
echo   MULTIVERSO DOS DESENHOS — Seletor de Episodios
echo  =====================================================
echo.
node scripts/select-episode.js
pause
