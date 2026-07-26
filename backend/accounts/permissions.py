from rest_framework.permissions import BasePermission


def is_super_admin(user):
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and (user.is_superuser or user.role == "superadmin")
    )


class IsSuperAdmin(BasePermission):
    message = "System super administrator privileges are required."

    def has_permission(self, request, view):
        return is_super_admin(request.user)


class IsOrganizationAdmin(BasePermission):
    """Workspace-scoped admin access.

    Deliberately excludes the system super admin: they own no workspace, so they
    manage tenants through the /auth/system/ endpoints instead.
    """

    message = "Organization administrator privileges are required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.organization_id
            and (user.is_superuser or user.role == "admin")
        )


class IsActiveTenantUser(BasePermission):
    message = "This organization is currently in maintenance mode."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        # Super admins operate above workspaces and have no organization of their own.
        if is_super_admin(user):
            return True
        if not user.organization_id:
            return False
        organization = user.organization
        if not organization.is_active:
            self.message = "This workspace has been suspended by the system administrator."
            return False
        if organization.maintenance_mode and user.role != "admin":
            return False
        return True
