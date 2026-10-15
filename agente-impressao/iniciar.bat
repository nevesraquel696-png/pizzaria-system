@echo off
title Agente de Impressao - Pizzaria
cd /d "%~dp0"
if not exist node_modules (
    echo Instalando pela primeira vez, aguarde...
    call npm install
)
:inicio
node agente.js
echo.
echo O agente parou. Reiniciando em 10 segundos... (feche esta janela para parar)
timeout /t 10 >nul
goto inicio
