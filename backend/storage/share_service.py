"""
Share feature service (OOP).

Views stay thin: they validate HTTP input, then call ShareService.
ShareService owns the business rules (create grant, email, public link).
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import ValidationError

from config.mailer import send_notification

from .models import ShareGrant, ShareLink
from .services import ActivityLogger

User = get_user_model()


class ShareService:
    """
    Handles person-to-person shares and secure public links.

    Example:
        service = ShareService(request)
        grant, created, emailed = service.invite_by_email(node, email, "share")
    """

    def __init__(self, request):
        self.request = request
        self.user = request.user
        self.logger = ActivityLogger(request)

    def invite_by_email(self, node, email: str, permission: str):
        """Create/update a pending share and email the recipient via SMTP."""
        recipient = User.objects.filter(email=email, organization=self.user.organization).first()
        if recipient == self.user:
            raise ValidationError({"detail": "You already own this item."})

        with transaction.atomic():
            grant, created = ShareGrant.objects.update_or_create(
                node=node,
                recipient_email=email,
                defaults={
                    "recipient": recipient,
                    "permission": permission,
                    "created_by": self.user,
                    "status": ShareGrant.Status.PENDING,
                    "responded_at": None,
                },
            )
            self.logger.log(
                "shared",
                node,
                metadata={
                    "recipient_email": email,
                    "permission": grant.permission,
                    "status": grant.status,
                },
            )
            # Simple inbox link for the person who received the share
            app_url = f"{settings.FRONTEND_URL}/user/?shared=inbox"
            product = getattr(settings, "PRODUCT_NAME", "Cloud Based Storage System")
            emailed = send_notification(
                subject=f"{self.user.display_name} shared '{node.name}' with you",
                body=(
                    f"{self.user.display_name} shared '{node.name}' with you on {product} "
                    f"with {grant.permission} access.\n\n"
                    f"Sign in and open Shared → Pending requests to accept or ignore:\n{app_url}\n\n"
                    "After you accept, you can preview and download the file."
                ),
                to=email,
                fail_silently=False,
                require_real_delivery=True,
            )
        return grant, created, bool(emailed)

    def create_secure_link(self, node, *, permission: str, expires_at=None, password: str = "", notify_email: str = ""):
        """Create a public share link; optionally email the URL."""
        if not self.user.organization.allow_public_links:
            raise ValidationError({"detail": "Public links are disabled."})

        raw_token, token_hash = ShareLink.generate_token()
        notify_email = (notify_email or "").strip()

        with transaction.atomic():
            link = ShareLink(
                node=node,
                created_by=self.user,
                token_hash=token_hash,
                permission=permission,
                expires_at=expires_at,
            )
            link.set_password(password or "")
            link.save()
            self.logger.log("created_share_link", node)

            public_url = self.request.build_absolute_uri(f"/api/public/shares/{raw_token}/")
            emailed = False
            if notify_email:
                product = getattr(settings, "PRODUCT_NAME", "Cloud Based Storage System")
                emailed = bool(
                    send_notification(
                        subject=f"{self.user.display_name} shared '{node.name}' with you",
                        body=(
                            f"{self.user.display_name} shared '{node.name}' with you via a secure "
                            f"{product} link ({link.permission} access).\n\n"
                            f"Open the link:\n{public_url}\n\n"
                            + (
                                "This link is password protected; ask the sender for the password.\n"
                                if link.password_hash
                                else ""
                            )
                        ),
                        to=notify_email,
                        fail_silently=False,
                        require_real_delivery=True,
                    )
                )

        return {
            "id": link.id,
            "token": raw_token,
            "url": public_url,
            "expires_at": link.expires_at,
            "permission": link.permission,
            "password_protected": bool(link.password_hash),
            "email_sent": emailed,
        }
