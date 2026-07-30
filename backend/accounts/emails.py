"""Account invitation and credential emails (SMTP via config.mailer)."""

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
    login_url = portal_login_url(role)
    role_label = "administrator" if role == "admin" else "member"
    workspace = organization_name or "NexusStorage"
    body = (
        f"Hello {display_name},\n\n"
        f"{invited_by_name} created a NexusStorage {role_label} account for you"
        f"{f' in the “{workspace}” workspace' if organization_name else ''}.\n\n"
        f"Sign in with these details:\n"
        f"  Email: {to_email}\n"
        f"  Temporary password: {password}\n"
        f"  Login URL: {login_url}\n\n"
        f"Open the link above, sign in, then change your password from Profile.\n"
        f"Keep this email private — the temporary password lets anyone into your account.\n\n"
        f"If you did not expect this message, contact your administrator.\n\n"
        f"— NexusStorage"
    )
    subject = f"Your NexusStorage account for {workspace}"
    return send_notification(
        subject=subject,
        body=body,
        to=to_email,
        fail_silently=False,
        require_real_delivery=require_real_delivery,
    )


def send_invitation_email(
    *,
    to_email: str,
    role: str,
    organization_name: str,
    invited_by_name: str,
    invite_url: str,
    require_real_delivery: bool = True,
) -> int:
    """Email an invite-link (recipient chooses their own password on accept)."""
    role_label = "administrator" if role == "admin" else "member"
    body = (
        f"Hello,\n\n"
        f"{invited_by_name} invited you to join the “{organization_name}” workspace "
        f"on NexusStorage as a {role_label}.\n\n"
        f"Invitation details:\n"
        f"  Email (use this address): {to_email}\n"
        f"  Accept invitation URL (valid for 7 days):\n"
        f"  {invite_url}\n\n"
        f"Open the URL, set your name and password, then sign in at the member portal.\n"
        f"You choose your own password when you accept — none is assigned in this email.\n\n"
        f"If you did not expect this invitation, you can ignore this message.\n\n"
        f"— NexusStorage"
    )
    return send_notification(
        subject=f"You're invited to {organization_name} on NexusStorage",
        body=body,
        to=to_email,
        fail_silently=False,
        require_real_delivery=require_real_delivery,
    )
