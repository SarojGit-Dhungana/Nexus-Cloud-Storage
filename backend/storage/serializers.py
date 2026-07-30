from django.contrib.auth import get_user_model
from rest_framework import serializers
import hashlib

from .models import ActivityLog, FileNode, ShareGrant, ShareLink

User = get_user_model()


class FileNodeSerializer(serializers.ModelSerializer):
    owner = serializers.CharField(source="owner.display_name", read_only=True)
    owner_id = serializers.UUIDField(read_only=True)
    type = serializers.CharField(source="category", read_only=True)
    shared = serializers.SerializerMethodField()
    modified = serializers.DateTimeField(source="updated_at", read_only=True)
    size = serializers.IntegerField(source="size_bytes", read_only=True)

    class Meta:
        model = FileNode
        fields = (
            "id",
            "name",
            "node_type",
            "type",
            "size",
            "mime_type",
            "modified",
            "created_at",
            "owner",
            "owner_id",
            "parent",
            "shared",
            "starred",
            "checksum_sha256",
            "deleted_at",
        )
        read_only_fields = (
            "id",
            "node_type",
            "mime_type",
            "created_at",
            "checksum_sha256",
            "deleted_at",
        )

    def get_shared(self, obj):
        # True when you shared it out, OR when someone shared it with you (accepted).
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user and getattr(user, "is_authenticated", False) and obj.owner_id != user.id:
            if obj.share_grants.filter(
                recipient=user,
                status=ShareGrant.Status.ACCEPTED,
            ).exists():
                return True
        return bool(
            getattr(obj, "share_count", 0)
            or obj.share_grants.exists()
            or obj.share_links.filter(is_active=True).exists()
        )

    def validate_parent(self, parent):
        request = self.context["request"]
        if (
            self.instance
            and self.instance.owner_id != request.user.id
            and request.user.role != "admin"
            and parent != self.instance.parent
        ):
            raise serializers.ValidationError("Only the owner can move this item.")
        if parent and (
            parent.organization_id != request.user.organization_id
            or parent.node_type != FileNode.NodeType.FOLDER
            or parent.deleted_at
        ):
            raise serializers.ValidationError("Parent must be an active folder in your organization.")
        current = parent
        while current:
            if self.instance and current.pk == self.instance.pk:
                raise serializers.ValidationError("A folder cannot be moved inside itself.")
            current = current.parent
        return parent


class FolderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileNode
        fields = ("id", "name", "parent")
        read_only_fields = ("id",)

    def validate_parent(self, parent):
        request = self.context["request"]
        if parent and (
            parent.organization_id != request.user.organization_id
            or parent.node_type != FileNode.NodeType.FOLDER
            or parent.deleted_at
        ):
            raise serializers.ValidationError("Parent must be an active folder in your organization.")
        return parent

    def create(self, validated_data):
        request = self.context["request"]
        return FileNode.objects.create(
            organization=request.user.organization,
            owner=request.user,
            node_type=FileNode.NodeType.FOLDER,
            **validated_data,
        )


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    parent = serializers.PrimaryKeyRelatedField(
        queryset=FileNode.objects.filter(node_type=FileNode.NodeType.FOLDER, deleted_at__isnull=True),
        required=False,
        allow_null=True,
    )

    def validate_parent(self, parent):
        if parent and parent.organization_id != self.context["request"].user.organization_id:
            raise serializers.ValidationError("Folder does not belong to your organization.")
        return parent

    def validate_file(self, value):
        from .upload_malware_scanner import scan_upload_for_malware

        user = self.context["request"].user
        if not user.organization_id:
            raise serializers.ValidationError("Uploads require a workspace account.")
        if value.size > user.organization.max_file_size_bytes:
            raise serializers.ValidationError("File exceeds the organization's maximum file size.")

        # Virus scan runs here so every upload path is blocked before save.
        scan = scan_upload_for_malware(value)
        if scan.rejected:
            raise serializers.ValidationError(
                f"Virus/malware detected ({scan.threat}). Upload blocked — file was not stored."
            )
        self.context["antivirus_scan"] = scan
        return value


class FileScanSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        from .upload_malware_scanner import scan_upload_for_malware

        scan = scan_upload_for_malware(value)
        self.context["antivirus_scan"] = scan
        if scan.rejected:
            # Keep the file field valid so the view can return a structured scan payload.
            return value
        return value


class ShareGrantSerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(source="recipient.display_name", read_only=True)
    sender_name = serializers.CharField(source="created_by.display_name", read_only=True)
    sender_email = serializers.EmailField(source="created_by.email", read_only=True)
    file_id = serializers.UUIDField(source="node_id", read_only=True)
    file_name = serializers.CharField(source="node.name", read_only=True)
    file_type = serializers.CharField(source="node.category", read_only=True)
    mime_type = serializers.CharField(source="node.mime_type", read_only=True)
    size = serializers.IntegerField(source="node.size_bytes", read_only=True)
    node_type = serializers.CharField(source="node.node_type", read_only=True)

    class Meta:
        model = ShareGrant
        fields = (
            "id",
            "recipient_email",
            "recipient_name",
            "sender_name",
            "sender_email",
            "permission",
            "status",
            "responded_at",
            "created_at",
            "file_id",
            "file_name",
            "file_type",
            "mime_type",
            "size",
            "node_type",
        )
        read_only_fields = fields


class ShareGrantCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    permission = serializers.ChoiceField(choices=ShareGrant.Permission.choices, default=ShareGrant.Permission.VIEW)

    def validate_email(self, value):
        return value.lower().strip()


class ShareLinkCreateSerializer(serializers.Serializer):
    permission = serializers.ChoiceField(choices=ShareGrant.Permission.choices, default=ShareGrant.Permission.VIEW)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    password = serializers.CharField(required=False, allow_blank=True, write_only=True, max_length=128)


class ActivityLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    action = serializers.SerializerMethodField()
    action_label = serializers.SerializerMethodField()
    action_type = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(source="created_at")
    encrypted = serializers.SerializerMethodField()

    ACTION_LABELS = {
        "uploaded": "Uploaded",
        "upload_rejected_virus": "Upload blocked (virus)",
        "upload_rejected_duplicate": "Upload blocked (duplicate content)",
        "downloaded": "Downloaded",
        "previewed": "Previewed",
        "created_folder": "Created folder",
        "updated": "Updated",
        "moved_to_trash": "Moved to trash",
        "permanently_deleted": "Permanently deleted",
        "emptied_trash": "Emptied trash",
        "restored": "Restored",
        "duplicated": "Duplicated",
        "shared": "Shared",
        "share_accepted": "Accepted share",
        "share_ignored": "Ignored share",
        "share_revoked": "Revoked share",
        "created_share_link": "Created share link",
    }
    ACTION_TYPES = {
        "uploaded": "upload",
        "upload_rejected_virus": "delete",
        "upload_rejected_duplicate": "delete",
        "downloaded": "download",
        "previewed": "download",
        "created_folder": "create",
        "updated": "create",
        "moved_to_trash": "delete",
        "permanently_deleted": "delete",
        "emptied_trash": "delete",
        "restored": "create",
        "duplicated": "create",
        "shared": "share",
        "share_accepted": "share",
        "share_ignored": "share",
        "share_revoked": "share",
        "created_share_link": "share",
    }

    class Meta:
        model = ActivityLog
        fields = (
            "id",
            "user",
            "action",
            "action_label",
            "action_type",
            "file_name",
            "timestamp",
            "metadata",
            "encrypted",
        )

    def get_user(self, obj):
        return obj.actor.display_name if obj.actor else "System"

    def _should_mask(self):
        return bool(self.context.get("mask_sensitive"))

    @staticmethod
    def _cipher(value: str, salt: str) -> str:
        digest = hashlib.sha256(f"{salt}:{value}".encode("utf-8")).hexdigest()
        return f"enc://{digest[:10]}…{digest[-6:]}"

    def get_action(self, obj):
        # Always expose the raw action key so admins can filter upload/delete/share.
        return obj.action

    def get_action_label(self, obj):
        return self.ACTION_LABELS.get(obj.action, (obj.action or "activity").replace("_", " ").title())

    def get_action_type(self, obj):
        return self.ACTION_TYPES.get(obj.action, "system")

    def get_file_name(self, obj):
        name = obj.target_name or ""
        if self._should_mask():
            return self._cipher(name or "target", f"file:{obj.pk}")
        return name

    def get_encrypted(self, obj):
        return self._should_mask()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self._should_mask():
            data["metadata"] = {"redacted": True}
        return data
