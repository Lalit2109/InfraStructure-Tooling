from rest_framework.permissions import BasePermission


class IsInternalUser(BasePermission):
    """
    Placeholder for internal-only access logic.
    For POC we allow all requests, but this can be extended later.
    """

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        return True


