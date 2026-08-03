"""
Orchestrates file lookup → text extraction → local summarizer model.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from django.conf import settings

from .extractor import extract_from_storage_file, is_analyzable, supported_types_label
from .intent import detect_intent, resolve_files
from .model import MODEL_PATH, SummarizerModel

logger = logging.getLogger(__name__)

CANNOT_PROCESS = "Sorry, I can't process this task."

# Tasks the local extractive model cannot perform on a file.
UNSUPPORTED_TASK_RE = re.compile(
    r"\b("
    r"translate|translation|rewrite|paraphrase|proofread|grammar|"
    r"convert\s+to|export\s+as|edit\s+the\s+file|delete\s+the\s+file|"
    r"rename|move\s+the\s+file|download|email|send\s+to|upload|"
    r"generate\s+code|write\s+code|create\s+a\s+presentation|"
    r"make\s+a\s+powerpoint|draw|image\s+from|voice|audio|video|"
    r"encrypt|decrypt|compress|zip\s+it|password\s+protect"
    r")\b",
    re.IGNORECASE,
)


class FileAnalysisService:
    """
    Cloud Based Storage System's built-in file analyzer.

    Answers any question about a stored file using the trained local model.
    If the task cannot be handled, returns a clear apology message.
    """

    MODEL_NAME = "nexus-file-analyzer"

    def __init__(self, user):
        self.user = user
        self.model = SummarizerModel.load()

    def maybe_answer(self, prompt: str):
        """
        If the prompt is about a file, return (text, model_name).
        On failure return the standard cannot-process message.
        Otherwise return None so the metadata assistant can handle it.
        """
        if not getattr(settings, "FILE_ANALYSIS_ENABLED", True):
            return None

        intent = detect_intent(prompt)
        if not intent.wants_analysis:
            return None

        try:
            return self._answer_file_prompt(intent)
        except Exception:
            logger.exception("File analysis failed for prompt=%r", prompt)
            return CANNOT_PROCESS, self.MODEL_NAME

    def _answer_file_prompt(self, intent):
        if UNSUPPORTED_TASK_RE.search(intent.question or ""):
            return CANNOT_PROCESS, self.MODEL_NAME

        if not self.model.is_trained:
            return CANNOT_PROCESS, self.MODEL_NAME

        nodes = resolve_files(self.user, intent.filename_hint)
        if not nodes:
            if intent.filename_hint:
                return (
                    f'Sorry, I can\'t process this task — I could not find '
                    f'"{intent.filename_hint}" in your accessible files.',
                    self.MODEL_NAME,
                )
            return (
                f"{CANNOT_PROCESS} Please include the filename, for example: "
                "summarize report.pdf",
                self.MODEL_NAME,
            )

        if len(nodes) > 1 and intent.filename_hint and nodes[0].name.lower() != intent.filename_hint.lower():
            names = ", ".join(node.name for node in nodes[:5])
            return (
                f"{CANNOT_PROCESS} Multiple files matched ({names}). "
                "Please use the exact filename.",
                self.MODEL_NAME,
            )

        node = nodes[0]
        if not is_analyzable(node.name, node.mime_type):
            return (
                f'{CANNOT_PROCESS} "{node.name}" is not a supported type '
                f"(supported: {supported_types_label()}).",
                self.MODEL_NAME,
            )

        if not node.content:
            return CANNOT_PROCESS, self.MODEL_NAME

        try:
            text = extract_from_storage_file(node.content, filename=node.name, mime_type=node.mime_type)
        except Exception:
            logger.exception("Failed extracting %s", node.name)
            return CANNOT_PROCESS, self.MODEL_NAME

        if not text or not text.strip():
            return CANNOT_PROCESS, self.MODEL_NAME

        lowered = text.strip().lower()
        if lowered.startswith("legacy .") or (
            "re-save" in lowered and "try again" in lowered and len(text) < 280
        ):
            return CANNOT_PROCESS, self.MODEL_NAME

        max_sentences = getattr(settings, "FILE_ANALYSIS_MAX_SENTENCES", 7)
        kind = _file_kind(node.name, node.mime_type)

        try:
            if intent.mode == "question":
                body = self.model.answer_question(text, intent.question, max_sentences=max_sentences)
                # If retrieval found nothing useful, treat as unprocessable.
                if not body or not str(body).strip():
                    return CANNOT_PROCESS, self.MODEL_NAME
                if "could not find a direct answer" in str(body).lower():
                    # Still give the fallback summary when possible; only fail if empty.
                    summary = self.model.summarize(text, max_sentences=max_sentences)
                    if not summary or not str(summary).strip():
                        return CANNOT_PROCESS, self.MODEL_NAME
                    body = summary
                    section = "Most important points"
                    header = f'From "{node.name}" ({kind}):'
                else:
                    header = f'From "{node.name}" ({kind}):'
                    section = "Answer"
            else:
                body = self.model.summarize(text, max_sentences=max_sentences)
                if not body or not str(body).strip() or body == "No readable text was found in this file.":
                    return CANNOT_PROCESS, self.MODEL_NAME
                header = f'Summary of "{node.name}" ({kind}):'
                section = "Most important points"
        except Exception:
            logger.exception("Summarizer failed for %s", node.name)
            return CANNOT_PROCESS, self.MODEL_NAME

        keywords = self.model.keywords(text, top_k=10)
        facts = _file_facts(node, text, kind)

        parts = [header, "", f"{section}:", body]
        if keywords:
            parts.extend(["", "Related topics: " + ", ".join(keywords)])
        if facts:
            parts.extend(["", "About this file:", *[f"• {item}" for item in facts]])

        return "\n".join(parts), self.MODEL_NAME

    @staticmethod
    def model_status() -> dict:
        model = SummarizerModel.load()
        return {
            "path": str(MODEL_PATH),
            "trained": model.is_trained,
            "document_count": model.document_count,
            "vocabulary_size": model.vocabulary_size,
            "trained_on": model.trained_on[:20],
            "supported": supported_types_label(),
        }


def _file_kind(filename: str, mime_type: str = "") -> str:
    ext = Path(filename or "").suffix.lower()
    mime = (mime_type or "").lower()
    if ext == ".pdf" or mime == "application/pdf":
        return "PDF"
    if ext == ".docx" or "wordprocessingml" in mime:
        return "Word"
    if ext in {".xlsx", ".xlsm", ".xls"} or "spreadsheet" in mime or "ms-excel" in mime:
        return "Excel"
    if ext in {".pptx", ".ppt"} or "presentation" in mime or "ms-powerpoint" in mime:
        return "PowerPoint"
    if ext in {".csv", ".tsv"}:
        return "Spreadsheet text"
    if ext in {".txt", ".md", ".markdown", ".rtf"}:
        return "Text document"
    if ext in {".json", ".jsonl"}:
        return "JSON"
    return "Document"


def _file_facts(node, text: str, kind: str) -> list[str]:
    facts: list[str] = []
    size = int(getattr(node, "size_bytes", 0) or 0)
    if size:
        if size >= 1024**2:
            facts.append(f"Size: {size / 1024**2:.1f} MB")
        else:
            facts.append(f"Size: {max(size / 1024, 0.1):.1f} KB")
    facts.append(f"Type: {kind}")

    lower = text.lower()
    if kind == "Excel" or kind == "Spreadsheet text":
        sheets = len([line for line in text.splitlines() if line.startswith("Sheet:")])
        if sheets:
            facts.append(f"Sheets detected: {sheets}")
        rows = sum(1 for line in text.splitlines() if " | " in line)
        if rows:
            facts.append(f"Data rows extracted: {rows}")
    elif kind == "PowerPoint":
        slides = len([line for line in text.splitlines() if line.startswith("Slide ")])
        if slides:
            facts.append(f"Slides extracted: {slides}")
    else:
        words = len(text.split())
        if words:
            facts.append(f"Readable words extracted: {words}")

    if "fraud" in lower:
        facts.append("Mentions fraud / risk content")
    if any(token in lower for token in ("budget", "revenue", "invoice", "salary", "profit")):
        facts.append("Contains financial terms")
    if any(token in lower for token in ("abstract", "introduction", "methodology", "conclusion")):
        facts.append("Looks like an academic / project report")
    return facts[:6]
