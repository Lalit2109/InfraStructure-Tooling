"""
Placeholder for Azure Log Analytics-related service logic.
Would normally query Azure Monitor / Log Analytics workspaces.
"""

from typing import Any, Dict


def get_mock_workspace_overview() -> Dict[str, Any]:
    return {
        "workspace": "corp-logs-prod",
        "retention_days": 30,
        "daily_ingest_gb": 120.5,
        "last_query_time": "2025-01-01T12:00:00Z",
        "top_tables": [
            {"name": "AzureActivity", "records": 1_200_000},
            {"name": "SecurityEvent", "records": 800_000},
        ],
    }


