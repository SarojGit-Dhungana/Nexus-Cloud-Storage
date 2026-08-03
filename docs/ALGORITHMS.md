# Cloud Based Storage System — Algorithms & Responsibilities

This document lists the main algorithms used in the system and what each one is responsible for.

---

## 1. Upload malware scanning (heuristic + optional ClamAV)

| Item | Detail |
| --- | --- |
| **Where** | `backend/storage/upload_malware_scanner.py` |
| **Modes** | `heuristic` (default), `clamav`, `disabled` (only if allowed) |
| **Responsibility** | Block dangerous uploads **before** files are stored |

**Heuristic algorithm (local, no external install):**

1. Reject blocked executable/script extensions (`.exe`, `.bat`, `.ps1`, …).
2. Reject double-extension tricks (e.g. `invoice.pdf.exe`).
3. Reject Windows PE binaries (file starts with `MZ`).
4. Detect MIME / content mismatches (e.g. HTML bytes saved as `.pdf` or image).
5. Scan file bytes for known malware / web-shell signatures (including the EICAR test string).

**ClamAV algorithm (optional):**

- Runs system `clamscan` on the upload when `ANTIVIRUS_MODE=clamav`.
- If ClamAV is missing or fails, the system falls back to the heuristic scanner.

**Facade:** `UploadMalwareScannerService` picks the engine from settings (OOP strategy pattern).

---

## 2. Content duplicate detection (SHA-256)

| Item | Detail |
| --- | --- |
| **Where** | `FileNode.checksum()` in `backend/storage/models.py` |
| **Algorithm** | **SHA-256** cryptographic hash of file bytes |
| **Responsibility** | Prevent uploading the **same file content** twice in one workspace |

Flow: hash upload → look up active files with the same `checksum_sha256` → reject duplicate content (even if the file name differs).

---

## 3. Share & invitation token hashing (SHA-256)

| Item | Detail |
| --- | --- |
| **Where** | `ShareLink.generate_token` / `Invitation.generate_token` |
| **Algorithm** | Random token + **SHA-256** hash stored in the database |
| **Responsibility** | Keep raw share/invite tokens out of the DB; only the hash is stored |

Public share URLs and invite links use the raw token once; lookup compares `SHA-256(token)`.

---

## 4. Share-link password hashing (PBKDF2 via Django)

| Item | Detail |
| --- | --- |
| **Where** | `ShareLink.set_password` / `check_password` |
| **Algorithm** | Django’s password hasher (typically **PBKDF2-SHA256**) |
| **Responsibility** | Store optional public-link passwords safely; never store plaintext |

User account passwords use the same Django password hashing approach.

---

## 5. Two-factor authentication (TOTP)

| Item | Detail |
| --- | --- |
| **Where** | `backend/accounts/totp.py` (+ `pyotp`) |
| **Algorithm** | **TOTP** (Time-based One-Time Password, RFC 6238) |
| **Responsibility** | Generate/verify 6-digit codes from Google Authenticator–style apps |

Also uses:

- **HMAC compare** (`hmac.compare_digest`) for timing-safe code checks.
- Enrollment **clock-drift** search so a phone with a skewed clock can still enroll.
- Verification window of adjacent 30-second steps after enrollment.

---

## 6. TOTP secret encryption at rest (Fernet)

| Item | Detail |
| --- | --- |
| **Where** | `backend/accounts/security.py` |
| **Algorithm** | **Fernet** (AES-128-CBC + HMAC), key derived from `SECRET_KEY` via **SHA-256** |
| **Responsibility** | Encrypt 2FA secrets in the database so they are not stored as plain text |

---

## 7. AI file summarization (TF-IDF extractive ranking)

| Item | Detail |
| --- | --- |
| **Where** | `backend/assistant/file_analysis/model.py` |
| **Algorithm** | **TF-IDF** + sentence ranking (extractive summarizer) |
| **Responsibility** | Summarize / answer questions about stored files **locally** (no cloud LLM required) |

How it works (simple view):

1. Split the document into sentences.
2. Score each sentence with **TF** (term frequency in the sentence) and **IDF** (how rare the word is across training docs / this document).
3. Rank sentences and pick the top *N* as the summary.
4. For “question about file” prompts, boost sentences that match question terms, then fall back to a summary if needed.

Train with:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py train_file_analyzer
```

Optional: set `AI_PROVIDER` to `ollama` / `groq` for general chat metadata; **file content summaries still use this local TF-IDF model**.

---

## 8. File text extraction (multi-format pipeline)

| Item | Detail |
| --- | --- |
| **Where** | `backend/assistant/file_analysis/extractor.py` |
| **Responsibility** | Turn PDF / DOCX / XLSX / PPTX / text / CSV / JSON into plain text for the summarizer |

PDF path:

1. Native text (PyMuPDF / pypdf).
2. If almost empty → **OCR** (PyMuPDF OCR or RapidOCR) for scanned pages.

Extraction supports **any file size** (all pages / sheets / slides by default). Optional soft cap: `FILE_ANALYSIS_MAX_EXTRACT_CHARS` (0 = unlimited).

---

## 9. Intent detection for AI file requests

| Item | Detail |
| --- | --- |
| **Where** | `backend/assistant/file_analysis/intent.py` |
| **Algorithm** | Rule / regex–based intent parsing (not ML) |
| **Responsibility** | Detect “summarize report.pdf” style prompts and resolve which stored file to analyze |

---

## Quick map

| Goal | Algorithm | Module |
| --- | --- | --- |
| Stop malware uploads | Heuristic signatures (+ optional ClamAV) | `upload_malware_scanner.py` |
| Block duplicate files | SHA-256 content hash | `storage/models.py` |
| Safe share/invite links | SHA-256 token hash | share / invitation models |
| Protect link passwords | PBKDF2 (Django) | `ShareLink` |
| 2FA login codes | TOTP + HMAC | `accounts/totp.py` |
| Hide 2FA secrets | Fernet | `accounts/security.py` |
| Summarize documents | TF-IDF sentence ranking | `file_analysis/model.py` |
| Read PDF/Office text | Format extractors + OCR | `file_analysis/extractor.py` |

---

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) for system structure and flows.
