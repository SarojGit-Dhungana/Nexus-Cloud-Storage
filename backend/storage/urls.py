from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityListView,
    AdminAnalyticsView,
    DashboardView,
    FileNodeViewSet,
    PublicShareView,
    ShareGrantViewSet,
)

router = DefaultRouter()
router.register("files", FileNodeViewSet, basename="files")
router.register("activity", ActivityListView, basename="activity")
router.register("shares", ShareGrantViewSet, basename="shares")

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("admin/analytics/", AdminAnalyticsView.as_view(), name="admin_analytics"),
    path("public/shares/<str:token>/", PublicShareView.as_view(), name="public_share"),
]
