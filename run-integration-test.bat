@echo off
chcp 65001 >nul
title Mucho Matcha - Integration Test

echo ===============================================
echo  Mucho Matcha - Test de Integracion
echo  Flujo: Strawberry Matcha
echo ===============================================
echo.
echo %date% %time%
echo.

set LOG_DIR=tests\integration\logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set LOG_FILE=%LOG_DIR%\test-result-%datetime:~0,8%-%datetime:~8,6%.log

echo.
echo [1/3] Verificando dependencias...
if not exist "node_modules" (
    echo  - Instalando dependencias...
    call npm install --silent
) else (
    echo  - OK
)

echo.
echo [2/3] Generando Prisma Client...
call npx prisma generate >nul 2>&1
echo  - OK

echo.
echo [3/3] Ejecutando test de integracion...
echo.
echo Resultados se guardan en: %LOG_FILE%
echo ===============================================
call npx vitest run tests\integration\ --reporter=verbose > "%LOG_FILE%" 2>&1
set EXIT_CODE=%ERRORLEVEL%
type "%LOG_FILE%"
echo ===============================================

echo.
if %EXIT_CODE% EQU 0 (
    echo [SUCCESS] Test paso exitosamente.
) else (
    echo [FAILED] Test fallo - revisa el log para detalles.
)
echo Log: %LOG_FILE%
echo.
pause
