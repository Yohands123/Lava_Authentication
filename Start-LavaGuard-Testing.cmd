@echo off
cd /d "%~dp0"
if not exist "node_modules\@playwright\test" (
  echo Install dependencies with npm ci before starting the test console.
  pause
  exit /b 1
)
call npm run test:live
if errorlevel 1 pause
