#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/frontend"

echo "[build_frontend] Installing frontend dependencies..."
npm install

echo "[build_frontend] Building Vite React app..."
npm run build

echo "[build_frontend] Copying built assets into Django static directory..."
mkdir -p "$ROOT_DIR/backend/static"
cp -R dist/* "$ROOT_DIR/backend/static/"

echo "[build_frontend] Done."


