import os
import sys
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
# override=True so .env always wins over stale shell/OS EMAIL_* variables
load_dotenv(BASE_DIR.parent / ".env", override=True)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-development-key-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = [v.strip() for v in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if v.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "storages",
    "accounts",
    "storage",
    "assistant",
    "messaging",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"

if os.getenv("USE_SQLITE", "false").lower() == "true":
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "nexus_storage"),
            "USER": os.getenv("POSTGRES_USER", "postgres"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Product display name used in emails, TOTP issuer, and system copy.
PRODUCT_NAME = os.getenv("PRODUCT_NAME", "Cloud Based Storage System").strip() or "Cloud Based Storage System"

# Object storage via boto3 / django-storages.
# Set STORAGE_BACKEND=s3 and fill AWS_* for Cloudflare R2, MinIO, AWS S3, or Supabase.
# Leave STORAGE_BACKEND=local (default) to keep files on disk under MEDIA_ROOT.
if os.getenv("STORAGE_BACKEND", "local").lower().strip() == "s3":
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3.S3Storage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL") or None
    AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "auto")
    AWS_S3_SIGNATURE_VERSION = os.getenv("AWS_S3_SIGNATURE_VERSION", "s3v4")
    AWS_S3_ADDRESSING_STYLE = os.getenv("AWS_S3_ADDRESSING_STYLE", "path")
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = int(os.getenv("AWS_QUERYSTRING_EXPIRE", "900"))
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}

CORS_ALLOWED_ORIGINS = [
    v.strip() for v in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if v.strip()
]
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("accounts.permissions.IsActiveTenantUser",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {"anon": "30/min", "user": "600/hour", "ai": "30/hour"},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "CHECK_REVOKE_TOKEN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 0 if DEBUG else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Email: use SMTP whenever Gmail credentials are present (Share → Send needs real delivery).
EMAIL_BACKEND = (os.getenv("EMAIL_BACKEND") or "django.core.mail.backends.console.EmailBackend").strip().strip('"').strip("'")
EMAIL_HOST = (os.getenv("EMAIL_HOST") or "smtp.gmail.com").strip()
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
# Gmail App Passwords are often copied with spaces — strip them for SMTP auth.
EMAIL_HOST_USER = (os.getenv("EMAIL_HOST_USER") or "").strip()
EMAIL_HOST_PASSWORD = (os.getenv("EMAIL_HOST_PASSWORD") or "").replace(" ", "").strip()
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15"))
if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
DEFAULT_FROM_EMAIL = (
    os.getenv("DEFAULT_FROM_EMAIL")
    or (
        f"{PRODUCT_NAME} <{EMAIL_HOST_USER}>"
        if EMAIL_HOST_USER
        else f"{PRODUCT_NAME} <no-reply@cloudbasedstorage.local>"
    )
).strip()
if "test" in sys.argv:
    EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    # Keep tests on local disk even if .env points at S3.
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
    if "testserver" not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append("testserver")
elif EMAIL_BACKEND.endswith("smtp.EmailBackend"):
    # Visible in the backend console so you can confirm SMTP after restart.
    print(
        f"[email] SMTP ready via {EMAIL_HOST}:{EMAIL_PORT} as {EMAIL_HOST_USER}",
        flush=True,
    )

# Default system super administrator, created automatically on migrate.
# Override in .env and change the password after the first sign-in.
SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "superadmin@nexusstorage.local").lower().strip()
SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "SuperAdmin@12345")
SUPERADMIN_NAME = os.getenv("SUPERADMIN_NAME", "System Super Admin")

# Antivirus: "heuristic" (default, no external deps), "clamav" (uses clamscan if installed), or "disabled".
ANTIVIRUS_MODE = os.getenv("ANTIVIRUS_MODE", "heuristic").lower()
ANTIVIRUS_ALLOW_DISABLE = os.getenv("ANTIVIRUS_ALLOW_DISABLE", "false").lower() == "true"
ANTIVIRUS_MAX_SCAN_BYTES = int(os.getenv("ANTIVIRUS_MAX_SCAN_BYTES", str(32 * 1024 * 1024)))
ANTIVIRUS_TIMEOUT_SECONDS = int(os.getenv("ANTIVIRUS_TIMEOUT_SECONDS", "30"))

AI_PROVIDER = os.getenv("AI_PROVIDER", "disabled")
AI_MODEL = os.getenv("AI_MODEL", "llama3.2:3b")
AI_BASE_URL = os.getenv("AI_BASE_URL", "http://localhost:11434/v1")
AI_API_KEY = os.getenv("AI_API_KEY", "ollama")
AI_TIMEOUT_SECONDS = int(os.getenv("AI_TIMEOUT_SECONDS", "60"))

# Local trainable file-analysis model (no external AI APIs).
FILE_ANALYSIS_ENABLED = os.getenv("FILE_ANALYSIS_ENABLED", "true").lower() == "true"
FILE_ANALYSIS_MAX_SENTENCES = int(os.getenv("FILE_ANALYSIS_MAX_SENTENCES", "5"))
# 0 = extract full file text (any size). Set a positive number to soft-cap chars.
FILE_ANALYSIS_MAX_EXTRACT_CHARS = int(os.getenv("FILE_ANALYSIS_MAX_EXTRACT_CHARS", "0"))
