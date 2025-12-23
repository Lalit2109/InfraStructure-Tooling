## Infra Portal – Django + React (Azure Web App)

This is a modular internal **infrastructure portal**:

- **Backend**: Django + Django REST Framework, with pluggable modules (`firewall`, `log_analytics`, `backups`).
- **Frontend**: React + Vite, Spotify‑style layout (sidebar, top bar, sub‑menu).
- **Deployment**: Azure Linux Web App (no containers), static files served by Django + WhiteNoise.
- **Auth in Azure**: App Service Authentication (Easy Auth) with Microsoft Entra ID.
- **Auth locally**: disabled for fast development.

---

## 1. Architecture Overview

- **Backend (`backend/`)**
  - `settings.py`: Django/DRF config, static files, installed apps.
  - `core/menu.py`: global **menu registry**:
    - `MENU_REGISTRY`: in‑memory list of module menus.
    - `register_module_menu(menu_definition: dict)`: modules call this at startup.
  - `core/views.py`: `MenuView` (`GET /api/menu`) returns the aggregated menu.
  - `core/permissions.py`: `IsInternalUser` – single place to plug Easy Auth vs local behavior.
  - `modules/`:
    - `firewall/`, `log_analytics/`, `backups/`:
      - `apps.py`: registers the module’s menu in `ready()`.
      - `api.py`: DRF API views + `urlpatterns`.
      - `services.py`: mock Azure logic (firewall rules, log analytics overview, backup status).
  - `urls.py`:
    - `/api/menu` – global menu API.
    - `/api/firewall/*`, `/api/log-analytics/*`, `/api/backups/*` – module APIs.

- **Frontend (`frontend/`)**
  - `src/layout/`:
    - `Sidebar.tsx`: left navigation, populated dynamically from `/api/menu`.
    - `TopBar.tsx`: global context (env/user) + active module title.
    - `SubMenu.tsx`: secondary nav, driven by active module’s `routes`.
    - `MainLayout.tsx`: shells the layout; computes active module and renders `Outlet`.
  - `src/modules/`:
    - `firewall/FirewallRules.tsx`: renders mock firewall rules.
    - `logs/LogsOverview.tsx`: renders log analytics workspace overview.
    - `backups/BackupStatus.tsx`: renders Git backup summary.
  - `src/api/menu.ts`: fetches `/api/menu`.
  - `App.tsx`:
    - Loads menu dynamically.
    - Sets up React Router routes that match the backend menu paths.

---

## 2. Menu Registry & Pluggable Modules

### 2.1 Backend menu registry

`core/menu.py` provides a central registry that all modules use:

```python
MENU_REGISTRY = []

def register_module_menu(menu_definition: dict):
    """
    {
        "id": "firewall",
        "title": "Firewall",
        "icon": "Security",
        "routes": [
            {"title": "Rules", "path": "/firewall/rules"},
            ...
        ]
    }
    """
    MENU_REGISTRY.append(menu_definition)
```

`GET /api/menu` returns `MENU_REGISTRY` as JSON. The frontend never hardcodes modules – it just renders what the API provides.

### 2.2 How modules self‑register

Each module defines an `AppConfig` and calls `register_module_menu` in `ready()`; for example, `firewall/apps.py`:

```python
from django.apps import AppConfig
from backend.core.menu import register_module_menu

class FirewallConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "backend.modules.firewall"
    verbose_name = "Firewall"

    def ready(self) -> None:
        register_module_menu(
            {
                "id": "firewall",
                "title": "Firewall",
                "icon": "Security",
                "routes": [
                    {"title": "Rules", "path": "/firewall/rules"},
                    {"title": "Policies", "path": "/firewall/policies"},
                ],
            }
        )
```

As long as your module’s app is listed in `INSTALLED_APPS`, its menu will be registered automatically.

### 2.3 Adding a new backend module

1. **Create the module package**

   Under `backend/modules/`:

   ```bash
   mkdir -p backend/modules/my_module
   touch backend/modules/my_module/__init__.py
   touch backend/modules/my_module/apps.py
   touch backend/modules/my_module/api.py
   touch backend/modules/my_module/services.py
   ```

2. **Define the app config and register the menu**

   In `apps.py`:

   ```python
   from django.apps import AppConfig
   from backend.core.menu import register_module_menu

   class MyModuleConfig(AppConfig):
       default_auto_field = "django.db.models.BigAutoField"
       name = "backend.modules.my_module"
       verbose_name = "My Module"

       def ready(self) -> None:
           register_module_menu(
               {
                   "id": "my_module",
                   "title": "My Module",
                   "icon": "Module",
                   "routes": [
                       {"title": "Overview", "path": "/my-module/overview"},
                   ],
               }
           )
   ```

3. **Implement module APIs**

   In `api.py`:

   ```python
   from django.urls import path
   from rest_framework.response import Response
   from rest_framework.views import APIView

   from backend.core.permissions import IsInternalUser

   class MyModuleOverviewView(APIView):
       permission_classes = [IsInternalUser]

       def get(self, request, *args, **kwargs):
           return Response({"status": "ok", "message": "My module overview"})

   urlpatterns = [
       path("overview", MyModuleOverviewView.as_view(), name="my-module-overview"),
   ]
   ```

4. **Hook the module URLs into the project**

   In `backend/urls.py`:

   ```python
   path("api/my-module/", include("backend.modules.my_module.api")),
   ```

5. **Add to `INSTALLED_APPS`**

   In `backend/settings.py`:

   ```python
   INSTALLED_APPS = [
       # ...
       "backend.modules.my_module.apps.MyModuleConfig",
   ]
   ```

After this, your module appears automatically in `/api/menu` and thus in the React sidebar/sub‑menu.

---

## 3. Frontend Layout & Dynamic Menus

### 3.1 High‑level layout

- `Sidebar`:
  - Shows one entry per module (from `/api/menu`).
  - When a module is clicked, it navigates to the first route in that module.

- `TopBar`:
  - Shows the active module title and simple chips for env/user (can be wired to real data later).

- `SubMenu`:
  - Shows the current module’s `routes` as a horizontal tab bar.
  - Uses `react-router-dom` to reflect active route state.

- `MainLayout`:
  - Reads `location.pathname` and finds the **active module** whose `id` is a prefix.
  - Renders `Sidebar`, `TopBar`, `SubMenu`, and `<Outlet />` for the module view.

### 3.2 Dynamic routing and menu loading

In `App.tsx`:

```tsx
const [modules, setModules] = useState<ModuleMenu[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  fetchMenu()
    .then((menus) => {
      setModules(menus)
      setError(null)
    })
    .catch((err) => {
      console.error('Failed to fetch menu:', err)
      setError(err.message || 'Failed to load menu from API')
    })
    .finally(() => setLoading(false))
}, [])
```

Routing:

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<MainLayout modules={modules} />}>
      {/* Redirect root to first module’s first route */}
      <Route index element={<Navigate to={modules[0].routes[0].path} replace />} />

      <Route path="/firewall/rules" element={<FirewallRules />} />
      <Route path="/logs/overview" element={<LogsOverview />} />
      <Route path="/backups/status" element={<BackupStatus />} />
    </Route>
  </Routes>
</BrowserRouter>
```

> When you add a new backend module and corresponding frontend view, you only need to add a new `<Route>` that matches the path specified in the module’s menu definition. The sidebar and sub‑menu remain fully dynamic.

---

## 4. Authentication: Local Dev vs Azure Easy Auth

### 4.1 Goals

- **Local development**: run everything without any auth friction.
- **Azure Web App**: enforce **App Service Authentication (Easy Auth)** with Entra ID; only permitted users can access the portal.

### 4.2 Permission class behavior

In `core/permissions.py` there is a single permission, `IsInternalUser`, that behaves differently based on an environment variable:

- When `DJANGO_EASYAUTH_MODE=local`:
  - All requests are allowed (no authentication).
- When `DJANGO_EASYAUTH_MODE=azure`:
  - Only requests with valid Easy Auth headers are allowed.

Example (simplified) implementation:

```python
import base64
import json
import os
from typing import Any, Dict

from rest_framework.permissions import BasePermission


def _parse_client_principal(request) -> Dict[str, Any] | None:
    principal_b64 = request.META.get("HTTP_X_MS_CLIENT_PRINCIPAL")
    if not principal_b64:
        return None

    try:
        principal_json = base64.b64decode(principal_b64).decode("utf-8")
        principal = json.loads(principal_json)
        return principal
    except Exception:
        return None


class IsInternalUser(BasePermission):
    """
    - Local dev: allow all (no auth) when DJANGO_EASYAUTH_MODE=local.
    - Azure Web App: require Easy Auth headers when DJANGO_EASYAUTH_MODE=azure.
    """

    def has_permission(self, request, view) -> bool:
        mode = os.getenv("DJANGO_EASYAUTH_MODE", "local").lower()

        # Local development: no auth enforced
        if mode == "local":
            return True

        # Azure App Service: enforce Easy Auth
        principal = _parse_client_principal(request)
        if not principal:
            return False

        # Optional: check roles / groups here using principal["claims"]
        return True
```

This permission is used by all APIs, including `/api/menu` and module endpoints.

### 4.3 Running locally (no auth)

1. Start the backend:

   ```bash
   cd infra-portal
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt

   export DJANGO_EASYAUTH_MODE=local
   export PYTHONPATH="$PWD"

   python backend/manage.py migrate
   python backend/manage.py runserver 0.0.0.0:8000
   ```

2. Start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev -- --host 0.0.0.0 --port 5173
   ```

3. Open `http://localhost:5173/` in your browser.

> In this mode there is no login – everything is open for development and testing.

### 4.4 Azure Web App with Easy Auth

1. **Enable App Service Authentication**

   In the Azure Portal for your Web App:

   - Go to **Authentication**.
   - Add identity provider:
     - Type: **Microsoft** (Entra ID).
     - Use your existing or new app registration.
   - Set **“Action to take when request is not authenticated”** to **“Log in with Microsoft Entra ID”** (or similar).

2. **Configure application settings**

   Under **Configuration → Application settings**:

   - `DJANGO_EASYAUTH_MODE = azure`
   - (Optional) other settings like `DJANGO_SETTINGS_MODULE` etc., if needed.

3. **What Easy Auth does**

   - Intercepts all HTTP requests.
   - Redirects unauthenticated users to Entra ID login.
   - After successful login, forwards the request to Django with headers:
     - `X-MS-CLIENT-PRINCIPAL-ID`
     - `X-MS-CLIENT-PRINCIPAL-NAME`
     - `X-MS-CLIENT-PRINCIPAL` (Base64 JSON payload).

4. **Django side**

   - `DJANGO_EASYAUTH_MODE=azure` means `IsInternalUser` will require a valid `X-MS-CLIENT-PRINCIPAL` header.
   - Users that did not pass through Easy Auth will receive a 403 from DRF.

> You can later extend `IsInternalUser` to only allow certain Entra groups/roles by inspecting `principal["claims"]`.

---

## 5. Git Backup Module (Azure DevOps Backups)

The Git Backup module provides functionality to browse Azure DevOps repository backups stored in Azure Blob Storage and restore them to Azure DevOps projects.

### 5.1 Module Overview

The backups module consists of:

- **Backend** (`backend/modules/backups/`):
  - `services.py`: Azure Storage discovery and Azure DevOps restore logic
  - `api.py`: REST API endpoints for listing backups, generating download links, and restoring
  - `apps.py`: Menu registration with "Available Backups" and "Restore" routes

- **Frontend** (`frontend/src/modules/backups/`):
  - `BackupsLayout.tsx`: Tabbed layout component
  - `BackupRepositoriesList.tsx`: Repository list and backup versions view
  - `RestoreWizard.tsx`: Multi-step restore wizard
  - `backups.css`: Module-specific styling

### 5.2 Azure Storage Configuration

The module discovers backups from Azure Blob Storage. Configure the following environment variables:

**Required (Azure Web App):**
- `AZURE_STORAGE_ACCOUNT_NAME`: Name of your Azure Storage account
- `AZURE_STORAGE_CONTAINER`: Container name where backups are stored (default: `git-backups`)
- `AZURE_STORAGE_PREFIX`: Optional prefix path in the container (e.g., `backups/2025`)

**Optional (for Managed Identity):**
- The module uses **Azure Managed Identity** by default in Azure Web App
- Ensure the Web App's Managed Identity has **Storage Blob Data Reader** role on the storage account

**Local Development:**
- `AZURE_STORAGE_CONNECTION_STRING`: Full connection string for local testing
- `DJANGO_BACKUPS_MOCK=true`: Enable mock mode (no real Azure Storage access)

**Storage Structure Assumption:**
The module expects backups to be organized as:
```
container/{org}/{project}/{repo}/yyyy-MM-dd-HHmm.zip
```

For example:
```
git-backups/myorg/ProjectAlpha/infra-terraform/2025-01-15-1430.zip
```

### 5.3 Azure DevOps API Configuration (for Restore)

To enable restore operations, configure Azure DevOps authentication:

**Option 1: Personal Access Token (PAT)**
- `AZURE_DEVOPS_PAT`: Personal Access Token with `Code (Read & Write)` scope
- Required permissions: Create repositories, import repositories

**Option 2: Managed Identity (Future)**
- Configure Managed Identity with appropriate Azure DevOps permissions
- Currently, PAT is required for restore operations

### 5.4 API Endpoints

**List Repositories:**
```
GET /api/backups/repositories
```
Returns list of Azure DevOps repositories with backups available.

**List Backup Versions:**
```
GET /api/backups/repositories/{repo_id}/versions
```
Returns all backup instances for a specific repository (e.g., last 90 days).

**Restore Preview:**
```
POST /api/backups/repositories/{repo_id}/restore-preview
Body: { "backup_id": "..." }
```
Returns preview information for a restore operation.

**Generate Download Link:**
```
POST /api/backups/repositories/{repo_id}/download-link
Body: { "backup_id": "..." }
```
Returns a time-limited SAS URL for downloading a backup zip.

**Restore to Azure DevOps:**
```
POST /api/backups/repositories/{repo_id}/restore
Body: {
  "backup_id": "...",
  "target_org": "myorg",
  "target_project": "MyProject",
  "target_repo_name": "my-repo",
  "visibility": "private"
}
```
Orchestrates restore to Azure DevOps. Returns status and repository URL if successful.

### 5.5 Frontend Features

**Available Backups Tab:**
- Lists all repositories with backups
- Search/filter by repository, project, or organization
- Click a repository to see backup versions
- Actions per backup:
  - **Download**: Generate and open download link
  - **Start Restore**: Navigate to restore wizard with backup pre-selected

**Restore Tab:**
- Multi-step wizard:
  1. **Select Backup**: Shows selected backup details
  2. **Choose Target**: Input target org, project, repo name, visibility
  3. **Confirm & Execute**: Review summary and start restore
  4. **Result**: Show success/failure with link to new repository

### 5.6 Local Development (Mock Mode)

For local development without Azure Storage access:

```bash
export DJANGO_BACKUPS_MOCK=true
export DJANGO_EASYAUTH_MODE=local
python backend/manage.py runserver
```

The module will return mock data for testing the UI.

To test with real Azure Storage:

```bash
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=..."
export AZURE_STORAGE_CONTAINER="git-backups"
export DJANGO_EASYAUTH_MODE=local
python backend/manage.py runserver
```

### 5.7 Retention Policy

The module assumes backups are retained for **90 days**. Retention expiry dates are calculated as:
```
retention_expires = backup_timestamp + 90 days
```

This is displayed in the backup versions table to help users identify backups that will expire soon.

---

## 6. Azure Deployment Scripts & Static Files

### 5.1 Requirements

`requirements.txt` includes:

```text
django>=4.2,<5.0
djangorestframework>=3.15,<4.0
gunicorn>=22.0,<23.0
whitenoise>=6.7,<7.0
```

### 5.2 Static file configuration (Django)

In `settings.py`:

```python
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    # ...
]

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
```

This allows Django + WhiteNoise to serve the built frontend and other static assets in Azure without extra services.

### 5.3 Scripts

#### `scripts/build_frontend.sh`

Builds the Vite app and copies it into the Django static folder:

```bash
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
```

#### `scripts/collect_static.sh`

Runs `collectstatic` so WhiteNoise can serve everything:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "[collect_static] Activating virtual environment (if present)..."
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

export DJANGO_EASYAUTH_MODE="${DJANGO_EASYAUTH_MODE:-azure}"
export PYTHONPATH="$ROOT_DIR:${PYTHONPATH:-}"

echo "[collect_static] Running Django collectstatic..."
python backend/manage.py collectstatic --noinput

echo "[collect_static] Done."
```

#### `scripts/start_app.sh`

Startup script for Azure Web App:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[start_app] Activating virtual environment (if present)..."
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

export DJANGO_EASYAUTH_MODE="${DJANGO_EASYAUTH_MODE:-azure}"
export PYTHONPATH="$ROOT_DIR:${PYTHONPATH:-}"

echo "[start_app] Starting Gunicorn..."
exec gunicorn backend.wsgi:application --bind=0.0.0.0:8000
```

> Azure App Service **Startup command** should be:
>
> ```bash
> ./scripts/start_app.sh
> ```

---

## 7. Deploying to Azure Linux Web App (Summary)

1. **Create the Web App**

   - Runtime stack: **Python 3.11** (or compatible with your venv).
   - OS: **Linux**.

2. **Configure App Settings**

   - `DJANGO_EASYAUTH_MODE = azure`
   - `AZURE_STORAGE_ACCOUNT_NAME = <your-storage-account>`
   - `AZURE_STORAGE_CONTAINER = git-backups` (or your container name)
   - `AZURE_DEVOPS_PAT = <your-pat>` (for restore operations)
   - Any DB connection settings if/when you move off SQLite.
   
   **Storage Access:**
   - Enable **Managed Identity** on the Web App
   - Grant the Managed Identity **Storage Blob Data Reader** role on the storage account

3. **Configure Authentication (Easy Auth)**

   - Enable Authentication.
   - Add Microsoft Entra ID as identity provider.
   - Require authentication for all requests (or at least `/api/*` and `/`).

4. **Build & deploy**

   From your CI/CD pipeline or local machine:

   ```bash
   # (Optional) build frontend and collect static before deployment if not done in CI
   ./scripts/build_frontend.sh
   ./scripts/collect_static.sh
   ```

   Then deploy the repo contents to the Web App (Zip Deploy, GitHub Actions, etc.).

5. **Set startup command**

   In the Web App configuration:

   ```text
   ./scripts/start_app.sh
   ```

After deployment, hitting the Web App URL will trigger Entra ID login (via Easy Auth), and authenticated users will see the infra portal UI with dynamic modules and menus.


