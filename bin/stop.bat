@echo off
setlocal enabledelayedexpansion

REM DatasetMan - Simple Windows Stop Script
REM Stops the application running in the same directory

echo ==========================================
echo DatasetMan - Stopping
echo ==========================================

REM Find and kill Java processes
echo Stopping application...

REM Kill by port 8081
for /f "tokens=5" %%i in ('netstat -ano ^| find ":8081"') do (
    echo Found process using port 8081: %%i
    taskkill /pid %%i /f
    goto :success
)

REM Kill by JAR name
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq java.exe" /fo csv ^| findstr "datasetman"') do (
    echo Found datasetman process: %%i
    taskkill /pid %%i /f
    goto :success
)

:success
echo.
echo Application stop command sent
echo Please wait a few seconds for application to shut down

REM Wait and verify
timeout /t 3 /nobreak >nul

netstat -ano | find ":8081" >nul
if !errorlevel! equ 0 (
    echo WARNING: Application may still be running
) else (
    echo SUCCESS: Application stopped successfully
)

echo.
echo ==========================================
pause
