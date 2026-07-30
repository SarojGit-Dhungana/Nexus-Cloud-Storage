import base64
import io
from datetime import timedelta

import qrcode
from django.conf import settings
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
import pyotp

from config.mailer import send_notification
from .models import Invitation, Organization, User
from .permissions import IsOrganizationAdmin, IsSuperAdmin
from .security import decrypt_secret, encrypt_secret
from .totp import find_enrollment_drift, provisioning_uri, verify_code
from .serializers import (
    AdminUserUpdateSerializer,
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
    LoginSerializer,
    OrganizationSerializer,
    PasswordChangeSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    SystemAdminCreateSerializer,
    SystemUserSerializer,
    SystemUserUpdateSerializer,
    UserSerializer,
    WorkspaceCreateSerializer,
    WorkspaceSerializer,
    portal_for_role,
)


def _qr_data_uri(payload):
    image = qrcode.make(payload)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def _reject_wrong_portal(request, user):
    portal = (request.data.get("portal") or "").strip().lower()
    if not portal:
        return None
    expected = portal_for_role(user.role)
    if portal != expected:
        return Response(
            {
                "detail": (
                    f"This {user.role} account belongs on the {expected} portal. "
                    f"Open /{expected} instead."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        denied = _reject_wrong_portal(request, user)
        if denied:
            user.delete()
            return denied
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class PasswordChangeView(APIView):
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=("password",))
        return Response(status=status.HTTP_204_NO_CONTENT)


class TwoFactorSetupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.check_password(request.data.get("password", "")):
            return Response({"detail": "Password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        secret = pyotp.random_base32()
        user = User.objects.select_related("organization").get(pk=request.user.pk)
        user.totp_secret_encrypted = encrypt_secret(secret)
        user.totp_enabled = False
        user.totp_drift_steps = 0
        user.save(update_fields=("totp_secret_encrypted", "totp_enabled", "totp_drift_steps"))
        issuer = user.organization.name if user.organization_id else "NexusStorage"
        uri = provisioning_uri(secret, user.email, issuer)
        return Response({"secret": secret, "provisioning_uri": uri, "qr_code": _qr_data_uri(uri)})


class TwoFactorConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = User.objects.get(pk=request.user.pk)
        if not user.totp_secret_encrypted:
            return Response({"detail": "Start two-factor setup first."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            secret = decrypt_secret(user.totp_secret_encrypted)
        except Exception:
            return Response(
                {"detail": "Saved authenticator secret could not be read. Start setup again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        drift_steps = find_enrollment_drift(secret, request.data.get("otp", ""))
        if drift_steps is None:
            return Response(
                {
                    "detail": (
                        "Authenticator code is invalid. Delete any old NexusStorage entry in your app, "
                        "scan the QR again, wait for a fresh 6-digit code, and retry. "
                        "Also turn on automatic date & time on your phone."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.totp_enabled = True
        user.totp_drift_steps = drift_steps
        user.save(update_fields=("totp_enabled", "totp_drift_steps"))
        return Response({"two_factor_enabled": True})


class TwoFactorDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get("password", "")
        otp = str(request.data.get("otp", ""))
        user = User.objects.select_related("organization").get(pk=request.user.pk)
        if not user.check_password(password):
            return Response({"detail": "Password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        if user.organization and user.organization.require_two_factor:
            return Response({"detail": "Your organization requires two-factor authentication."}, status=status.HTTP_400_BAD_REQUEST)
        secret = decrypt_secret(user.totp_secret_encrypted) if user.totp_secret_encrypted else ""
        if not secret or not verify_code(secret, otp, user.totp_drift_steps):
            return Response({"detail": "Authenticator code is invalid."}, status=status.HTTP_400_BAD_REQUEST)
        user.totp_enabled = False
        user.totp_secret_encrypted = ""
        user.totp_drift_steps = 0
        user.save(update_fields=("totp_enabled", "totp_secret_encrypted", "totp_drift_steps"))
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            return Response({"detail": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrganizationSettingsView(APIView):
    permission_classes = [IsOrganizationAdmin]

    def get(self, request):
        return Response(OrganizationSerializer(request.user.organization).data)

    def patch(self, request):
        serializer = OrganizationSerializer(
            request.user.organization, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OrganizationDataClearView(APIView):
    permission_classes = [IsOrganizationAdmin]

    def delete(self, request):
        organization = request.user.organization
        if request.data.get("confirmation") != organization.name:
            return Response(
                {"detail": "Organization name confirmation does not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not request.user.check_password(request.data.get("password", "")):
            return Response({"detail": "Password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        from assistant.models import Conversation
        from storage.models import ActivityLog, FileNode

        nodes = FileNode.objects.filter(organization=organization)
        for node in nodes.filter(node_type="file"):
            if node.content:
                node.content.delete(save=False)
        nodes.delete()
        ActivityLog.objects.filter(organization=organization).delete()
        Conversation.objects.filter(user__organization=organization).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceListCreateView(generics.ListCreateAPIView):
    """Super admin: every workspace in the system."""

    permission_classes = [IsSuperAdmin]
    search_fields = ("name", "slug")
    ordering_fields = ("created_at", "name")

    def get_queryset(self):
        return Organization.objects.annotate(
            user_count=Count("users", distinct=True),
            admin_count=Count("users", filter=Q(users__role=User.Role.ADMIN), distinct=True),
            storage_used=Sum(
                "nodes__size_bytes",
                filter=Q(nodes__node_type="file", nodes__deleted_at__isnull=True),
            ),
        ).order_by("-created_at")

    def get_serializer_class(self):
        return WorkspaceCreateSerializer if self.request.method == "POST" else WorkspaceSerializer

    def create(self, request, *args, **kwargs):
        serializer = WorkspaceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = serializer.save()
        return Response(
            WorkspaceSerializer(self.get_queryset().get(pk=organization.pk)).data,
            status=status.HTTP_201_CREATED,
        )


class WorkspaceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Super admin: inspect, reconfigure, suspend, or delete a workspace."""

    permission_classes = [IsSuperAdmin]
    serializer_class = WorkspaceSerializer

    def get_queryset(self):
        return Organization.objects.annotate(
            user_count=Count("users", distinct=True),
            admin_count=Count("users", filter=Q(users__role=User.Role.ADMIN), distinct=True),
            storage_used=Sum(
                "nodes__size_bytes",
                filter=Q(nodes__node_type="file", nodes__deleted_at__isnull=True),
            ),
        )

    def perform_destroy(self, instance):
        from storage.models import FileNode

        for node in FileNode.objects.filter(organization=instance, node_type="file"):
            if node.content:
                node.content.delete(save=False)
        instance.delete()


class SystemUserListCreateView(generics.ListCreateAPIView):
    """Super admin: admins and members across every workspace."""

    permission_classes = [IsSuperAdmin]
    search_fields = ("display_name", "email", "organization__name")
    ordering_fields = ("date_joined", "display_name", "email")

    def get_queryset(self):
        queryset = User.objects.exclude(role=User.Role.SUPER_ADMIN).select_related("organization")
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)
        workspace = self.request.query_params.get("workspace")
        if workspace:
            queryset = queryset.filter(organization_id=workspace)
        return queryset.order_by("-date_joined")

    def get_serializer_class(self):
        return SystemAdminCreateSerializer if self.request.method == "POST" else SystemUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = SystemAdminCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(SystemUserSerializer(user).data, status=status.HTTP_201_CREATED)


class SystemUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Super admin: promote, demote, suspend, reset password, or remove an account."""

    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        return User.objects.exclude(role=User.Role.SUPER_ADMIN).select_related("organization")

    def get_serializer_class(self):
        return SystemUserUpdateSerializer if self.request.method in ("PUT", "PATCH") else SystemUserSerializer

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = SystemUserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SystemUserSerializer(user).data)


class SystemOverviewView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from storage.models import FileNode

        files = FileNode.objects.filter(node_type="file", deleted_at__isnull=True)
        return Response(
            {
                "workspaces": Organization.objects.count(),
                "active_workspaces": Organization.objects.filter(is_active=True).count(),
                "suspended_workspaces": Organization.objects.filter(is_active=False).count(),
                "admins": User.objects.filter(role=User.Role.ADMIN).count(),
                "users": User.objects.filter(role=User.Role.USER).count(),
                "storage_used": files.aggregate(value=Sum("size_bytes"))["value"] or 0,
                "files": files.count(),
            }
        )


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsOrganizationAdmin]
    search_fields = ("display_name", "email")
    ordering_fields = ("date_joined", "display_name", "email")

    def get_queryset(self):
        return (
            User.objects.filter(organization=self.request.user.organization)
            .annotate(storage_bytes=Sum("owned_nodes__size_bytes"))
            .order_by("-date_joined")
        )


class UserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsOrganizationAdmin]

    def get_queryset(self):
        return User.objects.filter(organization=self.request.user.organization)

    def get_serializer_class(self):
        return AdminUserUpdateSerializer if self.request.method in ("PUT", "PATCH") else UserSerializer

    def perform_update(self, serializer):
        user = self.get_object()
        next_role = serializer.validated_data.get("role", user.role)
        next_active = serializer.validated_data.get("is_active", user.is_active)
        if user == self.request.user and (next_role != "admin" or not next_active):
            raise ValidationError("You cannot remove your own active administrator access.")
        if user.role == "admin" and (next_role != "admin" or not next_active):
            active_admins = User.objects.filter(
                organization=user.organization, role="admin", is_active=True
            ).count()
            if active_admins <= 1:
                raise ValidationError("The organization must retain at least one active administrator.")
        serializer.save()


class InvitationCreateView(APIView):
    permission_classes = [IsOrganizationAdmin]

    def post(self, request):
        serializer = InvitationCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        Invitation.objects.filter(
            organization=request.user.organization, email=email, accepted_at__isnull=True
        ).delete()
        raw_token, token_hash = Invitation.generate_token()
        invitation = Invitation.objects.create(
            organization=request.user.organization,
            email=email,
            role=serializer.validated_data["role"],
            token_hash=token_hash,
            invited_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        invite_url = f"{settings.FRONTEND_URL}/user/?invite={raw_token}"
        organization = request.user.organization
        emailed = send_notification(
            subject=f"You're invited to {organization.name} on NexusStorage",
            body=(
                f"{request.user.display_name} invited you to join the "
                f"'{organization.name}' workspace on NexusStorage as a {invitation.role}.\n\n"
                f"Accept your invitation (valid for 7 days):\n{invite_url}\n\n"
                "If you did not expect this email you can ignore it."
            ),
            to=email,
            fail_silently=True,
        )
        return Response(
            {
                "id": invitation.id,
                "email": invitation.email,
                "expires_at": invitation.expires_at,
                "invite_url": invite_url,
                "email_sent": bool(emailed),
            },
            status=status.HTTP_201_CREATED,
        )


class InvitationAcceptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        denied = _reject_wrong_portal(request, user)
        if denied:
            user.delete()
            return denied
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )
