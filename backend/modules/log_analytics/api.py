from django.urls import path
from rest_framework.response import Response
from rest_framework.views import APIView

from backend.core.permissions import IsInternalUser
from backend.modules.log_analytics.services import get_mock_workspace_overview


class LogAnalyticsOverviewView(APIView):
    permission_classes = [IsInternalUser]

    def get(self, request, *args, **kwargs):
        return Response(get_mock_workspace_overview())


urlpatterns = [
    path("overview", LogAnalyticsOverviewView.as_view(), name="log-analytics-overview"),
]


