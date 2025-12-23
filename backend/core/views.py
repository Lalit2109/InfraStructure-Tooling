from rest_framework.response import Response
from rest_framework.views import APIView

from backend.core.menu import get_registered_menus
from backend.core.permissions import IsInternalUser


class MenuView(APIView):
    """
    Exposes the global menu registry.
    """

    permission_classes = [IsInternalUser]

    def get(self, request, *args, **kwargs):
        return Response(get_registered_menus())


