@echo off
title ClipAI — Servidor Local
color 09
cd /d "%~dp0\.."
echo.
echo  =====================================================
echo   ClipAI — Iniciando servidor local
echo   Acesse: http://localhost:3000
echo  =====================================================
echo.
npm run dev
