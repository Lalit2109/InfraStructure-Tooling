# Azure Web App Deployment Guide

This guide covers deploying the Infra Portal to Azure Linux Web App.

## Prerequisites

1. **Azure CLI** installed and logged in:
   ```bash
   az login
   az account set --subscription <your-subscription-id>
   ```

2. **Azure Web App** created:
   - Runtime stack: **Python 3.11** (or 3.9/3.10)
   - OS: **Linux**
   - App Service Plan: Standard or higher (for better performance)

## Quick Deploy

```bash
./scripts/deploy_to_azure.sh <webapp-name> <resource-group>
```

Example:
```bash
./scripts/deploy_to_azure.sh my-infra-portal my-resource-group
```

## Step-by-Step Deployment

### 1. Build and Prepare

```bash
# Build frontend
./scripts/build_frontend.sh

# Collect static files
./scripts/collect_static.sh
```

### 2. Deploy to Azure

**Option A: Using the deployment script (recommended)**
```bash
./scripts/deploy_to_azure.sh <webapp-name> <resource-group>
```

**Option B: Manual Zip Deploy**
```bash
# Create zip (excluding unnecessary files)
zip -r deploy.zip . -x "*.git*" "*node_modules*" "*.venv*" "*frontend*" "*__pycache__*" "*.pyc" "*.env" "*db.sqlite3"

# Deploy
az webapp deployment source config-zip \
  --resource-group <resource-group> \
  --name <webapp-name> \
  --src deploy.zip
```

**Option C: Using GitHub Actions / Azure DevOps**
- Set up CI/CD pipeline
- Run build scripts in pipeline
- Deploy using Azure Web App deployment task

## Required Azure Web App Configuration

### 1. App Settings (Configuration → Application settings)

Add these **Application Settings**:

| Setting Name | Value | Description |
|-------------|-------|-------------|
| `DJANGO_EASYAUTH_MODE` | `azure` | Enables Easy Auth enforcement |
| `DJANGO_SECRET_KEY` | `<generate-secure-key>` | Django secret key (generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) |
| `DJANGO_DEBUG` | `False` | Disable debug mode in production |
| `DJANGO_ALLOWED_HOSTS` | `your-app.azurewebsites.net,*.azurewebsites.net` | Comma-separated list of allowed hosts |
| `AZURE_STORAGE_ACCOUNT_NAME` | `<your-storage-account>` | Azure Storage account name for backups |
| `AZURE_STORAGE_CONTAINER` | `git-backups` | Container name for backups |
| `AZURE_STORAGE_PREFIX` | `<optional-prefix>` | Optional prefix path in container |
| `AZURE_DEVOPS_PAT` | `<your-pat>` | Azure DevOps Personal Access Token (for restore operations) |
| `PYTHONPATH` | `/home/site/wwwroot` | Python path (usually auto-set, but verify) |

**Optional (for local dev overrides):**
- `DJANGO_BACKUPS_MOCK`: Set to `true` to use mock data (not recommended in production)

### 2. Startup Command (Configuration → General settings)

Set the **Startup Command** to:
```bash
./scripts/start_app.sh
```

Or if scripts are not executable:
```bash
bash ./scripts/start_app.sh
```

### 3. Python Version

In **Configuration → General settings**, ensure:
- **Stack**: Python
- **Major Version**: 3.11 (or 3.9/3.10)
- **Minor Version**: Latest available

### 4. Authentication (Easy Auth)

1. Go to **Authentication** in Azure Portal
2. Click **Add identity provider**
3. Select **Microsoft** (Entra ID)
4. Choose **App registration** or create new
5. Set **Restrict access** to:
   - **Require authentication** (recommended for all routes)
   - Or at minimum: require auth for `/api/*` and `/`
6. Save

### 5. Managed Identity (for Storage Access)

1. Go to **Identity** in Azure Portal
2. Enable **System assigned managed identity**
3. Note the **Object (principal) ID**
4. Go to your **Storage Account** → **Access control (IAM)**
5. Click **Add role assignment**
6. Select role: **Storage Blob Data Reader**
7. Assign to: **Managed identity**
8. Select your Web App's managed identity
9. Save

### 6. Static Files

Static files are handled by **WhiteNoise** middleware. Ensure:
- `STATIC_ROOT` is set correctly (default: `backend/staticfiles`)
- `collectstatic` runs during deployment (included in deploy script)
- WhiteNoise middleware is in `MIDDLEWARE` (already configured)

### 7. Database (SQLite for POC)

For POC, SQLite is used. The database file (`db.sqlite3`) will be created automatically.

**For production**, consider:
- Azure Database for PostgreSQL
- Azure Database for MySQL
- Azure SQL Database

Update `DATABASES` in `settings.py` accordingly.

## Post-Deployment Verification

1. **Check Application Logs**:
   ```bash
   az webapp log tail --name <webapp-name> --resource-group <resource-group>
   ```

2. **Test the Application**:
   - Visit `https://<webapp-name>.azurewebsites.net`
   - Should redirect to Microsoft login (Easy Auth)
   - After login, should see the portal UI

3. **Test API Endpoints**:
   ```bash
   curl https://<webapp-name>.azurewebsites.net/api/menu
   ```

4. **Check Static Files**:
   - Verify frontend assets load correctly
   - Check browser console for 404 errors

## Troubleshooting

### Application won't start

1. **Check logs**:
   ```bash
   az webapp log tail --name <webapp-name> --resource-group <resource-group>
   ```

2. **Verify startup command**:
   - Should be: `./scripts/start_app.sh` or `bash ./scripts/start_app.sh`
   - Check that scripts are executable

3. **Check Python version**:
   - Ensure Python 3.9+ is selected
   - Verify in logs: `Python version: 3.x.x`

4. **Verify dependencies**:
   - Check `requirements.txt` is present
   - Azure will auto-install on first deploy

### Static files not loading

1. **Run collectstatic**:
   ```bash
   az webapp ssh --name <webapp-name> --resource-group <resource-group>
   cd /home/site/wwwroot
   python backend/manage.py collectstatic --noinput
   ```

2. **Check STATIC_ROOT**:
   - Verify `backend/staticfiles` exists
   - Check WhiteNoise middleware is enabled

### Easy Auth not working

1. **Check App Settings**:
   - `DJANGO_EASYAUTH_MODE` should be `azure`
   - Verify Authentication is enabled in Azure Portal

2. **Check headers**:
   - Easy Auth should inject `X-MS-CLIENT-PRINCIPAL` header
   - Check application logs for permission errors

### Backup module not working

1. **Check Storage Access**:
   - Verify Managed Identity has `Storage Blob Data Reader` role
   - Or set `AZURE_STORAGE_CONNECTION_STRING` in App Settings

2. **Check App Settings**:
   - `AZURE_STORAGE_ACCOUNT_NAME`
   - `AZURE_STORAGE_CONTAINER`
   - `AZURE_DEVOPS_PAT` (for restore)

3. **Enable mock mode for testing**:
   - Set `DJANGO_BACKUPS_MOCK=true` in App Settings

## Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      
      - name: Build frontend
        run: ./scripts/build_frontend.sh
      
      - name: Collect static
        run: ./scripts/collect_static.sh
      
      - name: Deploy to Azure
        uses: azure/webapps-deploy@v2
        with:
          app-name: <your-webapp-name>
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
```

### Azure DevOps

Use Azure Pipelines with:
- Python task to install dependencies
- npm task to build frontend
- Azure Web App deployment task

## Security Checklist

- [ ] `DJANGO_DEBUG` set to `False`
- [ ] `DJANGO_SECRET_KEY` is a strong random value
- [ ] `DJANGO_ALLOWED_HOSTS` includes only your domains
- [ ] Easy Auth enabled and configured
- [ ] `DJANGO_EASYAUTH_MODE` set to `azure`
- [ ] Managed Identity configured for storage access
- [ ] No sensitive data in code (use App Settings)
- [ ] HTTPS enforced (default in Azure Web App)

## Cost Optimization

- Use **Basic** or **Standard** App Service Plan for POC
- Consider **Consumption Plan** for low traffic
- Enable **Auto-shutdown** for dev/test environments
- Use **Azure Storage** with appropriate tier (Hot/Cool)

