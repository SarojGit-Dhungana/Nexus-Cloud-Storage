# Repair migration: ensure accounts_organization.is_active exists.
# Some local SQLite DBs recorded 0006 as applied without actually adding the column.

from django.db import migrations


def ensure_organization_is_active(apps, schema_editor):
    table = "accounts_organization"
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == "sqlite":
            cursor.execute(f"PRAGMA table_info({table})")
            columns = {row[1] for row in cursor.fetchall()}
            if "is_active" not in columns:
                cursor.execute(
                    f"ALTER TABLE {table} ADD COLUMN is_active bool NOT NULL DEFAULT 1"
                )
        elif connection.vendor == "postgresql":
            cursor.execute(
                """
                ALTER TABLE accounts_organization
                ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT TRUE
                """
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_default_superadmin"),
    ]

    operations = [
        migrations.RunPython(ensure_organization_is_active, noop_reverse),
    ]
