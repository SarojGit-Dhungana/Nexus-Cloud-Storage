from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import ShareGrant


class CanAccessNode(BasePermission):
    def has_object_permission(self, request, view, node):
        user = request.user
        if user.is_superuser or (user.role == "admin" and user.organization_id == node.organization_id):
            return True
        if node.owner_id == user.id:
            return True
        grant = node.share_grants.filter(
            recipient=user, status=ShareGrant.Status.ACCEPTED
        ).first()
        if not grant:
            return False
        action = getattr(view, "action", "")
        # Accepted recipients can always list/read/preview/download documents.
        if action in ("retrieve", "download", "preview") or request.method in SAFE_METHODS:
            return True
        if action in ("shares", "share_link"):
            return grant.permission == ShareGrant.Permission.SHARE
        if action in ("update", "partial_update"):
            return grant.permission in (ShareGrant.Permission.EDIT, ShareGrant.Permission.SHARE)
        return False
