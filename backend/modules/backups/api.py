from django.urls import path
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from backend.core.permissions import IsInternalUser
from backend.modules.backups.services import (
    get_download_link,
    get_restore_preview,
    list_backup_versions,
    list_repositories,
    restore_to_azure_devops,
)


class RepositoriesListView(APIView):
    """List all Azure DevOps repositories with backups available."""

    permission_classes = [IsInternalUser]

    def get(self, request: Request) -> Response:
        repos = list_repositories()
        return Response(repos)


class BackupVersionsView(APIView):
    """List backup versions for a specific repository."""

    permission_classes = [IsInternalUser]

    def get(self, request: Request, repo_id: str) -> Response:
        versions = list_backup_versions(repo_id)
        return Response(versions)


class RestorePreviewView(APIView):
    """Get preview information for a restore operation."""

    permission_classes = [IsInternalUser]

    def post(self, request: Request, repo_id: str) -> Response:
        backup_id = request.data.get("backup_id")
        if not backup_id:
            return Response(
                {"error": "backup_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        preview = get_restore_preview(repo_id, backup_id)
        if "error" in preview:
            return Response(preview, status=status.HTTP_404_NOT_FOUND)

        return Response(preview)


class DownloadLinkView(APIView):
    """Generate a time-limited download link for a backup."""

    permission_classes = [IsInternalUser]

    def post(self, request: Request, repo_id: str) -> Response:
        backup_id = request.data.get("backup_id")
        if not backup_id:
            return Response(
                {"error": "backup_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        download_url = get_download_link(repo_id, backup_id)
        if not download_url:
            return Response(
                {"error": "Failed to generate download link"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"download_url": download_url})


class RestoreView(APIView):
    """Restore a backup to Azure DevOps."""

    permission_classes = [IsInternalUser]

    def post(self, request: Request, repo_id: str) -> Response:
        backup_id = request.data.get("backup_id")
        target_org = request.data.get("target_org")
        target_project = request.data.get("target_project")
        target_repo_name = request.data.get("target_repo_name")
        visibility = request.data.get("visibility", "private")

        if not all([backup_id, target_org, target_project, target_repo_name]):
            return Response(
                {
                    "error": "backup_id, target_org, target_project, and target_repo_name are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = restore_to_azure_devops(
            repo_id=repo_id,
            backup_id=backup_id,
            target_org=target_org,
            target_project=target_project,
            target_repo_name=target_repo_name,
            visibility=visibility,
        )

        if result["status"] == "error":
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


# Legacy endpoint for backward compatibility
class GitBackupStatusView(APIView):
    permission_classes = [IsInternalUser]

    def get(self, request: Request) -> Response:
        repos = list_repositories()
        # Transform to legacy format for backward compatibility
        return Response({
            "summary": {
                "repositories_monitored": len(repos),
                "healthy": len(repos),
                "failing": 0,
                "last_run": repos[0]["last_backup"] if repos else None,
            },
            "repositories": [
                {
                    "name": f"{r['org']}/{r['project']}/{r['repo']}",
                    "provider": "Azure DevOps",
                    "last_backup": r["last_backup"],
                    "status": "Healthy",
                }
                for r in repos
            ],
        })


urlpatterns = [
    path("repositories", RepositoriesListView.as_view(), name="backups-repositories"),
    path("repositories/<str:repo_id>/versions", BackupVersionsView.as_view(), name="backups-versions"),
    path("repositories/<str:repo_id>/restore-preview", RestorePreviewView.as_view(), name="backups-restore-preview"),
    path("repositories/<str:repo_id>/download-link", DownloadLinkView.as_view(), name="backups-download-link"),
    path("repositories/<str:repo_id>/restore", RestoreView.as_view(), name="backups-restore"),
    path("status", GitBackupStatusView.as_view(), name="git-backup-status"),  # Legacy
]
