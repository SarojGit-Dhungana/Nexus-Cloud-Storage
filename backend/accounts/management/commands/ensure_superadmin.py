from django.conf import settings
from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = "Create or reset the default system super administrator account."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=settings.SUPERADMIN_EMAIL)
        parser.add_argument("--password", default=settings.SUPERADMIN_PASSWORD)
        parser.add_argument("--name", default=settings.SUPERADMIN_NAME)
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Reset the password even if the account already exists.",
        )

    def handle(self, *args, **options):
        email = options["email"].lower().strip()
        user = User.objects.filter(email=email).first()
        if user:
            user.role = User.Role.SUPER_ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            if options["reset_password"]:
                user.set_password(options["password"])
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Super admin updated: {email}"))
            return

        User.objects.create_user(
            email=email,
            password=options["password"],
            display_name=options["name"],
            role=User.Role.SUPER_ADMIN,
            organization=None,
            is_staff=True,
            is_superuser=True,
        )
        self.stdout.write(self.style.SUCCESS(f"Super admin created: {email}"))
