import hashlib
import secrets
import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.text import slugify


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    storage_quota_bytes = models.BigIntegerField(default=100 * 1024**3)
    max_file_size_bytes = models.BigIntegerField(default=500 * 1024**2)
    require_two_factor = models.BooleanField(default=False)
    audit_logging = models.BooleanField(default=True)
    api_access = models.BooleanField(default=False)
    automatic_backups = models.BooleanField(default=False)
    email_notifications = models.BooleanField(default=True)
    maintenance_mode = models.BooleanField(default=False)
    allow_public_links = models.BooleanField(default=True)
    allow_self_registration = models.BooleanField(default=True)
    # Suspended workspaces stay in the database but nobody except a super admin can use them.
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "organization"
            candidate = base
            index = 2
            while Organization.objects.exclude(pk=self.pk).filter(slug=candidate).exists():
                candidate = f"{base}-{index}"
                index += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "superadmin", "Super Admin"
        ADMIN = "admin", "Admin"
        USER = "user", "User"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=160)
    avatar_url = models.URLField(blank=True)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="users", null=True, blank=True
    )
    role = models.CharField(max_length=15, choices=Role.choices, default=Role.USER)
    storage_quota_bytes = models.BigIntegerField(null=True, blank=True)
    totp_secret_encrypted = models.TextField(blank=True)
    totp_enabled = models.BooleanField(default=False)
    # Difference between the authenticator clock and server clock, in 30-second
    # TOTP steps. Learned once during enrollment, then reused with a tight
    # verification window at login.
    totp_drift_steps = models.SmallIntegerField(default=0)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]
    objects = UserManager()

    @property
    def is_super_admin(self):
        return self.role == self.Role.SUPER_ADMIN or self.is_superuser

    @property
    def effective_storage_quota(self):
        if self.storage_quota_bytes is not None:
            return self.storage_quota_bytes
        # Prefer the FK id so we don't explode when the related org row is missing.
        org_id = getattr(self, "organization_id", None)
        if not org_id:
            return 0
        try:
            organization = self.organization
        except Organization.DoesNotExist:
            return 0
        return organization.storage_quota_bytes if organization else 0

    def __str__(self):
        return self.email


class Invitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    # Workspace invitations can never grant system-level super admin access.
    role = models.CharField(
        max_length=10,
        choices=[(User.Role.ADMIN, "Admin"), (User.Role.USER, "User")],
        default=User.Role.USER,
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="invitations_sent")
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def generate_token():
        raw = secrets.token_urlsafe(32)
        return raw, hashlib.sha256(raw.encode()).hexdigest()

    @staticmethod
    def hash_token(raw):
        return hashlib.sha256(raw.encode()).hexdigest()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "email"),
                condition=models.Q(accepted_at__isnull=True),
                name="one_pending_invitation_per_email",
            )
        ]
