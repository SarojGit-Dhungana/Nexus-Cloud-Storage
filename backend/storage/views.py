from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from accounts.models import Organization
from accounts.permissions import IsActiveTenantUser, IsOrganizationAdmin
from .models import ActivityLog, FileNode, ShareGrant, ShareLink
from .permissions import CanAccessNode
from .serializers import (
    ActivityLogSerializer,
    FileNodeSerializer,
    FileScanSerializer,
    FileUploadSerializer,
    FolderCreateSerializer,
    ShareGrantCreateSerializer,
    ShareGrantSerializer,
    ShareLinkCreateSerializer,
)
from .upload_malware_scanner import scan_upload_for_malware
from .services import log_activity

User = get_user_model()

DUPLICATE_CONTENT_DETAIL = (
    "The file content has matched with a stored file, so it can't be uploaded."
)


def accessible_nodes(user):
    if user.role == "admin" or user.is_superuser:
        return FileNode.objects.filter(organization=user.organization)
    return FileNode.objects.filter(organization=user.organization).filter(
        Q(owner=user) | Q(share_grants__recipient=user, share_grants__status=ShareGrant.Status.ACCEPTED)
    ).distinct()


class FileNodeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsActiveTenantUser, CanAccessNode]
    search_fields = ("name", "owner__display_name")
    ordering_fields = ("name", "size_bytes", "updated_at", "created_at")
    ordering = ("-updated_at",)

    def get_queryset(self):
        user = self.request.user
        scope = self.request.query_params.get("scope", "mine")
        detail_actions = {
            "retrieve",
            "download",
            "preview",
            "update",
            "partial_update",
            "destroy",
            "duplicate",
            "shares",
            "share_link",
            "restore",
            "permanent",
        }
        if self.action in detail_actions:
            return accessible_nodes(user).select_related("owner", "parent")

        queryset = FileNode.objects.filter(organization=user.organization).select_related("owner", "parent")
        if scope == "shared":
            queryset = queryset.filter(
                Q(share_grants__recipient=user, share_grants__status=ShareGrant.Status.ACCEPTED)
                | Q(owner=user, share_grants__isnull=False)
                | Q(owner=user, share_links__is_active=True),
                deleted_at__isnull=True,
            )
        elif scope == "trash":
            queryset = queryset.filter(owner=user, deleted_at__isnull=False)
        elif scope == "organization" and (user.role == "admin" or user.is_superuser):
            queryset = queryset.filter(deleted_at__isnull=True)
        else:
            # My Files: own items + files the user accepted from Shared
            queryset = queryset.filter(
                Q(owner=user, deleted_at__isnull=True)
                | Q(
                    share_grants__recipient=user,
                    share_grants__status=ShareGrant.Status.ACCEPTED,
                    deleted_at__isnull=True,
                )
            )

        parent = self.request.query_params.get("parent")
        if parent == "root":
            # My Files root: own root items + accepted shares (share icon in UI)
            if scope == "mine" or scope not in ("shared", "trash", "organization"):
                queryset = queryset.filter(
                    Q(owner=user, parent__isnull=True)
                    | Q(
                        share_grants__recipient=user,
                        share_grants__status=ShareGrant.Status.ACCEPTED,
                    )
                )
            else:
                queryset = queryset.filter(parent__isnull=True)
        elif parent:
            queryset = queryset.filter(parent_id=parent)
        category = self.request.query_params.get("type")
        if category == "folder":
            queryset = queryset.filter(node_type="folder")
        elif category == "starred":
            queryset = queryset.filter(starred=True)
        return queryset.distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return FolderCreateSerializer
        if self.action == "upload":
            return FileUploadSerializer
        if self.action == "scan":
            return FileScanSerializer
        return FileNodeSerializer

    def perform_create(self, serializer):
        node = serializer.save()
        log_activity(self.request, "created_folder", node)

    def perform_update(self, serializer):
        node = serializer.save()
        log_activity(self.request, "updated", node)

    def perform_destroy(self, instance):
        now = timezone.now()
        instance.deleted_at = now
        instance.save(update_fields=("deleted_at", "updated_at"))
        if instance.node_type == FileNode.NodeType.FOLDER:
            self._mark_descendants(instance, now)
        log_activity(self.request, "moved_to_trash", instance)

    def _mark_descendants(self, parent, deleted_at):
        for child in parent.children.all():
            child.deleted_at = deleted_at
            child.save(update_fields=("deleted_at", "updated_at"))
            self._mark_descendants(child, deleted_at)

    @action(detail=False, methods=("post",))
    def scan(self, request):
        """Scan-only endpoint. Never stores the file. Must pass before upload."""
        serializer = FileScanSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        scan = serializer.context["antivirus_scan"]
        uploaded = serializer.validated_data["file"]
        if scan.rejected:
            log_activity(
                request,
                "upload_rejected_virus",
                target_name=getattr(uploaded, "name", ""),
                metadata={"threat": scan.threat, "engine": scan.engine, "phase": "pre_upload_scan"},
            )
            return Response(
                {
                    "clean": False,
                    "allowed": False,
                    "threat": scan.threat,
                    "engine": scan.engine,
                    "detail": scan.detail or f"Virus/malware detected ({scan.threat}).",
                    "scanned_bytes": scan.scanned_bytes,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.user.organization_id:
            checksum = FileNode.checksum(uploaded)
            existing = FileNode.find_active_content_duplicate(request.user.organization, checksum)
            if existing:
                log_activity(
                    request,
                    "upload_rejected_duplicate",
                    target_name=getattr(uploaded, "name", ""),
                    metadata={
                        "matched_file_id": str(existing.id),
                        "matched_file_name": existing.name,
                        "checksum_sha256": checksum,
                        "phase": "pre_upload_scan",
                    },
                )
                return Response(
                    {
                        "clean": True,
                        "allowed": False,
                        "threat": "",
                        "engine": scan.engine,
                        "detail": DUPLICATE_CONTENT_DETAIL,
                        "scanned_bytes": scan.scanned_bytes,
                        "duplicate": True,
                        "matched_file": existing.name,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
        return Response(
            {
                "clean": True,
                "allowed": True,
                "threat": "",
                "engine": scan.engine,
                "detail": scan.detail or "No threats detected.",
                "scanned_bytes": scan.scanned_bytes,
            }
        )

    @action(detail=False, methods=("post",))
    def upload(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]
        # Defense in depth: serializer already scanned; re-scan before write.
        scan = scan_upload_for_malware(uploaded)
        if scan.rejected:
            log_activity(
                request,
                "upload_rejected_virus",
                target_name=uploaded.name,
                metadata={"threat": scan.threat, "engine": scan.engine, "phase": "upload"},
            )
            return Response(
                {
                    "detail": (
                        f"Upload rejected: virus or malware detected ({scan.threat}). "
                        "The file was not stored."
                    ),
                    "clean": False,
                    "threat": scan.threat,
                    "engine": scan.engine,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        checksum = FileNode.checksum(uploaded)
        with transaction.atomic():
            organization = Organization.objects.select_for_update().get(pk=request.user.organization_id)
            existing = FileNode.find_active_content_duplicate(organization, checksum)
            if existing:
                log_activity(
                    request,
                    "upload_rejected_duplicate",
                    target_name=uploaded.name,
                    metadata={
                        "matched_file_id": str(existing.id),
                        "matched_file_name": existing.name,
                        "checksum_sha256": checksum,
                        "phase": "upload",
                    },
                )
                return Response(
                    {
                        "detail": DUPLICATE_CONTENT_DETAIL,
                        "duplicate": True,
                        "matched_file": existing.name,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            used = (
                FileNode.objects.filter(
                    organization=organization, node_type="file", deleted_at__isnull=True
                ).aggregate(total=Sum("size_bytes"))["total"]
                or 0
            )
            if used + uploaded.size > organization.storage_quota_bytes:
                return Response({"detail": "Organization storage quota exceeded."}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
            if request.user.storage_quota_bytes is not None:
                personal_used = (
                    FileNode.objects.filter(
                        owner=request.user, node_type="file", deleted_at__isnull=True
                    ).aggregate(total=Sum("size_bytes"))["total"]
                    or 0
                )
                if personal_used + uploaded.size > request.user.storage_quota_bytes:
                    return Response(
                        {"detail": "Personal storage quota exceeded."},
                        status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    )
            node = FileNode.objects.create(
                organization=organization,
                owner=request.user,
                parent=serializer.validated_data.get("parent"),
                name=uploaded.name,
                node_type=FileNode.NodeType.FILE,
                content=uploaded,
                size_bytes=uploaded.size,
                mime_type=uploaded.content_type or "application/octet-stream",
                checksum_sha256=checksum,
            )
        log_activity(
            request,
            "uploaded",
            node,
            metadata={
                "size_bytes": node.size_bytes,
                "scan_engine": scan.engine,
                "scan_clean": True,
                "scanned_bytes": scan.scanned_bytes,
            },
        )
        payload = FileNodeSerializer(node, context={"request": request}).data
        payload["scan"] = {
            "clean": True,
            "engine": scan.engine,
            "detail": scan.detail or "No threats detected.",
            "scanned_bytes": scan.scanned_bytes,
        }
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def restore(self, request, pk=None):
        node = self.get_object()
        node.deleted_at = None
        node.save(update_fields=("deleted_at", "updated_at"))
        if node.node_type == FileNode.NodeType.FOLDER:
            self._restore_descendants(node)
        log_activity(request, "restored", node)
        return Response(FileNodeSerializer(node, context={"request": request}).data)

    def _restore_descendants(self, parent):
        for child in parent.children.all():
            child.deleted_at = None
            child.save(update_fields=("deleted_at", "updated_at"))
            self._restore_descendants(child)

    @action(detail=True, methods=("delete",), url_path="permanent")
    def permanent_delete(self, request, pk=None):
        node = self.get_object()
        name = node.name

        def delete_content(current):
            if current.content:
                current.content.delete(save=False)
            for child in current.children.all():
                delete_content(child)

        delete_content(node)
        node.delete()
        log_activity(request, "permanently_deleted", target_name=name)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=("delete",), url_path="empty-trash")
    def empty_trash(self, request):
        nodes = FileNode.objects.filter(owner=request.user, deleted_at__isnull=False)
        count = nodes.count()
        for node in nodes.filter(node_type="file"):
            if node.content:
                node.content.delete(save=False)
        nodes.delete()
        log_activity(request, "emptied_trash", metadata={"count": count})
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=("get",))
    def download(self, request, pk=None):
        node = self.get_object()
        if node.node_type != FileNode.NodeType.FILE or not node.content:
            return Response({"detail": "This item is not downloadable."}, status=status.HTTP_400_BAD_REQUEST)
        log_activity(request, "downloaded", node)
        return FileResponse(node.content.open("rb"), as_attachment=True, filename=node.name, content_type=node.mime_type)

    @action(detail=True, methods=("get",))
    def preview(self, request, pk=None):
        node = self.get_object()
        if node.node_type != FileNode.NodeType.FILE or not node.content:
            return Response({"detail": "This item cannot be previewed."}, status=status.HTTP_400_BAD_REQUEST)
        log_activity(request, "previewed", node)
        response = FileResponse(node.content.open("rb"), content_type=node.mime_type)
        response["Content-Disposition"] = f'inline; filename="{node.name}"'
        return response

    @action(detail=True, methods=("post",))
    def duplicate(self, request, pk=None):
        return Response(
            {"detail": "Files can't be duplicated. Identical content is not allowed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=True, methods=("get", "post"), url_path="shares")
    def shares(self, request, pk=None):
        # HTTP layer only — ShareService owns the share rules
        from .share_service import ShareService

        node = self.get_object()
        if request.method == "GET":
            return Response(ShareGrantSerializer(node.share_grants.select_related("recipient", "created_by", "node"), many=True).data)
        serializer = ShareGrantCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            grant, created, emailed = ShareService(request).invite_by_email(
                node,
                serializer.validated_data["email"],
                serializer.validated_data["permission"],
            )
        except ValidationError as error:
            return Response(
                error.detail if isinstance(error.detail, dict) else {"detail": error.detail},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = ShareGrantSerializer(grant).data
        data["email_sent"] = emailed
        data["created"] = created
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="share-link")
    def share_link(self, request, pk=None):
        from .share_service import ShareService

        node = self.get_object()
        serializer = ShareLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = ShareService(request).create_secure_link(
                node,
                permission=serializer.validated_data["permission"],
                expires_at=serializer.validated_data.get("expires_at"),
                password=serializer.validated_data.get("password", ""),
                notify_email=(request.data.get("email") or "").strip(),
            )
        except ValidationError as error:
            detail = error.detail if isinstance(error.detail, dict) else {"detail": error.detail}
            code = status.HTTP_403_FORBIDDEN if "disabled" in str(detail).lower() else status.HTTP_400_BAD_REQUEST
            return Response(detail, status=code)
        return Response(payload, status=status.HTTP_201_CREATED)


class ShareGrantViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Inbox for share requests the current user received."""

    serializer_class = ShareGrantSerializer
    permission_classes = [IsActiveTenantUser]
    ordering = ("-created_at",)

    def get_queryset(self):
        user = self.request.user
        scope = self.request.query_params.get("scope", "inbox")
        if scope == "sent":
            queryset = ShareGrant.objects.filter(created_by=user)
        else:
            queryset = ShareGrant.objects.filter(
                Q(recipient=user) | Q(recipient_email__iexact=user.email)
            )
        queryset = queryset.select_related("node", "node__owner", "created_by", "recipient")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset.order_by("-created_at")

    def _owned_grant(self, pk):
        user = self.request.user
        return get_object_or_404(
            ShareGrant.objects.select_related("node", "created_by"),
            Q(recipient=user) | Q(recipient_email__iexact=user.email),
            pk=pk,
        )

    @action(detail=True, methods=("post",))
    def accept(self, request, pk=None):
        grant = self._owned_grant(pk)
        if grant.status == ShareGrant.Status.ACCEPTED:
            return Response(ShareGrantSerializer(grant).data)
        if grant.status == ShareGrant.Status.REVOKED and grant.created_by_id != request.user.id:
            return Response(
                {"detail": "This share was withdrawn. Ask the owner to share it again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        grant.recipient = request.user
        grant.status = ShareGrant.Status.ACCEPTED
        grant.responded_at = timezone.now()
        grant.save(update_fields=("recipient", "status", "responded_at"))
        log_activity(
            request,
            "share_accepted",
            grant.node,
            metadata={"sender": grant.created_by.email, "permission": grant.permission},
        )
        return Response(ShareGrantSerializer(grant).data)

    @action(detail=True, methods=("post",))
    def ignore(self, request, pk=None):
        grant = self._owned_grant(pk)
        grant.recipient = request.user
        grant.status = ShareGrant.Status.IGNORED
        grant.responded_at = timezone.now()
        grant.save(update_fields=("recipient", "status", "responded_at"))
        log_activity(
            request,
            "share_ignored",
            grant.node,
            metadata={"sender": grant.created_by.email},
        )
        return Response(ShareGrantSerializer(grant).data)

    @action(detail=True, methods=("post",))
    def revoke(self, request, pk=None):
        """Recipient unaccepts access, or the original sharer withdraws the grant."""
        grant = get_object_or_404(
            ShareGrant.objects.select_related("node", "created_by"),
            Q(recipient=request.user)
            | Q(recipient_email__iexact=request.user.email)
            | Q(created_by=request.user),
            pk=pk,
        )
        grant.status = ShareGrant.Status.REVOKED
        grant.responded_at = timezone.now()
        grant.save(update_fields=("status", "responded_at"))
        log_activity(
            request,
            "share_revoked",
            grant.node,
            metadata={"recipient_email": grant.recipient_email},
        )
        return Response(ShareGrantSerializer(grant).data)


class PublicShareView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "anon"

    def _link(self, token):
        link = get_object_or_404(
            ShareLink.objects.select_related("node", "node__owner"),
            token_hash=ShareLink.hash_token(token),
            is_active=True,
        )
        if link.expires_at and link.expires_at <= timezone.now():
            return None
        return link

    def get(self, request, token):
        link = self._link(token)
        if not link:
            return Response({"detail": "This share link has expired."}, status=status.HTTP_410_GONE)
        password = request.headers.get("X-Share-Password", "")
        if not link.check_password(password):
            return Response({"detail": "A valid share password is required."}, status=status.HTTP_401_UNAUTHORIZED)
        node = link.node
        if node.node_type == "file" and node.content:
            if request.query_params.get("download") == "1":
                return FileResponse(
                    node.content.open("rb"),
                    as_attachment=True,
                    filename=node.name,
                    content_type=node.mime_type,
                )
            if request.query_params.get("preview") == "1":
                response = FileResponse(node.content.open("rb"), content_type=node.mime_type)
                response["Content-Disposition"] = f'inline; filename="{node.name}"'
                return response
        return Response(
            {
                "name": node.name,
                "type": node.category,
                "size": node.size_bytes,
                "mime_type": node.mime_type,
                "owner": node.owner.display_name,
                "permission": link.permission,
                "password_protected": bool(link.password_hash),
                "expires_at": link.expires_at,
                "download_available": node.node_type == "file" and bool(node.content),
                "preview_available": node.node_type == "file" and bool(node.content),
            }
        )


class ActivityListView(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = ActivityLogSerializer
    search_fields = ("actor__display_name", "target_name", "action")
    ordering_fields = ("created_at", "action")

    def get_queryset(self):
        queryset = ActivityLog.objects.filter(organization=self.request.user.organization).select_related("actor")
        if self.request.user.role != "admin" and not self.request.user.is_superuser:
            queryset = queryset.filter(actor=self.request.user)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Admins see clear action types (upload/delete/share). File names stay
        # visible so the org can investigate; only metadata can be redacted later.
        context["mask_sensitive"] = False
        return context


class DashboardView(APIView):
    def get(self, request):
        now = timezone.now()
        mine = FileNode.objects.filter(owner=request.user, deleted_at__isnull=True)
        files = mine.filter(node_type="file")
        storage_used = files.aggregate(value=Sum("size_bytes"))["value"] or 0
        shared_items = mine.filter(Q(share_grants__isnull=False) | Q(share_links__is_active=True)).distinct().count()
        recent = FileNodeSerializer(mine.select_related("owner").order_by("-updated_at")[:5], many=True).data
        activity = ActivityLogSerializer(
            ActivityLog.objects.filter(organization=request.user.organization, actor=request.user)[:8], many=True
        ).data
        daily = (
            ActivityLog.objects.filter(organization=request.user.organization, created_at__gte=now - timedelta(days=7))
            .annotate(day=TruncDate("created_at"))
            .values("day", "action")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        chart = {}
        for row in daily:
            key = row["day"].isoformat()
            chart.setdefault(key, {"day": key, "uploads": 0, "downloads": 0, "shares": 0})
            target = {"uploaded": "uploads", "downloaded": "downloads", "shared": "shares"}.get(row["action"])
            if target:
                chart[key][target] = row["count"]
        categories = {"Documents": 0, "Images": 0, "Videos": 0, "Other": 0}
        for node in files.only("mime_type", "size_bytes", "name"):
            category = node.category
            target = "Images" if category == "image" else "Videos" if category == "video" else "Documents" if category in ("document", "pdf") else "Other"
            categories[target] += node.size_bytes
        return Response(
            {
                "stats": {
                    "total_files": files.count(),
                    "storage_used": storage_used,
                    "storage_total": request.user.effective_storage_quota,
                    "shared_items": shared_items,
                },
                "activity_chart": list(chart.values()),
                "storage_breakdown": [{"name": key, "value": value} for key, value in categories.items()],
                "recent_files": recent,
                "recent_activity": activity,
            }
        )


class AdminAnalyticsView(APIView):
    permission_classes = [IsOrganizationAdmin]

    def get(self, request):
        organization = request.user.organization
        now = timezone.now()
        nodes = FileNode.objects.filter(organization=organization, deleted_at__isnull=True)
        growth = (
            User.objects.filter(organization=organization)
            .annotate(month=TruncMonth("date_joined"))
            .values("month")
            .annotate(users=Count("id"))
            .order_by("month")
        )
        daily = (
            ActivityLog.objects.filter(organization=organization, created_at__gte=now - timedelta(days=7))
            .annotate(day=TruncDate("created_at"))
            .values("day", "action")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        chart = {}
        for row in daily:
            key = row["day"].isoformat()
            chart.setdefault(key, {"day": row["day"].strftime("%a"), "uploads": 0, "downloads": 0, "deletes": 0, "shares": 0})
            target = {
                "uploaded": "uploads",
                "downloaded": "downloads",
                "moved_to_trash": "deletes",
                "permanently_deleted": "deletes",
                "shared": "shares",
                "share_accepted": "shares",
            }.get(row["action"])
            if target:
                chart[key][target] += row["count"]
        return Response(
            {
                "total_users": User.objects.filter(organization=organization).count(),
                "active_today": User.objects.filter(organization=organization, last_login__date=now.date()).count(),
                "total_storage": nodes.filter(node_type="file").aggregate(value=Sum("size_bytes"))["value"] or 0,
                "total_files": nodes.filter(node_type="file").count(),
                "user_growth": [
                    {"month": row["month"].strftime("%b %Y"), "users": row["users"]} for row in growth
                ],
                "activity_chart": list(chart.values()),
                "recent_activity": ActivityLogSerializer(
                    ActivityLog.objects.filter(organization=organization).select_related("actor")[:40],
                    many=True,
                    context={"request": request, "mask_sensitive": False},
                ).data,
            }
        )
