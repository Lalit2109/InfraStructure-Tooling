from django.urls import path
from rest_framework.response import Response
from rest_framework.views import APIView

from backend.core.permissions import IsInternalUser
from backend.modules.firewall.services import list_mock_firewall_rules


class FirewallRulesView(APIView):
    permission_classes = [IsInternalUser]

    def get(self, request, *args, **kwargs):
        return Response({"rules": list_mock_firewall_rules()})


urlpatterns = [
    path("rules", FirewallRulesView.as_view(), name="firewall-rules"),
]


