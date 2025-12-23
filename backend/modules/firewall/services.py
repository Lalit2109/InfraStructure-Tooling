"""
Placeholder for Azure Firewall-related service logic.
In a real implementation, this would use the Azure SDK to interact with
firewall policies, rules, and diagnostics.
"""

from typing import List, Dict, Any


def list_mock_firewall_rules() -> List[Dict[str, Any]]:
    return [
        {
            "id": "rule-1",
            "name": "Allow-HTTPS",
            "source": "Any",
            "destination": "Any",
            "protocol": "TCP",
            "port": 443,
            "action": "Allow",
        },
        {
            "id": "rule-2",
            "name": "Deny-RDP",
            "source": "Internet",
            "destination": "Internal",
            "protocol": "TCP",
            "port": 3389,
            "action": "Deny",
        },
    ]


