#!/usr/bin/env bash
# ============================================================
#  Directional Drilling - dev launcher (Linux / Ubuntu)
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

# --- 1. Dependencies --------------------------------------
if [ ! -d node_modules ]; then
  echo "[deps]  Installing npm dependencies (first run, this can take a while)..."
  npm install
else
  echo "[deps]  node_modules present - skipping install."
fi

# --- 2. Build shared packages (picks up standalone edits) --
echo "[build] Building @dd/shared and @dd/grd..."
npm run build:shared
npm run build:grd

# --- 3. Database: Prisma client + apply migrations ---------
echo "[db]    Generating Prisma client and applying migrations..."
npm run db:generate
npm --workspace apps/api exec -- prisma migrate deploy

# --- 3b. Legacy DDR data DB presence check -----------------
if [ ! -f old/old_report_code/new.sqlite ]; then
  echo "[warn]  old_report_code/new.sqlite not found - DDR tabs (incl. Mud Properties) will be empty on this PC."
  echo "        Copy new.sqlite + DB.sqlite into old_report_code/ to enable them."
fi

# --- 4. Run both servers ----------------------------------
echo
echo "  API : http://localhost:4000"
echo "  Web : http://localhost:5173"
echo
echo "[run]   Starting API + web. Press Ctrl+C to stop."
echo
npm run dev
