from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Invitation, Organization, User
from .security import decrypt_secret
from .totp import verify_code


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "storage_quota_bytes",
            "max_file_size_bytes",
            "require_two_factor",
            "audit_logging",
            "api_access",
            "automatic_backups",
            "email_notifications",
            "maintenance_mode",
            "allow_public_links",
            "allow_self_registration",
            "is_active",
        )
        read_only_fields = ("id", "slug", "is_active")

    def validate_require_two_factor(self, value):
        request = self.context.get("request")
        if value and request and not request.user.totp_enabled:
            raise serializers.ValidationError(
                "Enable two-factor authentication on your own account before requiring it for the organization."
            )
        return value


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name")
    storage_used = serializers.SerializerMethodField()
    storage_total = serializers.IntegerField(source="effective_storage_quota", read_only=True)
    organization = OrganizationSerializer(read_only=True)
    two_factor_enabled = serializers.BooleanField(source="totp_enabled", read_only=True)
    two_factor_required = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "name",
            "email",
            "avatar_url",
            "role",
            "is_active",
            "date_joined",
            "storage_used",
            "storage_total",
            "two_factor_enabled",
            "two_factor_required",
            "organization",
        )

    def get_storage_used(self, obj):
        return (
            obj.owned_nodes.filter(node_type="file", deleted_at__isnull=True).aggregate(total=Sum("size_bytes"))["total"]
            or 0
        )

    def get_two_factor_required(self, obj):
        try:
            organization = obj.organization
        except Organization.DoesNotExist:
            return False
        return bool(organization and organization.require_two_factor and not obj.totp_enabled)


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    account_type = serializers.ChoiceField(choices=("organization", "user"), default="organization")
    organization_name = serializers.CharField(max_length=160, required=False, allow_blank=True)
    organization_slug = serializers.SlugField(max_length=180, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        account_type = attrs.get("account_type", "organization")
        if account_type == "organization":
            if not (attrs.get("organization_name") or "").strip():
                raise serializers.ValidationError({"organization_name": "Organization name is required."})
        else:
            slug = (attrs.get("organization_slug") or "").strip().lower()
            if not slug:
                raise serializers.ValidationError({"organization_slug": "Organization slug is required."})
            organization = Organization.objects.filter(slug=slug).first()
            if not organization:
                raise serializers.ValidationError({"organization_slug": "Organization was not found."})
            if not organization.is_active:
                raise serializers.ValidationError(
                    {"organization_slug": "This organization is suspended and cannot accept new members."}
                )
            if not organization.allow_self_registration:
                raise serializers.ValidationError(
                    {
                        "organization_slug": (
                            "Self-registration is turned off for this organization. "
                            "Ask an admin for an invite link."
                        )
                    }
                )
            attrs["organization"] = organization
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        account_type = validated_data.pop("account_type", "organization")
        validated_data.pop("organization_slug", None)
        organization_name = validated_data.pop("organization_name", "")
        if account_type == "user":
            organization = validated_data.pop("organization")
            # Re-check at write time so a toggle flip between validate/create is honored.
            organization.refresh_from_db(fields=("allow_self_registration", "is_active"))
            if not organization.is_active:
                raise serializers.ValidationError(
                    {"organization_slug": "This organization is suspended and cannot accept new members."}
                )
            if not organization.allow_self_registration:
                raise serializers.ValidationError(
                    {
                        "organization_slug": (
                            "Self-registration is turned off for this organization. "
                            "Ask an admin for an invite link."
                        )
                    }
                )
            role = User.Role.USER
        else:
            organization = Organization.objects.create(name=organization_name.strip())
            role = User.Role.ADMIN
        return User.objects.create_user(
            organization=organization,
            role=role,
            display_name=validated_data["name"],
            email=validated_data["email"],
            password=validated_data["password"],
        )


class LoginSerializer(TokenObtainPairSerializer):
    otp = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        otp = attrs.pop("otp", "")
        data = super().validate(attrs)
        if self.user.totp_enabled:
            secret = decrypt_secret(self.user.totp_secret_encrypted)
            if not verify_code(secret, otp, self.user.totp_drift_steps):
                raise serializers.ValidationError({"otp": "A valid authenticator code is required."})
        data["user"] = UserSerializer(self.user).data
        return data


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    # Workspace admins may only toggle between admin and user; system-level
    # super admin can never be granted from inside a workspace.
    role = serializers.ChoiceField(choices=(User.Role.ADMIN, User.Role.USER), required=False)

    class Meta:
        model = User
        fields = ("role", "is_active", "storage_quota_bytes")


class ProfileUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name", max_length=160)

    class Meta:
        model = User
        fields = ("name", "avatar_url")


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=(User.Role.ADMIN, User.Role.USER), default=User.Role.USER
    )

    def validate_email(self, value):
        value = value.lower().strip()
        organization = self.context["request"].user.organization
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already has an account.")
        return value


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField()
    name = serializers.CharField(max_length=160)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        invitation = Invitation.objects.filter(
            token_hash=Invitation.hash_token(attrs["token"]),
            accepted_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).select_related("organization").first()
        if not invitation:
            raise serializers.ValidationError({"token": "Invitation is invalid or expired."})
        if User.objects.filter(email=invitation.email).exists():
            raise serializers.ValidationError({"token": "An account already exists for this invitation."})
        attrs["invitation"] = invitation
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        invitation = Invitation.objects.select_for_update().get(pk=validated_data["invitation"].pk)
        if invitation.accepted_at:
            raise serializers.ValidationError({"token": "Invitation has already been used."})
        user = User.objects.create_user(
            email=invitation.email,
            password=validated_data["password"],
            display_name=validated_data["name"],
            organization=invitation.organization,
            role=invitation.role,
        )
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=("accepted_at",))
        return user


# ─── Super admin (system level) ──────────────────────────────────────────────


class WorkspaceSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)
    admin_count = serializers.IntegerField(read_only=True)
    storage_used = serializers.IntegerField(read_only=True)

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "storage_quota_bytes",
            "max_file_size_bytes",
            "require_two_factor",
            "allow_public_links",
            "allow_self_registration",
            "maintenance_mode",
            "is_active",
            "created_at",
            "user_count",
            "admin_count",
            "storage_used",
        )
        read_only_fields = ("id", "slug", "created_at", "user_count", "admin_count", "storage_used")


class WorkspaceCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    storage_quota_bytes = serializers.IntegerField(required=False, min_value=1)
    admin_name = serializers.CharField(max_length=160, required=False, allow_blank=True)
    admin_email = serializers.EmailField(required=False, allow_blank=True)
    admin_password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)

    def validate_admin_email(self, value):
        value = (value or "").lower().strip()
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        email = (attrs.get("admin_email") or "").strip()
        password = (attrs.get("admin_password") or "").strip()
        name = (attrs.get("admin_name") or "").strip()
        if email or password or name:
            if not email:
                raise serializers.ValidationError({"admin_email": "Administrator email is required."})
            if not password:
                raise serializers.ValidationError({"admin_password": "Administrator password is required."})
            validate_password(password)
            attrs["admin_name"] = name or email.split("@")[0]
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        organization = Organization.objects.create(
            name=validated_data["name"].strip(),
            **(
                {"storage_quota_bytes": validated_data["storage_quota_bytes"]}
                if validated_data.get("storage_quota_bytes")
                else {}
            ),
        )
        email = (validated_data.get("admin_email") or "").strip()
        if email:
            User.objects.create_user(
                email=email,
                password=validated_data["admin_password"],
                display_name=validated_data["admin_name"],
                organization=organization,
                role=User.Role.ADMIN,
            )
        return organization


class SystemUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name", read_only=True)
    organization_id = serializers.UUIDField(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True, default=None)
    two_factor_enabled = serializers.BooleanField(source="totp_enabled", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "name",
            "email",
            "role",
            "is_active",
            "date_joined",
            "last_login",
            "two_factor_enabled",
            "organization_id",
            "organization_name",
        )
        read_only_fields = fields


class SystemAdminCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())
    role = serializers.ChoiceField(
        choices=(User.Role.ADMIN, User.Role.USER), default=User.Role.ADMIN
    )

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            display_name=validated_data["name"],
            organization=validated_data["organization"],
            role=validated_data["role"],
        )


class SystemUserUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=(User.Role.ADMIN, User.Role.USER), required=False)
    is_active = serializers.BooleanField(required=False)
    password = serializers.CharField(write_only=True, min_length=8, required=False)

    def validate_password(self, value):
        validate_password(value)
        return value

    def update(self, instance, validated_data):
        if "role" in validated_data:
            instance.role = validated_data["role"]
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]
        if validated_data.get("password"):
            instance.set_password(validated_data["password"])
        instance.save()
        return instance
