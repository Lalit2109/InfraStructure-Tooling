from django.apps import AppConfig

from backend.core.menu import register_module_menu


class FirewallConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "backend.modules.firewall"
    verbose_name = "Firewall"

    def ready(self) -> None:  # type: ignore[override]
        register_module_menu(
            {
                "id": "firewall",
                "title": "Firewall",
                "icon": "Security",
                "routes": [
                    {"title": "Rules", "path": "/firewall/rules"},
                    {"title": "Policies", "path": "/firewall/policies"},
                       {"title": "Test", "path": "/firewall/Test"},
                ],
            }
        )


