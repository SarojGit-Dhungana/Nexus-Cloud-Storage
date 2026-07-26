"""Upload antivirus gate.

Files are scanned before they may be written to object storage. Default mode is a
local heuristic engine (EICAR + malware/script signatures + extension/MIME checks)
so scanning always runs without ClamAV. Set ANTIVIRUS_MODE=clamav when clamscan is
installed for deeper detection.
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from dataclasses import asdict, dataclass

from django.conf import settings

logger = logging.getLogger(__name__)

EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"

# Block high-risk executable/installer types. Source code (.js/.ts) stays allowed.
BLOCKED_EXTENSIONS = {
    ".exe", ".scr", ".bat", ".cmd", ".com", ".pif", ".msi", ".dll", ".cpl",
    ".ps1", ".vbs", ".vbe", ".jse", ".wsf", ".wsh",
    ".apk", ".dmg", ".iso", ".img",
}

# Long content signatures searched anywhere in the scanned window.
CONTENT_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (EICAR_SIGNATURE, "EICAR-Test-File"),
    (b"TVqQAAMAAAAEAAAA", "Windows-PE-Base64"),
    (b"<script>eval(", "Embedded-Script-Eval"),
    (b"powershell -enc", "PowerShell-Encoded"),
    (b"powershell -encodedcommand", "PowerShell-Encoded"),
    (b"cmd.exe /c ", "Cmd-Shell-Invocation"),
    (b"/bin/bash -i ", "Reverse-Shell-Bash"),
    (b"WScript.Shell", "Windows-Script-Host"),
    (b'CreateObject("WScript.Shell")', "Windows-Script-Host"),
    (b"<%eval request(", "Classic-ASP-WebShell"),
    (b"<?=`$_GET[", "PHP-WebShell"),
    (b"<?=system($_", "PHP-WebShell"),
    (b"<?php @eval($_", "PHP-WebShell"),
    (b"<?php system($_", "PHP-WebShell"),
    (b"javascript:/*", "Obfuscated-JavaScript"),
)


@dataclass
class ScanResult:
    clean: bool
    engine: str
    threat: str = ""
    detail: str = ""
    scanned_bytes: int = 0

    @property
    def rejected(self) -> bool:
        return not self.clean

    def as_dict(self):
        return asdict(self)


def _read_upload(uploaded_file, max_bytes: int | None = None) -> bytes:
    if hasattr(uploaded_file, "open"):
        try:
            uploaded_file.open("rb")
        except Exception:
            pass
    uploaded_file.seek(0)
    limit = max_bytes or getattr(settings, "ANTIVIRUS_MAX_SCAN_BYTES", 32 * 1024 * 1024)
    chunks = []
    remaining = limit + 1
    if hasattr(uploaded_file, "chunks"):
        for chunk in uploaded_file.chunks():
            chunks.append(chunk)
            remaining -= len(chunk)
            if remaining <= 0:
                break
        data = b"".join(chunks)
    else:
        data = uploaded_file.read(limit + 1)
    uploaded_file.seek(0)
    return data[:limit] if len(data) > limit else data


def scan_bytes(data: bytes, filename: str = "", content_type: str = "") -> ScanResult:
    mode = getattr(settings, "ANTIVIRUS_MODE", "heuristic").lower()
    if mode in ("off", "disabled", "none"):
        if not getattr(settings, "ANTIVIRUS_ALLOW_DISABLE", False):
            mode = "heuristic"
        else:
            return ScanResult(clean=True, engine="disabled", scanned_bytes=len(data))

    if mode == "clamav":
        result = _scan_with_clamav(data, filename)
        if result is not None:
            result.scanned_bytes = len(data)
            return result
        logger.warning("ClamAV unavailable; falling back to heuristic scanner")

    result = _scan_heuristic(data, filename, content_type)
    result.scanned_bytes = len(data)
    return result


def scan_uploaded_file(uploaded_file) -> ScanResult:
    data = _read_upload(uploaded_file)
    return scan_bytes(
        data,
        getattr(uploaded_file, "name", "") or "",
        getattr(uploaded_file, "content_type", "") or "",
    )


def _scan_heuristic(data: bytes, filename: str, content_type: str = "") -> ScanResult:
    lower_name = (filename or "").lower().strip()
    ext = os.path.splitext(lower_name)[1]

    if ext in BLOCKED_EXTENSIONS:
        return ScanResult(
            clean=False,
            engine="heuristic",
            threat="Blocked-File-Type",
            detail=f"Executable or script type '{ext}' is not allowed.",
        )

    # Double-extension tricks: invoice.pdf.exe
    if lower_name.count(".") >= 2:
        parts = lower_name.rsplit(".", 2)
        if f".{parts[-1]}" in BLOCKED_EXTENSIONS and parts[-2] in {
            "pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "txt", "csv",
        }:
            return ScanResult(
                clean=False,
                engine="heuristic",
                threat="Suspicious-Double-Extension",
                detail=f"Rejected disguised executable name '{filename}'.",
            )

    # Windows PE / DOS executable — only when the file itself starts with MZ.
    if data.startswith(b"MZ"):
        return ScanResult(
            clean=False,
            engine="heuristic",
            threat="Windows-PE-Executable",
            detail="Windows executable binaries are not allowed.",
        )

    # Content / extension mismatch (e.g. HTML saved as .pdf)
    head = data[:512].lstrip().lower()
    if ext == ".pdf" and head.startswith((b"<!doctype html", b"<html", b"<head", b"<script")):
        return ScanResult(
            clean=False,
            engine="heuristic",
            threat="Mime-Mismatch-HTML-as-PDF",
            detail="File claims to be a PDF but contains HTML/script content.",
        )
    if ext in {".jpg", ".jpeg", ".png", ".gif", ".webp"} and head.startswith(
        (b"<!doctype", b"<html", b"mz")
    ):
        return ScanResult(
            clean=False,
            engine="heuristic",
            threat="Mime-Mismatch-Image",
            detail="File claims to be an image but content does not match.",
        )
    if content_type.startswith("image/") and head.startswith((b"<!doctype", b"<html")):
        return ScanResult(
            clean=False,
            engine="heuristic",
            threat="Mime-Mismatch-Image",
            detail="Declared image content type does not match file bytes.",
        )

    haystack = data[: min(len(data), 4 * 1024 * 1024)]
    haystack_ascii = haystack.lower()
    for signature, threat in CONTENT_SIGNATURES:
        needle = signature.lower() if signature.isascii() else signature
        target = haystack_ascii if signature.isascii() else haystack
        if needle in target:
            return ScanResult(
                clean=False,
                engine="heuristic",
                threat=threat,
                detail=f"Threat signature matched: {threat}",
            )

    return ScanResult(clean=True, engine="heuristic", detail="No threats detected.")


def _scan_with_clamav(data: bytes, filename: str) -> ScanResult | None:
    clamscan = shutil.which("clamscan")
    if not clamscan:
        return None
    suffix = os.path.splitext(filename or "upload.bin")[1] or ".bin"
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            handle.write(data)
            temp_path = handle.name
        completed = subprocess.run(
            [clamscan, "--no-summary", "--infected", temp_path],
            capture_output=True,
            text=True,
            timeout=getattr(settings, "ANTIVIRUS_TIMEOUT_SECONDS", 30),
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        logger.warning("ClamAV scan failed: %s", error)
        return None
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    if completed.returncode == 0:
        return ScanResult(clean=True, engine="clamav", detail="ClamAV reported clean.")
    if completed.returncode == 1:
        threat = (completed.stdout or completed.stderr or "Unknown-Threat").strip().splitlines()[-1]
        return ScanResult(clean=False, engine="clamav", threat=threat, detail=threat)
    logger.warning("ClamAV error output: %s", completed.stderr or completed.stdout)
    return None
