@echo off
REM ============================================================
REM  Directional Drilling - dev launcher (Windows)
REM
REM  Starts the API (http://localhost:4000) and the web app
REM  (http://localhost:5173) together, with the SQLite databases.
REM  Double-click this file, or run `run.bat` from a terminal.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo === Directional Drilling - starting dev environment ===
echo.

REM --- 1. Dependencies --------------------------------------
if not exist "node_modules" (
  echo [deps]  Installing npm dependencies ^(first run, this can take a while^)...
  call npm install || goto :fail
) else (
  echo [deps]  node_modules present - skipping install.
)

REM --- 2. Build shared packages (picks up standalone edits) --
echo [build] Building @dd/shared and @dd/grd...
call npm run build:shared || goto :fail
call npm run build:grd || goto :fail

REM --- 3. Database: Prisma client + apply migrations ---------
echo [db]    Generating Prisma client and applying migrations...
call npm run db:generate || goto :fail
call npm --workspace apps/api exec -- prisma migrate deploy || goto :fail

REM --- 3b. Legacy DDR data DB presence check -----------------
if not exist "old_report_code\new.sqlite" (
  echo [warn]  old_report_code\new.sqlite not found - DDR tabs ^(incl. Mud Properties^) will be empty on this PC.
  echo         Copy new.sqlite + DB.sqlite into old_report_code\ to enable them.
)

REM --- 4. Run both servers ----------------------------------
echo.
echo   API : http://localhost:4000
echo   Web : http://localhost:5173
echo.
echo [run]   Starting API + web. Press Ctrl+C to stop.
echo.
call npm run dev
goto :end

:fail
echo.
echo *** Startup failed - see the messages above. ***
exit /b 1

:end
endlocal
