"""Central email helper used for invitations and share notifications.

Uses Django's configured EMAIL_BACKEND. Console/locmem backends work for local
development and tests. Configure SMTP (e.g. Gmail App Password) for real inbox
delivery. Callers can choose whether a delivery failure should abort the request.
"""
from django.conf import settings
from django.core.mail import send_mail
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


def _validate_delivery_configuration(require_real_delivery=False):
    kind = email_backend_kind()
    if kind in ("console", "locmem", "other") and not require_real_delivery:
        return
    if kind == "smtp" and (not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD):
        raise EmailDeliveryError(
            "Gmail SMTP credentials are missing. Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD "
            "to a Gmail address and App Password, then restart the backend."
        )
    if require_real_delivery and kind == "console":
        raise EmailDeliveryError(
            "Email delivery is still using the console backend, so messages will not reach Gmail. "
            "Set EMAIL_BACKEND to smtp and add Gmail App Password credentials in .env."
        )


def send_notification(subject, body, to, fail_silently=False, require_real_delivery=False):
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [address for address in recipients if address]
    if not recipients:
        return 0
    try:
        _validate_delivery_configuration(require_real_delivery=require_real_delivery)
        sent = send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
    except EmailDeliveryError:
        if fail_silently:
            return 0
        raise
    except Exception as error:
        if fail_silently:
            return 0
        raise EmailDeliveryError(
            "Gmail could not send the message. Check the sender address, App Password, "
            "internet connection, and backend log."
        ) from error
    if sent != len(recipients):
        if fail_silently:
            return 0
        raise EmailDeliveryError("The email provider did not accept the message.")
    return sent
