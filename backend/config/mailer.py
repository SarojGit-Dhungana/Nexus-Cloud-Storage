"""Central email helper used for invitations and share notifications.

Uses Django's configured EMAIL_BACKEND. Console/locmem backends work for local
development and tests. Configure SMTP (e.g. Gmail App Password) for real inbox
delivery. Callers can choose whether a delivery failure should abort the request.
"""
from django.conf import settings
from django.core.mail import get_connection, send_mail
from rest_framework.exceptions import APIException


class EmailDeliveryError(APIException):
    status_code = 503
    default_code = "email_delivery_unavailable"


def email_backend_kind():
    backend = settings.EMAIL_BACKEND or ""
    if backend.endswith("console.EmailBackend"):
        return "console"
    if backend.endswith("locmem.EmailBackend"):
        return "locmem"
    if backend.endswith("smtp.EmailBackend"):
        return "smtp"
    return "other"


def smtp_credentials_ready():
    return bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD)


def _validate_delivery_configuration(require_real_delivery=False):
    kind = email_backend_kind()
    # Tests use locmem; treat it as a successful "delivery" sink.
    if kind == "locmem":
        return
    if require_real_delivery:
        # Share → Send: credentials are enough; mailer forces an SMTP connection.
        if not smtp_credentials_ready():
            raise EmailDeliveryError(
                "Gmail SMTP credentials are missing. Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD "
                "to a Gmail address and App Password in .env, then fully restart the backend."
            )
        return
    if kind in ("console", "other"):
        return
    if kind == "smtp" and not smtp_credentials_ready():
        raise EmailDeliveryError(
            "Gmail SMTP credentials are missing. Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD "
            "to a Gmail address and App Password, then restart the backend."
        )


def _smtp_connection():
    """Build an explicit SMTP connection from settings (ignores a stale console backend)."""
    return get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=settings.EMAIL_HOST,
        port=settings.EMAIL_PORT,
        username=settings.EMAIL_HOST_USER,
        password=settings.EMAIL_HOST_PASSWORD,
        use_tls=settings.EMAIL_USE_TLS,
        timeout=getattr(settings, "EMAIL_TIMEOUT", 15),
    )


def send_notification(subject, body, to, fail_silently=False, require_real_delivery=False):
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [address for address in recipients if address]
    if not recipients:
        return 0
    try:
        _validate_delivery_configuration(require_real_delivery=require_real_delivery)
        # When real delivery is required and credentials exist, use SMTP
        # (skip in tests where EMAIL_BACKEND is locmem).
        connection = None
        if (
            require_real_delivery
            and smtp_credentials_ready()
            and email_backend_kind() != "locmem"
        ):
            connection = _smtp_connection()
        sent = send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
            connection=connection,
        )
    except EmailDeliveryError:
        if fail_silently:
            return 0
        raise
    except Exception as error:
        if fail_silently:
            return 0
        raise EmailDeliveryError(
            "Gmail could not send the message. Check the App Password, that 2-Step Verification "
            "is on, internet connection, and the backend log."
        ) from error
    if sent != len(recipients):
        if fail_silently:
            return 0
        raise EmailDeliveryError("The email provider did not accept the message.")
    return sent
