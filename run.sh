#!/usr/bin/env bash
# ============================================================
#  Directional Drilling - dev launcher (Linux / Ubuntu / WSL)
#
#  Starts the API (http://localhost:4000) and the web app
#  (http://localhost:5173) together, with the SQLite databases.
#  Usage:  ./run.sh        (run `chmod +x run.sh` once first)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "=== Directional Drilling - starting dev environment ==="
echo

# --- 0. Node version --------------------------------------
# The DDR and Air/Gas modules read the legacy .sqlite files through the
# built-in `node:sqlite`, which only exists unflagged from Node 22.13 / 23.4.
# On Node 20 the API dies at import with ERR_UNKNOWN_BUILTIN_MODULE, so check
# before anything else - and try to pick a newer Node up from nvm first.
node_ok() {
  command -v node >/dev/null 2>&1 &&
    node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit((a>22||(a===22&&b>=13))?0:1)' 2>/dev/null
}

if ! node_ok; then
  for nvm_sh in "${NVM_DIR:-$HOME/.nvm}/nvm.sh" /usr/local/opt/nvm/nvm.sh; do
    [ -s "$nvm_sh" ] || continue
    set +u
    # shellcheck disable=SC1090
    . "$nvm_sh" >/dev/null 2>&1 || true
    nvm use --lts >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
    set -u
    node_ok && echo "[node]  switched to $(node -v) via nvm."
    break
  done
fi

if ! node_ok; then
  echo "[error] Node $(node -v 2>/dev/null || echo '(not found)') is too old."
  echo "        This app needs Node 22.13+ (the API reads the legacy .sqlite"
  echo "        files through the built-in node:sqlite module)."
  echo
  echo "        Install per-user with nvm (no sudo):"
  echo "          curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
  echo "          export NVM_DIR=\"\$HOME/.nvm\" && . \"\$NVM_DIR/nvm.sh\""
  echo "          nvm install 24 && nvm alias default 24"
  echo
  echo "        ...or system-wide on Debian/Ubuntu:"
  echo "          curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -"
  echo "          sudo apt-get install -y nodejs"
  exit 1
fi
echo "[node]  $(node -v)  (npm $(npm -v))"

# --- 1. Dependencies --------------------------------------
if [ ! -d node_modules ]; then
  echo "[deps]  Installing npm dependencies (first run, this can take a while)..."
  npm install
else
  echo "[deps]  node_modules present - skipping install."
fi

# --- 2. API environment file ------------------------------
# apps/api/.env is gitignored; Prisma (the CLI *and* the generated client) reads
# DATABASE_URL from it, so without it both `migrate deploy` and the server fail.
if [ ! -f apps/api/.env ]; then
  echo "[env]   apps/api/.env missing - creating it from apps/api/.env.example."
  cp apps/api/.env.example apps/api/.env
fi
# The report-entry login tokens are signed with ENTRY_TOKEN_SECRET; with none set
# the server invents one per process and every restart logs the rigs out.
if ! grep -qE '^ENTRY_TOKEN_SECRET=.+' apps/api/.env; then
  secret="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  if grep -qE '^ENTRY_TOKEN_SECRET=' apps/api/.env; then
    sed -i.bak "s|^ENTRY_TOKEN_SECRET=.*|ENTRY_TOKEN_SECRET=$secret|" apps/api/.env && rm -f apps/api/.env.bak
  else
    printf '\nENTRY_TOKEN_SECRET=%s\n' "$secret" >> apps/api/.env
  fi
  echo "[env]   generated ENTRY_TOKEN_SECRET in apps/api/.env (report-entry logins now survive restarts)."
fi

# --- 3. Legacy SQLite databases ---------------------------
# The .sqlite files are gitignored (new.sqlite alone is ~440 MB), so where they
# live differs per machine. Honour an already-exported *_DB_DIR, otherwise take
# the first candidate directory that actually contains the marker file.
find_db_dir() {
  local marker="$1"; shift
  local d
  for d in "$@"; do
    if [ -f "$d/$marker" ]; then (cd "$d" && pwd); return 0; fi
  done
  return 1
}

if [ -z "${DDR_DB_DIR:-}" ]; then
  DDR_DB_DIR="$(find_db_dir new.sqlite sqlite_DB old/old_report_code old_report_code || true)"
fi
if [ -n "${DDR_DB_DIR:-}" ]; then
  export DDR_DB_DIR
  echo "[db]    DDR databases  : $DDR_DB_DIR"
  [ -f "$DDR_DB_DIR/DB.sqlite" ] ||
    echo "[warn]  DB.sqlite missing there - lookups and saved searches will be empty."
  [ -d "$DDR_DB_DIR/DDR-Delphi/LITHO" ] ||
    echo "[note]  No DDR-Delphi/LITHO/ there - lithology tiles fall back to flat colours."
else
  echo "[warn]  new.sqlite not found - DDR tabs (incl. Mud Properties) will be empty."
  echo "        Put new.sqlite + DB.sqlite in ./sqlite_DB/, or export DDR_DB_DIR=/path/to/them."
fi

if [ -z "${AIRMUD_DB_DIR:-}" ]; then
  AIRMUD_DB_DIR="$(find_db_dir DRYGAS.sqlite old_air_mud_code old/old_air_mud_code sqlite_DB || true)"
fi
if [ -n "${AIRMUD_DB_DIR:-}" ]; then
  export AIRMUD_DB_DIR
  echo "[db]    Air/Gas samples: $AIRMUD_DB_DIR"
else
  echo "[note]  Air/Gas sample DBs not found - that page uses its built-in presets."
fi

# --- 4. Build shared packages (picks up standalone edits) --
echo "[build] Building @dd/shared and @dd/grd..."
npm run build:shared
npm run build:grd

# --- 5. Database: Prisma client + apply migrations ---------
echo "[db]    Generating Prisma client and applying migrations..."
npm run db:generate
npm --workspace apps/api exec -- prisma migrate deploy

# --- 6. Run both servers ----------------------------------
echo
echo "  API : http://localhost:4000   (health: /health)"
echo "  Web : http://localhost:5173"
echo
echo "[run]   Starting API + web. Press Ctrl+C to stop."
echo
npm run dev
