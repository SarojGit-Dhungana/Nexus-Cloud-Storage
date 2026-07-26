from .models import ActivityLog


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    return (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None


def log_activity(request, action, node=None, target_name="", metadata=None):
    user = request.user if getattr(request.user, "is_authenticated", False) else None
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
        ip_address=client_ip(request),
    )
