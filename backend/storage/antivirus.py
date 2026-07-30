"""Compatibility shim — prefer upload_malware_scanner classes."""
from .upload_malware_scanner import (  # noqa: F401
    AntivirusScanResult,
    BaseMalwareScanner,
    ClamAvMalwareScanner,
    HeuristicMalwareScanner,
    ScanResult,
    UploadMalwareScannerService,
    run_antivirus_by_configured_mode,
    run_clamav_malware_scan,
    run_heuristic_malware_scan,
    scan_bytes,
    scan_upload_for_malware,
    scan_uploaded_file,
)
