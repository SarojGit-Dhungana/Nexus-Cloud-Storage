from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations


def create_default_superadmin(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    email = (getattr(settings, "SUPERADMIN_EMAIL", "") or "superadmin@nexusstorage.local").lower().strip()
    if User.objects.filter(email=email).exists():
        return
    User.objects.create(
        email=email,
        display_name=getattr(settings, "SUPERADMIN_NAME", "System Super Admin"),
        password=make_password(getattr(settings, "SUPERADMIN_PASSWORD", "SuperAdmin@12345")),
        role="superadmin",
        organization=None,
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )


def remove_default_superadmin(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    email = (getattr(settings, "SUPERADMIN_EMAIL", "") or "superadmin@nexusstorage.local").lower().strip()
    User.objects.filter(email=email, role="superadmin").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_alter_invitation_role"),
    ]

    operations = [
        migrations.RunPython(create_default_superadmin, remove_default_superadmin),
    ]
