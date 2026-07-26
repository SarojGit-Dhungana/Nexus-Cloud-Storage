import hmac
import time

import pyotp


ENROLLMENT_DRIFT_STEPS = 40  # tolerate up to ±20 minutes while learning drift
VERIFICATION_WINDOW = 1  # then accept only the adjacent 30-second windows


def normalize_code(value):
    return "".join(character for character in str(value or "") if character.isdigit())


def normalize_secret(value):
    """Authenticator secrets are base32; strip spaces and unify case."""
    return "".join(str(value or "").split()).upper().replace("0", "O").replace("1", "I")


def _totp(secret):
    return pyotp.TOTP(normalize_secret(secret))


def find_enrollment_drift(secret, code, now=None):
    """Return the phone/server clock difference in TOTP steps, or None.

    Uses raw counter matching so we are not affected by local timezone quirks
    in datetime.fromtimestamp() that some pyotp versions rely on.
    """
    code = normalize_code(code)
    if len(code) != 6:
        return None

    timestamp = int(now if now is not None else time.time())
    totp = _totp(secret)
    current_counter = int(timestamp) // int(totp.interval)

    for offset in range(-ENROLLMENT_DRIFT_STEPS, ENROLLMENT_DRIFT_STEPS + 1):
        candidate = totp.generate_otp(current_counter + offset)
        if hmac.compare_digest(str(candidate), code):
            return offset
    return None


def verify_code(secret, code, drift_steps=0, now=None):
    code = normalize_code(code)
    if len(code) != 6:
        return False

    timestamp = int(now if now is not None else time.time())
    totp = _totp(secret)
    adjusted = timestamp + int(drift_steps or 0) * int(totp.interval)
    current_counter = int(adjusted) // int(totp.interval)

    for offset in range(-VERIFICATION_WINDOW, VERIFICATION_WINDOW + 1):
        candidate = totp.generate_otp(current_counter + offset)
        if hmac.compare_digest(str(candidate), code):
            return True
    return False


def provisioning_uri(secret, email, issuer_name="NexusStorage"):
    """Build a Google Authenticator–compatible otpauth URI with a safe issuer."""
    safe_issuer = "".join(
        character for character in str(issuer_name or "NexusStorage") if character.isalnum() or character in ("-", "_", " ")
    ).strip() or "NexusStorage"
    # Colons/slashes in the issuer break many authenticator apps' QR parsers.
    safe_issuer = safe_issuer.replace(":", " ").replace("/", " ")[:32]
    return _totp(secret).provisioning_uri(name=email, issuer_name=safe_issuer)
