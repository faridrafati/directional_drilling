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

REM --- 0. Node version --------------------------------------
REM The DDR and Air/Gas modules read the legacy .sqlite files through the
REM built-in node:sqlite, which only exists unflagged from Node 22.13 / 23.4.
REM On Node 20 the API dies at import with ERR_UNKNOWN_BUILTIN_MODULE.
where node >nul 2>&1 || goto :oldnode
node -e "const v=process.versions.node.split('.').map(Number);process.exit((v[0]>22||(v[0]===22&&v[1]>=13))?0:1)" 2>nul
if errorlevel 1 goto :oldnode
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo [node]  %NODE_VER%

REM --- 1. Dependencies --------------------------------------
if not exist "node_modules" (
  echo [deps]  Installing npm dependencies ^(first run, this can take a while^)...
  call npm install || goto :fail
) else (
  echo [deps]  node_modules present - skipping install.
)

REM --- 2. API environment file ------------------------------
REM apps\api\.env is gitignored; Prisma (the CLI *and* the generated client)
REM reads DATABASE_URL from it, so without it both `migrate deploy` and the
REM server fail.
if not exist "apps\api\.env" (
  echo [env]   apps\api\.env missing - creating it from apps\api\.env.example.
  copy /y "apps\api\.env.example" "apps\api\.env" >nul || goto :fail
)
REM The report-entry login tokens are signed with ENTRY_TOKEN_SECRET; with none
REM set the server invents one per process and every restart logs the rigs out.
findstr /r /c:"^ENTRY_TOKEN_SECRET=..*" "apps\api\.env" >nul 2>&1
if not errorlevel 1 goto :secret_ok
for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "ENTRY_SECRET=%%s"
findstr /v /r /c:"^ENTRY_TOKEN_SECRET=" "apps\api\.env" > "apps\api\.env.tmp"
move /y "apps\api\.env.tmp" "apps\api\.env" >nul
echo ENTRY_TOKEN_SECRET=%ENTRY_SECRET%>> "apps\api\.env"
echo [env]   generated ENTRY_TOKEN_SECRET in apps\api\.env ^(report-entry logins now survive restarts^).
:secret_ok

REM --- 3. Legacy SQLite databases ---------------------------
REM The .sqlite files are gitignored ^(new.sqlite alone is ~440 MB^), so where
REM they live differs per machine. Honour an already-set *_DB_DIR, otherwise
REM take the first candidate folder that actually holds the marker file.
if defined DDR_DB_DIR goto :ddr_found
if exist "sqlite_DB\new.sqlite" set "DDR_DB_DIR=%CD%\sqlite_DB"
if defined DDR_DB_DIR goto :ddr_found
if exist "old\old_report_code\new.sqlite" set "DDR_DB_DIR=%CD%\old\old_report_code"
if defined DDR_DB_DIR goto :ddr_found
if exist "old_report_code\new.sqlite" set "DDR_DB_DIR=%CD%\old_report_code"
if defined DDR_DB_DIR goto :ddr_found

echo [warn]  new.sqlite not found - DDR tabs ^(incl. Mud Properties^) will be empty.
echo         Put new.sqlite + DB.sqlite in .\sqlite_DB\, or set DDR_DB_DIR to their folder.
goto :ddr_done

:ddr_found
echo [db]    DDR databases  : %DDR_DB_DIR%
if not exist "%DDR_DB_DIR%\DB.sqlite" echo [warn]  DB.sqlite missing there - lookups and saved searches will be empty.
if not exist "%DDR_DB_DIR%\DDR-Delphi\LITHO" echo [note]  No DDR-Delphi\LITHO\ there - lithology tiles fall back to flat colours.

:ddr_done
if defined AIRMUD_DB_DIR goto :airmud_found
if exist "old_air_mud_code\DRYGAS.sqlite" set "AIRMUD_DB_DIR=%CD%\old_air_mud_code"
if defined AIRMUD_DB_DIR goto :airmud_found
if exist "old\old_air_mud_code\DRYGAS.sqlite" set "AIRMUD_DB_DIR=%CD%\old\old_air_mud_code"
if defined AIRMUD_DB_DIR goto :airmud_found
if exist "sqlite_DB\DRYGAS.sqlite" set "AIRMUD_DB_DIR=%CD%\sqlite_DB"
if defined AIRMUD_DB_DIR goto :airmud_found

echo [note]  Air/Gas sample DBs not found - that page uses its built-in presets.
goto :airmud_done

:airmud_found
echo [db]    Air/Gas samples: %AIRMUD_DB_DIR%

:airmud_done

REM --- 4. Build shared packages (picks up standalone edits) --
echo [build] Building @dd/shared and @dd/grd...
call npm run build:shared || goto :fail
call npm run build:grd || goto :fail

REM --- 5. Database: Prisma client + apply migrations ---------
echo [db]    Generating Prisma client and applying migrations...
call npm run db:generate || goto :fail
call npm --workspace apps/api exec -- prisma migrate deploy || goto :fail

REM --- 6. Run both servers ----------------------------------
echo.
echo   API : http://localhost:4000   ^(health: /health^)
echo   Web : http://localhost:5173
echo.
echo [run]   Starting API + web. Press Ctrl+C to stop.
echo.
call npm run dev
goto :end

:oldnode
echo [error] Node is missing or too old - this app needs Node 22.13 or newer.
echo         The API reads the legacy .sqlite files through the built-in
echo         node:sqlite module, which Node 20 does not have.
echo.
echo         Install the current LTS from https://nodejs.org/en/download
echo         or, with a package manager:
echo           winget install OpenJS.NodeJS.LTS
echo         With nvm-windows:
echo           nvm install lts ^&^& nvm use lts
echo.
exit /b 1

:fail
echo.
echo *** Startup failed - see the messages above. ***
exit /b 1

:end
endlocal
