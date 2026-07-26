from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Invitation, Organization, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    ordering = ("email",)
    list_display = ("email", "display_name", "organization", "role", "is_active")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("display_name", "avatar_url", "organization", "role", "storage_quota_bytes")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "display_name", "password1", "password2", "organization", "role"),
            },
        ),
    )
    search_fields = ("email", "display_name")


admin.site.register(Organization)
admin.site.register(Invitation)
