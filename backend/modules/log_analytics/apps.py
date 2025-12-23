from django.apps import AppConfig

from backend.core.menu import register_module_menu


class LogAnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "backend.modules.log_analytics"
    verbose_name = "Log Analytics"

    def ready(self) -> None:  # type: ignore[override]
        register_module_menu(
            {
                "id": "log_analytics",
                "title": "Log Analytics",
                "icon": "Analytics",
                "routes": [
                    {"title": "Overview", "path": "/logs/overview"},
                    {"title": "Saved Queries", "path": "/logs/queries"},
                ],
            }
        )


