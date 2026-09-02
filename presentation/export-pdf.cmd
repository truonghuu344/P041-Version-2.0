@echo off
rem Double-click helper: exports presentation/index.html to PDF via Chrome headless.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [export-pdf] Node.js not found in PATH. Install Node 20+ first.
  pause
  exit /b 1
)
if not exist node_modules\puppeteer-core (
  echo [export-pdf] Installing dependencies...
  call npm install || goto :err
)
call npm run presentation:pdf || goto :err
echo Done. See Career-Assistant-Presentation.pdf
pause
exit /b 0
:err
echo [export-pdf] Export failed.
pause
exit /b 1
