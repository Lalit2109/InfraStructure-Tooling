from django.urls import path

from backend.core.views import MenuView

urlpatterns = [
    path("menu", MenuView.as_view(), name="menu"),
]


