from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ConversationViewSet

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversations")

urlpatterns = [path("", include(router.urls))]
