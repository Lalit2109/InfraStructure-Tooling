#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "[collect_static] Activating virtual environment (if present)..."
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

export DJANGO_EASYAUTH_MODE="${DJANGO_EASYAUTH_MODE:-azure}"
export PYTHONPATH="$ROOT_DIR:${PYTHONPATH:-}"

echo "[collect_static] Running Django collectstatic..."
python backend/manage.py collectstatic --noinput

echo "[collect_static] Done."


