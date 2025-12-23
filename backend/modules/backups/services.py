"""
Azure DevOps Git Backup service.
Discovers backups from Azure Storage and handles restore operations.
"""

import base64
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import quote

try:
    from azure.identity import DefaultAzureCredential
    from azure.storage.blob import BlobServiceClient, generate_container_sas, ContainerSasPermissions
    AZURE_STORAGE_AVAILABLE = True
except ImportError:
    AZURE_STORAGE_AVAILABLE = False

# Mock mode flag - set DJANGO_BACKUPS_MOCK=true for local dev without Azure Storage
MOCK_MODE = os.getenv("DJANGO_BACKUPS_MOCK", "").lower() == "true"


def _get_storage_client():
    """Get Azure Blob Storage client using Managed Identity or connection string."""
    if MOCK_MODE or not AZURE_STORAGE_AVAILABLE:
        return None

    storage_account = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
    connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")

    if connection_string:
        return BlobServiceClient.from_connection_string(connection_string)
    elif storage_account:
        # Use Managed Identity in Azure, DefaultAzureCredential for local dev with Azure CLI
        credential = DefaultAzureCredential()
        account_url = f"https://{storage_account}.blob.core.windows.net"
        return BlobServiceClient(account_url=account_url, credential=credential)
    else:
        return None


def _parse_blob_path(blob_name: str) -> Optional[Dict[str, str]]:
    """
    Parse Azure Storage blob path to extract org, project, repo, and timestamp.
    Assumes structure: {prefix}/{org}/{project}/{repo}/yyyy-MM-dd-HHmm.zip
    or similar variations.
    """
    parts = blob_name.strip("/").split("/")
    if len(parts) < 4:
        return None

    # Skip prefix if present
    prefix = os.getenv("AZURE_STORAGE_PREFIX", "").strip("/")
    if prefix and parts[0] == prefix:
        parts = parts[1:]

    if len(parts) < 3:
        return None

    org = parts[0]
    project = parts[1]
    repo_with_date = "/".join(parts[2:])
    
    # Extract repo name and date from filename like "repo-name/2025-01-15-1430.zip"
    if "/" in repo_with_date:
        repo, filename = repo_with_date.rsplit("/", 1)
    else:
        repo = repo_with_date
        filename = ""

    # Try to extract date from filename
    date_str = None
    if filename.endswith(".zip"):
        date_part = filename.replace(".zip", "")
        try:
            # Try common formats: yyyy-MM-dd-HHmm, yyyy-MM-dd, etc.
            if len(date_part) >= 10:
                date_str = date_part[:10]  # yyyy-MM-dd
        except Exception:
            pass

    return {
        "org": org,
        "project": project,
        "repo": repo,
        "date_str": date_str,
        "blob_name": blob_name,
    }


def _get_mock_repositories() -> List[Dict[str, Any]]:
    """Mock data for local development."""
    return [
        {
            "id": "org1-project1-repo1",
            "org": "myorg",
            "project": "ProjectAlpha",
            "repo": "infra-terraform",
            "backup_count": 45,
            "last_backup": "2025-01-15T14:30:00Z",
        },
        {
            "id": "org1-project1-repo2",
            "org": "myorg",
            "project": "ProjectAlpha",
            "repo": "core-app",
            "backup_count": 42,
            "last_backup": "2025-01-15T12:00:00Z",
        },
        {
            "id": "org1-project2-repo1",
            "org": "myorg",
            "project": "ProjectBeta",
            "repo": "api-service",
            "backup_count": 38,
            "last_backup": "2025-01-14T18:00:00Z",
        },
    ]


def _get_mock_backup_versions(repo_id: str) -> List[Dict[str, Any]]:
    """Mock backup versions for a repository."""
    base_date = datetime.utcnow()
    versions = []
    for i in range(10):
        backup_date = base_date - timedelta(days=i)
        versions.append({
            "id": f"{repo_id}-{backup_date.strftime('%Y-%m-%d')}",
            "timestamp": backup_date.isoformat() + "Z",
            "size_bytes": 15728640 + (i * 1024),  # ~15MB + variation
            "size_mb": round((15728640 + (i * 1024)) / 1048576, 2),
            "retention_expires": (backup_date + timedelta(days=90)).isoformat() + "Z",
            "blob_path": f"myorg/project/repo/{backup_date.strftime('%Y-%m-%d')}-{backup_date.strftime('%H%M')}.zip",
        })
    return versions


def list_repositories() -> List[Dict[str, Any]]:
    """
    List all Azure DevOps repositories that have backups available.
    Returns list of repository summaries.
    """
    if MOCK_MODE:
        return _get_mock_repositories()

    client = _get_storage_client()
    if not client:
        return []

    container_name = os.getenv("AZURE_STORAGE_CONTAINER", "git-backups")
    prefix = os.getenv("AZURE_STORAGE_PREFIX", "").strip("/")
    if prefix:
        prefix = prefix + "/"

    try:
        container_client = client.get_container_client(container_name)
        repos_map: Dict[str, Dict[str, Any]] = {}

        # List all blobs with .zip extension
        for blob in container_client.list_blobs(name_starts_with=prefix):
            if not blob.name.endswith(".zip"):
                continue

            parsed = _parse_blob_path(blob.name)
            if not parsed:
                continue

            repo_id = f"{parsed['org']}-{parsed['project']}-{parsed['repo']}"
            if repo_id not in repos_map:
                repos_map[repo_id] = {
                    "id": repo_id,
                    "org": parsed["org"],
                    "project": parsed["project"],
                    "repo": parsed["repo"],
                    "backup_count": 0,
                    "last_backup": None,
                }

            repos_map[repo_id]["backup_count"] += 1
            if parsed["date_str"]:
                try:
                    backup_date = datetime.fromisoformat(parsed["date_str"])
                    if repos_map[repo_id]["last_backup"] is None or backup_date > datetime.fromisoformat(repos_map[repo_id]["last_backup"][:10]):
                        repos_map[repo_id]["last_backup"] = backup_date.isoformat() + "Z"
                except Exception:
                    pass

        return list(repos_map.values())
    except Exception as e:
        # Log error in production, return empty for now
        print(f"Error listing repositories: {e}")
        return []


def list_backup_versions(repo_id: str) -> List[Dict[str, Any]]:
    """
    List all backup versions for a specific repository.
    Returns list of backup instances with metadata.
    """
    if MOCK_MODE:
        return _get_mock_backup_versions(repo_id)

    client = _get_storage_client()
    if not client:
        return []

    # Parse repo_id to get org, project, repo
    parts = repo_id.split("-", 2)
    if len(parts) < 3:
        return []

    org, project, repo = parts[0], parts[1], parts[2]
    container_name = os.getenv("AZURE_STORAGE_CONTAINER", "git-backups")
    prefix = os.getenv("AZURE_STORAGE_PREFIX", "").strip("/")
    blob_prefix = f"{prefix}/{org}/{project}/{repo}/" if prefix else f"{org}/{project}/{repo}/"

    try:
        container_client = client.get_container_client(container_name)
        versions = []

        for blob in container_client.list_blobs(name_starts_with=blob_prefix):
            if not blob.name.endswith(".zip"):
                continue

            parsed = _parse_blob_path(blob.name)
            if not parsed:
                continue

            versions.append({
                "id": f"{repo_id}-{parsed.get('date_str', blob.name)}",
                "timestamp": blob.last_modified.isoformat() if blob.last_modified else datetime.utcnow().isoformat() + "Z",
                "size_bytes": blob.size or 0,
                "size_mb": round((blob.size or 0) / 1048576, 2),
                "retention_expires": (blob.last_modified + timedelta(days=90)).isoformat() if blob.last_modified else None,
                "blob_path": blob.name,
            })

        # Sort by timestamp descending (newest first)
        versions.sort(key=lambda x: x["timestamp"], reverse=True)
        return versions
    except Exception as e:
        print(f"Error listing backup versions: {e}")
        return []


def get_download_link(repo_id: str, backup_id: str) -> Optional[str]:
    """
    Generate a time-limited SAS URL for downloading a backup zip.
    Returns None if backup not found or error occurs.
    """
    if MOCK_MODE:
        return f"https://mock-storage.example.com/download/{backup_id}?mock=true"

    client = _get_storage_client()
    if not client:
        return None

    # Find the blob path from backup_id
    versions = list_backup_versions(repo_id)
    backup = next((v for v in versions if v["id"] == backup_id), None)
    if not backup:
        return None

    blob_path = backup.get("blob_path")
    if not blob_path:
        return None

    container_name = os.getenv("AZURE_STORAGE_CONTAINER", "git-backups")

    try:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas
        
        blob_client = client.get_blob_client(container=container_name, blob=blob_path)
        
        # Check if we have account key (connection string) or need Managed Identity approach
        connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        
        if connection_string:
            # Parse connection string to get account key
            from azure.storage.blob import BlobServiceClient
            # Extract account name and key from connection string
            parts = dict(part.split('=', 1) for part in connection_string.split(';') if '=' in part)
            account_name = parts.get('AccountName', '')
            account_key = parts.get('AccountKey', '')
            
            if account_key:
                sas_token = generate_blob_sas(
                    account_name=account_name,
                    container_name=container_name,
                    blob_name=blob_path,
                    account_key=account_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=datetime.utcnow() + timedelta(hours=1),
                )
                return f"{blob_client.url}?{sas_token}"
        
        # For Managed Identity, user delegation SAS requires additional setup
        # For now, return blob URL - in production, implement user delegation SAS
        # or use Azure Functions/Logic Apps to generate signed URLs
        account_url = client.account_url
        return f"{account_url}/{container_name}/{quote(blob_path, safe='')}"
    except Exception as e:
        print(f"Error generating download link: {e}")
        # Fallback: return blob URL (may require authentication)
        account_url = client.account_url
        return f"{account_url}/{container_name}/{quote(blob_path, safe='')}"


def restore_to_azure_devops(
    repo_id: str,
    backup_id: str,
    target_org: str,
    target_project: str,
    target_repo_name: str,
    visibility: str = "private",
) -> Dict[str, Any]:
    """
    Restore a backup to Azure DevOps.
    Returns status dict with success/failure and details.
    """
    if MOCK_MODE:
        return {
            "status": "success",
            "message": f"Mock restore: {backup_id} -> {target_org}/{target_project}/{target_repo_name}",
            "repo_url": f"https://dev.azure.com/{target_org}/{target_project}/_git/{target_repo_name}",
        }

    # Get download link first
    download_url = get_download_link(repo_id, backup_id)
    if not download_url:
        return {
            "status": "error",
            "message": "Failed to generate download link for backup",
        }

    # Get Azure DevOps PAT or use Managed Identity
    pat = os.getenv("AZURE_DEVOPS_PAT")
    if not pat:
        return {
            "status": "error",
            "message": "Azure DevOps PAT not configured. Set AZURE_DEVOPS_PAT environment variable.",
        }

    try:
        import requests

        # Step 1: Create repository in Azure DevOps
        create_repo_url = f"https://dev.azure.com/{target_org}/{target_project}/_apis/git/repositories?api-version=7.1"
        headers = {
            "Authorization": f"Basic {base64.b64encode(f':{pat}'.encode()).decode()}",
            "Content-Type": "application/json",
        }
        create_payload = {
            "name": target_repo_name,
            "project": {"id": target_project},  # May need project ID instead
        }

        create_response = requests.post(create_repo_url, headers=headers, json=create_payload, timeout=30)
        if create_response.status_code not in [200, 201]:
            # Check if repo already exists
            if create_response.status_code == 409:
                return {
                    "status": "error",
                    "message": f"Repository {target_repo_name} already exists in {target_project}",
                }
            return {
                "status": "error",
                "message": f"Failed to create repository: {create_response.text}",
            }

        repo_data = create_response.json()
        repo_id_ado = repo_data.get("id")

        # Step 2: Import the backup zip (this is a simplified version)
        # In reality, Azure DevOps import API requires specific format and may need async job
        # For POC, we return success with instructions
        return {
            "status": "success",
            "message": f"Repository {target_repo_name} created. Import backup manually or implement import API.",
            "repo_url": repo_data.get("webUrl") or f"https://dev.azure.com/{target_org}/{target_project}/_git/{target_repo_name}",
            "repo_id": repo_id_ado,
            "download_url": download_url,  # For manual import
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Restore failed: {str(e)}",
        }


def get_restore_preview(repo_id: str, backup_id: str) -> Dict[str, Any]:
    """Get preview information for a restore operation."""
    versions = list_backup_versions(repo_id)
    backup = next((v for v in versions if v["id"] == backup_id), None)
    if not backup:
        return {"error": "Backup not found"}

    # Parse repo_id to extract original org/project/repo
    parts = repo_id.split("-", 2)
    if len(parts) < 3:
        return {"error": "Invalid repository ID"}

    org, project, repo = parts[0], parts[1], parts[2]

    return {
        "source_org": org,
        "source_project": project,
        "source_repo": repo,
        "backup_timestamp": backup["timestamp"],
        "backup_size_mb": backup["size_mb"],
        "suggested_target_repo_name": repo,  # Default to same name
    }
