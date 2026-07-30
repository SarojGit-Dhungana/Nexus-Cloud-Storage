"""
Storage helpers.

Beginner tip:
- A "class" groups related methods (actions) in one place.
- Views call these helpers so business rules stay out of the HTTP layer.
"""

from .models import ActivityLog


class ActivityLogger:
    """
    Writes audit log rows for important storage actions.

    Example:
        ActivityLogger(request).log("downloaded", node=file_node)
    """

    def __init__(self, request):
        # Keep the request so we can read the user and IP later.
        self.request = request

    @staticmethod
    def get_client_ip(request):
        """Return the visitor IP from headers (or REMOTE_ADDR)."""
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR") or None

    def log(self, action, node=None, target_name="", metadata=None):
        """
        Create one ActivityLog row when the organization has audit logging on.

        action: short name like "downloaded" or "created_folder"
        node: optional FileNode the action happened on
        """
        user = self.request.user if getattr(self.request.user, "is_authenticated", False) else None
        organization = (user.organization if user and user.organization_id else None) or (
            node.organization if node else None
        )
        if not organization or not organization.audit_logging:
            return None

        return ActivityLog.objects.create(
            organization=organization,
            actor=user,
            action=action,
            node=node,
            target_name=target_name or (node.name if node else ""),
            metadata=metadata or {},
            ip_address=self.get_client_ip(self.request),
        )


# Small wrapper so existing views can keep calling log_activity(...)
def log_activity(request, action, node=None, target_name="", metadata=None):
    return ActivityLogger(request).log(action, node=node, target_name=target_name, metadata=metadata)


# Older name kept for readability in tutorials / older snippets
def client_ip(request):
    return ActivityLogger.get_client_ip(request)
