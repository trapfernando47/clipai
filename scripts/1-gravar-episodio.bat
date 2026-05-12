@echo off
title Multiverso dos Desenhos — Gravar Episodio (Automatico)
color 0A
cd /d "%~dp0\.."
echo.
echo  =====================================================
echo   MULTIVERSO DOS DESENHOS — Gravacao Automatica
echo   (Voce pode usar o PC normalmente enquanto grava)
echo  =====================================================
echo.
node scripts/record-episode.js
pause
