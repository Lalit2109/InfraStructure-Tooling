from django.apps import AppConfig

from backend.core.menu import register_module_menu


class BackupsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "backend.modules.backups"
    verbose_name = "Git Backup"

    def ready(self) -> None:  # type: ignore[override]
        register_module_menu(
            {
                "id": "backups",
                "title": "Git Backup",
                "icon": "Backup",
                "routes": [
                    {"title": "Available Backups", "path": "/backups/list"},
                    {"title": "Restore", "path": "/backups/restore"},
                ],
            }
        )


