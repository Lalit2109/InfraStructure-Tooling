#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[start_app] Activating virtual environment (if present)..."
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

export DJANGO_EASYAUTH_MODE="${DJANGO_EASYAUTH_MODE:-azure}"
export PYTHONPATH="$ROOT_DIR:${PYTHONPATH:-}"

echo "[start_app] Starting Gunicorn..."
exec gunicorn backend.wsgi:application --bind=0.0.0.0:8000


