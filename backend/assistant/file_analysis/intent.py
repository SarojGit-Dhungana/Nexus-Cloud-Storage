"""
Detect file-analysis intents and resolve matching stored files.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from django.db.models import Q

from storage.models import FileNode

from .extractor import is_analyzable


ANALYSIS_VERBS = (
    "summarize",
    "summarise",
    "summary",
    "analyze",
    "analyse",
    "analysis",
    "explain",
    "review",
    "describe",
    "overview",
    "outline",
    "what is in",
    "what's in",
    "whats in",
    "what does",
    "tell me about",
    "know about",
    "know more",
    "info about",
    "information about",
    "details about",
    "about the",
    "regarding",
    "related to",
    "based on",
    "from the file",
    "according to",
    "open",
    "show me",
    "look at",
    "read",
    "contents of",
    "content of",
    "key points",
    "main points",
    "important",
    "extract",
)

# Filenames like report.pdf, notes_v2.docx, budget.xlsx, deck.pptx
_FILE_EXTS = (
    r"pdf|txt|md|markdown|docx|doc|xlsx|xlsm|xls|pptx|ppt|csv|tsv|"
    r"json|jsonl|log|py|js|ts|tsx|jsx|html|css|xml|ya?ml|rtf"
)
FILENAME_RE = re.compile(
    rf"""(?:["'](?P<quoted>[^"']+\.(?:{_FILE_EXTS}))["'])"""
    rf"""|(?P<name>\b[\w.\-]+\.(?:{_FILE_EXTS})\b)""",
    re.IGNORECASE,
)

# Catch mentions of other files so we can reply instead of falling back to metadata help text
ANY_FILE_RE = re.compile(
    rf"""\b(?P<any>[\w.\-]+\.(?:{_FILE_EXTS}|svg|png|jpg|jpeg|gif|webp|zip|mp4|mp3))\b""",
    re.IGNORECASE,
)

# Soft match: "about prospectus2025" without requiring the extension in the prompt
BARE_NAME_RE = re.compile(
    r"""\b(?:about|summarize|summarise|analyze|analyse|open|read|review|explain)\s+(?:the\s+)?(?P<bare>[\w.\-]{3,})\b""",
    re.IGNORECASE,
)


@dataclass
class AnalysisIntent:
    wants_analysis: bool
    question: str
    filename_hint: str = ""
    mode: str = "summary"  # summary | question


def detect_intent(prompt: str) -> AnalysisIntent:
    text = (prompt or "").strip()
    lower = text.lower()
    filename_match = FILENAME_RE.search(text)
    filename_hint = ""
    if filename_match:
        filename_hint = (filename_match.group("quoted") or filename_match.group("name") or "").strip()
    elif bare := BARE_NAME_RE.search(text):
        candidate = bare.group("bare").strip()
        # Ignore generic words that are not filenames
        if candidate.lower() not in {"file", "pdf", "document", "doc", "it", "this", "that", "storage"}:
            filename_hint = candidate
    elif any_file := ANY_FILE_RE.search(text):
        # Unsupported or binary types still count as a file ask (analyzer explains support).
        filename_hint = any_file.group("any").strip()

    verb_hit = any(verb in lower for verb in ANALYSIS_VERBS)
    about_hit = bool(re.search(r"\b(about|regarding|concerning)\b", lower))
    question_words = ("what", "how", "why", "when", "where", "who", "which", "does", "is ")
    is_question = "?" in text or any(lower.startswith(q) for q in question_words)

    # Any document filename in the prompt → run the local file model on its contents.
    wants = bool(filename_hint)
    if not wants and verb_hit and any(
        token in lower for token in ("file", "pdf", "document", "doc", "excel", "sheet", "pptx", "powerpoint", "word")
    ):
        wants = True
    if not wants and about_hit and any(
        token in lower for token in ("file", "pdf", "document", "doc", "excel", "sheet", "pptx", "powerpoint", "word")
    ):
        wants = True

    explicit_summary = any(
        verb in lower for verb in ("summarize", "summarise", "summary", "overview", "outline", "key points")
    )
    # "I want to know about X.pdf" → summarize contents.
    # Only use question mode for clear interrogatives (what/how/why… or ?).
    mode = "question" if is_question and not explicit_summary else "summary"

    return AnalysisIntent(
        wants_analysis=wants,
        question=text,
        filename_hint=filename_hint,
        mode=mode,
    )


def resolve_files(user, filename_hint: str = "", limit: int = 5):
    """
    Find analyzable files the user may access (owned or shared).
    Prefer exact / contains match on the hinted name.
    """
    visible = (
        FileNode.objects.filter(
            organization=user.organization,
            deleted_at__isnull=True,
            node_type=FileNode.NodeType.FILE,
        )
        .filter(Q(owner=user) | Q(share_grants__recipient=user))
        .distinct()
    )

    if filename_hint:
        hint = filename_hint.strip()
        exact = visible.filter(name__iexact=hint)
        if exact.exists():
            return list(exact[:limit])
        contains = visible.filter(name__icontains=hint)
        if contains.exists():
            return list(contains.order_by("-updated_at")[:limit])
        # Try stem without extension (propspectus2025.pdf → propspectus2025)
        stem = hint.rsplit(".", 1)[0].strip() if "." in hint else hint
        if stem and len(stem) >= 3:
            stem_hits = visible.filter(name__icontains=stem)
            if stem_hits.exists():
                return list(stem_hits.order_by("-updated_at")[:limit])
        # Hint was given but nothing matched — do not guess another file.
        return []

    # No hint: return recent analyzable files so the assistant can suggest them.
    recent = list(visible.order_by("-updated_at")[:40])
    return [node for node in recent if is_analyzable(node.name, node.mime_type)][:limit]
