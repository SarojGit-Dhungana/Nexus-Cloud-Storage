"""Account credential emails (SMTP via config.mailer)."""

from django.conf import settings

from config.mailer import send_notification


def portal_login_url(role: str) -> str:
    """Return the correct frontend portal URL for a role."""
    base = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    if role == "admin":
        return f"{base}/admin"
    if role == "superadmin":
        return f"{base}/system"
    return f"{base}/user"


def send_account_credentials_email(
    *,
    to_email: str,
    display_name: str,
    password: str,
    role: str,
    organization_name: str | None,
    invited_by_name: str,
    require_real_delivery: bool = True,
) -> int:
    """
    Email a newly created (or password-reset) account with:
    email, temporary password, and the correct portal login URL.
    """
    product = getattr(settings, "PRODUCT_NAME", "Cloud Based Storage System")
    login_url = portal_login_url(role)
    role_label = "administrator" if role == "admin" else "member"
    workspace = organization_name or product
    body = (
        f"Hello {display_name},\n\n"
        f"{invited_by_name} created a {product} {role_label} account for you"
        f"{f' in the “{workspace}” workspace' if organization_name else ''}.\n\n"
        f"Sign in with these details:\n"
        f"  Email: {to_email}\n"
        f"  Temporary password: {password}\n"
        f"  Login URL: {login_url}\n\n"
        f"Open the link above, sign in, then change your password from Profile.\n"
        f"Keep this email private — the temporary password lets anyone into your account.\n\n"
        f"If you did not expect this message, contact your administrator.\n\n"
        f"— {product}"
    )
    subject = f"Your {product} account for {workspace}"
    return send_notification(
        subject=subject,
        body=body,
        to=to_email,
        fail_silently=False,
        require_real_delivery=require_real_delivery,
    )
