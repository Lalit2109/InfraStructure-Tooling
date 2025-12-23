from typing import Any, Dict, List

MENU_REGISTRY: List[Dict[str, Any]] = []


def register_module_menu(menu_definition: Dict[str, Any]) -> None:
    """
    Register a module's menu definition.

    Expected structure:
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
    # Basic validation to avoid bad registrations breaking the menu
    required_keys = {"id", "title", "routes"}
    if not required_keys.issubset(menu_definition.keys()):
        raise ValueError("Menu definition missing required keys")

    MENU_REGISTRY.append(menu_definition)


def get_registered_menus() -> List[Dict[str, Any]]:
    return MENU_REGISTRY


