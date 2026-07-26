import hashlib
import secrets
import uuid

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models


def object_upload_path(instance, filename):
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    return f"organizations/{instance.organization_id}/{instance.owner_id}/{uuid.uuid4()}.{extension}"


class FileNode(models.Model):
    class NodeType(models.TextChoices):
        FILE = "file", "File"
        FOLDER = "folder", "Folder"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="nodes")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_nodes")
    parent = models.ForeignKey("self", on_delete=models.CASCADE, related_name="children", null=True, blank=True)
    name = models.CharField(max_length=255)
    node_type = models.CharField(max_length=10, choices=NodeType.choices)
    content = models.FileField(upload_to=object_upload_path, blank=True, max_length=500)
    size_bytes = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=255, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True, db_index=True)
    starred = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=("organization", "parent", "deleted_at")),
            models.Index(fields=("organization", "owner", "deleted_at")),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(node_type="folder", size_bytes=0) | models.Q(node_type="file"),
                name="folder_has_zero_size",
            )
        ]

    def __str__(self):
        return self.name

    @property
    def category(self):
        mime = self.mime_type.lower()
        name = self.name.lower()
        if self.node_type == self.NodeType.FOLDER:
            return "folder"
        if mime.startswith("image/"):
            return "image"
        if mime.startswith("video/"):
            return "video"
        if mime == "application/pdf":
            return "pdf"
        if any(value in mime for value in ("word", "document", "sheet", "presentation", "text")):
            return "document"
        if name.endswith((".zip", ".rar", ".7z", ".tar", ".gz")):
            return "archive"
        if name.endswith((".json", ".js", ".ts", ".tsx", ".py", ".html", ".css", ".md")):
            return "code"
        return "document"

    @staticmethod
    def checksum(uploaded_file):
        digest = hashlib.sha256()
        for chunk in uploaded_file.chunks():
            digest.update(chunk)
        uploaded_file.seek(0)
        return digest.hexdigest()


class ShareGrant(models.Model):
    class Permission(models.TextChoices):
        VIEW = "view", "Can view"
        EDIT = "edit", "Can edit"
        SHARE = "share", "Can share"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        IGNORED = "ignored", "Ignored"
        REVOKED = "revoked", "Revoked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    node = models.ForeignKey(FileNode, on_delete=models.CASCADE, related_name="share_grants")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="grants_created")
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shared_with_me", null=True, blank=True
    )
    recipient_email = models.EmailField()
    permission = models.CharField(max_length=10, choices=Permission.choices, default=Permission.VIEW)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("node", "recipient_email"), name="unique_node_share_recipient")
        ]


class ShareLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    node = models.ForeignKey(FileNode, on_delete=models.CASCADE, related_name="share_links")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="share_links")
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    permission = models.CharField(
        max_length=10, choices=ShareGrant.Permission.choices, default=ShareGrant.Permission.VIEW
    )
    password_hash = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def generate_token():
        raw = secrets.token_urlsafe(32)
        return raw, hashlib.sha256(raw.encode()).hexdigest()

    @staticmethod
    def hash_token(raw):
        return hashlib.sha256(raw.encode()).hexdigest()

    def set_password(self, raw):
        self.password_hash = make_password(raw) if raw else ""

    def check_password(self, raw):
        return not self.password_hash or check_password(raw, self.password_hash)


class ActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="activity")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="activity", null=True, blank=True
    )
    action = models.CharField(max_length=50, db_index=True)
    node = models.ForeignKey(FileNode, on_delete=models.SET_NULL, related_name="activity", null=True, blank=True)
    target_name = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)
