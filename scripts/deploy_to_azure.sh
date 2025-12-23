#!/usr/bin/env bash
set -euo pipefail

# Deploy script for Azure Linux Web App
# Usage: ./scripts/deploy_to_azure.sh <webapp-name> <resource-group> [--skip-build]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WEBAPP_NAME="${1:-}"
RESOURCE_GROUP="${2:-}"

if [ -z "$WEBAPP_NAME" ] || [ -z "$RESOURCE_GROUP" ]; then
  echo "Usage: $0 <webapp-name> <resource-group> [--skip-build]"
  echo ""
  echo "Example: $0 my-infra-portal my-resource-group"
  exit 1
fi

SKIP_BUILD=false
if [ "${3:-}" == "--skip-build" ]; then
  SKIP_BUILD=true
fi

echo "=========================================="
echo "Deploying to Azure Web App: $WEBAPP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "=========================================="

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
  echo "Error: Azure CLI is not installed. Please install it from https://aka.ms/InstallAzureCLI"
  exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
  echo "Error: Not logged in to Azure. Run 'az login' first."
  exit 1
fi

# Build frontend if not skipped
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "[1/4] Building frontend..."
  ./scripts/build_frontend.sh
else
  echo ""
  echo "[1/4] Skipping frontend build (--skip-build flag)"
fi

# Collect static files
echo ""
echo "[2/4] Collecting static files..."
./scripts/collect_static.sh

# Create deployment package
echo ""
echo "[3/4] Creating deployment package..."
DEPLOY_DIR=$(mktemp -d)
trap "rm -rf $DEPLOY_DIR" EXIT

# Copy necessary files
echo "  Copying files to deployment directory..."
rsync -av \
  --exclude='.git' \
  --exclude='.venv' \
  --exclude='node_modules' \
  --exclude='frontend' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env' \
  --exclude='db.sqlite3' \
  --exclude='.cursor' \
  --exclude='*.log' \
  "$ROOT_DIR/" "$DEPLOY_DIR/"

# Create zip file
ZIP_FILE="$ROOT_DIR/deploy.zip"
cd "$DEPLOY_DIR"
zip -r "$ZIP_FILE" . -q
cd "$ROOT_DIR"

echo "  Deployment package created: $ZIP_FILE"

# Deploy to Azure
echo ""
echo "[4/4] Deploying to Azure Web App..."
az webapp deployment source config-zip \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --src "$ZIP_FILE"

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify App Settings in Azure Portal:"
echo "   - DJANGO_EASYAUTH_MODE = azure"
echo "   - AZURE_STORAGE_ACCOUNT_NAME = <your-storage-account>"
echo "   - AZURE_STORAGE_CONTAINER = git-backups"
echo "   - AZURE_DEVOPS_PAT = <your-pat> (for restore operations)"
echo "   - DJANGO_SECRET_KEY = <generate-secure-key>"
echo ""
echo "2. Configure Startup Command:"
echo "   ./scripts/start_app.sh"
echo ""
echo "3. Enable Authentication (Easy Auth) in Azure Portal"
echo ""
echo "4. Grant Managed Identity 'Storage Blob Data Reader' role on storage account"
echo ""
echo "Web App URL: https://$WEBAPP_NAME.azurewebsites.net"
echo ""

