from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("backend.core.urls")),
    path("api/firewall/", include("backend.modules.firewall.api")),
    path("api/log-analytics/", include("backend.modules.log_analytics.api")),
    path("api/backups/", include("backend.modules.backups.api")),
]


