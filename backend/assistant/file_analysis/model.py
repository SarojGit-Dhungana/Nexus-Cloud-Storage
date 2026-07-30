"""
Trainable extractive summarization model (TF-IDF + sentence ranking).

This is NexusStorage's own file-analysis model — no OpenAI/Groq/Ollama.
Train with manage.py train_file_analyzer; weights are saved under models/.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "summarizer.json"
MODEL_VERSION = 1

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(r"[a-z0-9][a-z0-9'_-]{1,}", re.IGNORECASE)
_TOC_LEADERS = re.compile(r"[\.]{3,}|[_\-]{4,}")
_PAGE_NUM = re.compile(r"^\s*\d+\s*$")

# Common English stop words — kept small so domain terms still matter.
STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "to", "for",
    "of", "as", "by", "with", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "this", "that", "these",
    "those", "it", "its", "they", "them", "their", "we", "our", "you", "your",
    "he", "she", "his", "her", "i", "me", "my", "not", "no", "yes", "so", "than",
    "then", "there", "here", "what", "which", "who", "whom", "when", "where",
    "why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
    "some", "such", "only", "own", "same", "too", "very", "just", "about",
    "into", "over", "after", "before", "between", "under", "again", "further",
    "once", "also", "up", "down", "out", "off", "above", "below",
}

BODY_MARKERS = (
    "ABSTRACT",
    "Abstract",
    "1. INTRODUCTION",
    "1 INTRODUCTION",
    "CHAPTER 1",
    "Chapter 1",
    "INTRODUCTION",
    "Introduction",
)


@dataclass
class SummarizerModel:
    """Learned IDF weights + config for extractive summaries."""

    version: int = MODEL_VERSION
    document_count: int = 0
    idf: dict[str, float] = field(default_factory=dict)
    vocabulary_size: int = 0
    trained_on: list[str] = field(default_factory=list)

    def train(self, documents: list[str], labels: list[str] | None = None) -> "SummarizerModel":
        """
        Fit IDF on a corpus of plain-text documents.

        IDF (inverse document frequency) down-weights words that appear in
        almost every file and boosts distinctive terms — that is the "learning".
        """
        docs = [clean_document_text(doc) for doc in documents if doc and doc.strip()]
        docs = [doc for doc in docs if doc]
        if not docs:
            raise ValueError("Need at least one non-empty document to train.")

        df: Counter[str] = Counter()
        for doc in docs:
            unique_terms = set(tokenize(doc))
            df.update(unique_terms)

        n = len(docs)
        self.document_count = n
        self.idf = {
            term: math.log((1 + n) / (1 + count)) + 1.0
            for term, count in df.items()
        }
        self.vocabulary_size = len(self.idf)
        self.trained_on = list(labels or [])[:200]
        self.version = MODEL_VERSION
        return self

    def save(self, path: Path | None = None) -> Path:
        target = path or MODEL_PATH
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2), encoding="utf-8")
        return target

    @classmethod
    def load(cls, path: Path | None = None) -> "SummarizerModel":
        target = path or MODEL_PATH
        if not target.exists():
            return cls()
        data = json.loads(target.read_text(encoding="utf-8"))
        return cls(
            version=int(data.get("version", MODEL_VERSION)),
            document_count=int(data.get("document_count", 0)),
            idf={str(k): float(v) for k, v in (data.get("idf") or {}).items()},
            vocabulary_size=int(data.get("vocabulary_size", 0)),
            trained_on=list(data.get("trained_on") or []),
        )

    @property
    def is_trained(self) -> bool:
        return self.document_count > 0 and bool(self.idf)

    def summarize(self, text: str, max_sentences: int = 5, max_chars: int = 1600) -> str:
        """Pick the most informative sentences using local + trained TF-IDF."""
        cleaned = focus_body(clean_document_text(text))
        sentences = split_sentences(cleaned)
        if not sentences:
            return "No readable text was found in this file."

        if len(sentences) <= max_sentences and len(cleaned) <= max_chars:
            return format_summary_points(sentences)

        local_idf = build_local_idf(sentences)
        scored = []
        for index, sentence in enumerate(sentences):
            if is_low_quality_sentence(sentence):
                continue
            score = self._sentence_score(sentence, local_idf=local_idf)
            # Prefer earlier body sentences (abstract / intro) strongly.
            if index < 3:
                position_boost = 1.45
            elif index < 8:
                position_boost = 1.2
            elif index < 15:
                position_boost = 1.05
            else:
                position_boost = 0.9
            scored.append((score * position_boost, index, sentence))

        if not scored:
            # Fall back to longest cleaned sentences if filters were too aggressive.
            scored = [
                (len(sentence), index, sentence)
                for index, sentence in enumerate(sentences)
                if len(sentence) >= 40
            ][:max_sentences]

        scored.sort(key=lambda item: item[0], reverse=True)
        chosen = sorted(scored[:max_sentences], key=lambda item: item[1])
        points = [normalize_sentence(sentence) for _, _, sentence in chosen]
        summary = format_summary_points(points)
        if len(summary) > max_chars:
            # Keep as many full bullets as fit.
            kept = []
            size = 0
            for point in points:
                piece = f"• {point}"
                if size + len(piece) + 1 > max_chars and kept:
                    break
                kept.append(point)
                size += len(piece) + 1
            summary = format_summary_points(kept)
        return summary or normalize_sentence(sentences[0])

    def answer_question(self, text: str, question: str, max_sentences: int = 3) -> str:
        """
        Lightweight retrieval: rank sentences by overlap with the question
        plus TF-IDF importance (no external LLM).
        """
        cleaned = focus_body(clean_document_text(text))
        sentences = [s for s in split_sentences(cleaned) if not is_low_quality_sentence(s)]
        if not sentences:
            return "No readable text was found in this file."

        q_terms = set(tokenize(question))
        # Drop filename-ish tokens from the question so retrieval focuses on meaning.
        q_terms = {t for t in q_terms if "." not in t and len(t) > 2}
        if not q_terms:
            return self.summarize(text, max_sentences=max_sentences)

        local_idf = build_local_idf(sentences)
        ranked = []
        for index, sentence in enumerate(sentences):
            s_terms = tokenize(sentence)
            if not s_terms:
                continue
            overlap = len(q_terms.intersection(s_terms))
            if overlap == 0:
                continue
            importance = self._sentence_score(sentence, local_idf=local_idf)
            ranked.append((overlap * 2.5 + importance, index, sentence))

        if not ranked:
            return (
                "I could not find a direct answer in the file. Here is a short summary instead:\n\n"
                + self.summarize(text, max_sentences=max_sentences)
            )

        ranked.sort(key=lambda item: item[0], reverse=True)
        chosen = sorted(ranked[:max_sentences], key=lambda item: item[1])
        points = [normalize_sentence(sentence) for _, _, sentence in chosen]
        return format_summary_points(points)

    def keywords(self, text: str, top_k: int = 8) -> list[str]:
        cleaned = focus_body(clean_document_text(text))
        tf = Counter(tokenize(cleaned))
        if not tf:
            return []
        # Prefer document-local rarity mixed with global IDF.
        local_idf = build_local_idf(split_sentences(cleaned)) or {}
        scored = []
        for term, count in tf.items():
            if len(term) < 4:
                continue
            idf = 0.6 * self.idf.get(term, 1.2) + 0.4 * local_idf.get(term, 1.2)
            scored.append((count * idf, term))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [term for _, term in scored[:top_k]]

    def _sentence_score(self, sentence: str, local_idf: dict[str, float] | None = None) -> float:
        terms = tokenize(sentence)
        if not terms:
            return 0.0
        tf = Counter(terms)
        length = len(terms)
        total = 0.0
        for term, count in tf.items():
            tf_weight = count / length
            global_idf = self.idf.get(term, 1.15)
            loc = (local_idf or {}).get(term, 1.15)
            idf = 0.45 * global_idf + 0.55 * loc
            total += tf_weight * idf
        # Prefer informative mid/long sentences.
        if length < 8:
            length_penalty = 0.35
        elif length <= 45:
            length_penalty = 1.0
        elif length <= 70:
            length_penalty = 0.85
        else:
            length_penalty = 0.55
        return total * length_penalty


def tokenize(text: str) -> list[str]:
    words = _WORD_RE.findall(text.lower())
    return [w for w in words if w not in STOP_WORDS and not w.isdigit()]


def clean_document_text(text: str) -> str:
    """Repair PDF extraction noise: soft line breaks, TOC dots, odd quotes."""
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u0000", " ")
    text = text.replace("\ufb01", "fi").replace("\ufb02", "fl")
    text = (
        text.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("�", "'")
    )
    # Fix hyphenated line wraps: "evalu-\nation" -> "evaluation"
    text = re.sub(r"-\n\s*", "", text)

    lines = [line.strip() for line in text.split("\n")]
    paragraphs: list[str] = []
    buffer = ""

    for line in lines:
        if not line:
            if buffer:
                paragraphs.append(buffer.strip())
                buffer = ""
            continue
        if is_junk_line(line):
            continue
        line = _TOC_LEADERS.sub(" ", line)
        line = re.sub(r"\s{2,}", " ", line).strip()
        if not line:
            continue

        if not buffer:
            buffer = line
            continue

        # Soft-wrap: join lines that are clearly mid-sentence.
        if buffer.endswith((".", "!", "?", ":", '"', "'")):
            paragraphs.append(buffer.strip())
            buffer = line
        else:
            buffer = f"{buffer} {line}"

    if buffer:
        paragraphs.append(buffer.strip())

    return "\n\n".join(paragraphs)


def focus_body(text: str) -> str:
    """Skip title-page / approval letters when an abstract or intro exists."""
    if not text:
        return text
    best = -1
    for marker in BODY_MARKERS:
        idx = text.find(marker)
        if idx >= 0 and (best < 0 or idx < best):
            # Prefer ABSTRACT over a late INTRODUCTION if both exist early.
            if marker.lower().startswith("abstract"):
                return text[idx:]
            best = idx
    if best >= 0 and best < len(text) * 0.5:
        return text[best:]
    return text


def is_junk_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if _PAGE_NUM.fullmatch(stripped):
        return True
    if re.fullmatch(r"[.\-_=~•\s]+", stripped):
        return True
    if stripped.count(".") >= 8:
        return True
    if len(stripped) <= 2:
        return True
    lower = stripped.lower()
    if lower in {
        "submitted by:",
        "submitted to",
        "under the supervision of:",
        "letter of approval",
        "supervisor's recommendation",
        "supervisor�s recommendation",
        "table of contents",
        "list of figures",
        "list of tables",
        "acknowledgement",
        "acknowledgment",
        "references",
        "bibliography",
    }:
        return True
    return False


def is_low_quality_sentence(sentence: str) -> bool:
    s = sentence.strip()
    if len(s) < 45:
        return True
    if s.count(".") >= 6:
        return True
    words = tokenize(s)
    if len(words) < 7:
        return True
    # Reject title-case heading crumbs / signature lines.
    if re.fullmatch(r"[A-Z0-9 ,.'\"()\-/&]+", s) and len(s) < 80:
        return True
    if re.search(r"\.{3,}|_{3,}|-{5,}", s):
        return True
    lower = s.lower()
    if lower.startswith(("submitted by", "submitted to", "under the supervision")):
        return True
    # Acknowledgements / dedication fluff is rarely useful in a project summary.
    ack_markers = (
        "acknowledg",
        "thankful",
        "gratitude",
        "without their",
        "i would like to thank",
        "dedication",
        "this report would not have been possible",
    )
    if any(marker in lower for marker in ack_markers):
        return True
    return False


def normalize_sentence(sentence: str) -> str:
    s = re.sub(r"\s+", " ", sentence).strip()
    s = _TOC_LEADERS.sub(" ", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" -•\t")
    # Drop leading section labels glued onto the first abstract sentence.
    s = re.sub(
        r"^(abstract|introduction|chapter\s+\d+|section\s+\d+(\.\d+)*)\s*[:.\-]?\s*",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()
    if s and s[0].islower():
        s = s[0].upper() + s[1:]
    if s and s[-1] not in ".!?":
        s += "."
    return s


def format_summary_points(points: list[str]) -> str:
    cleaned = [normalize_sentence(p) for p in points if p and p.strip()]
    # Deduplicate near-identical lines
    unique: list[str] = []
    seen = set()
    for point in cleaned:
        key = re.sub(r"\W+", "", point.lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(point)
    if not unique:
        return ""
    if len(unique) == 1:
        return unique[0]
    return "\n".join(f"• {point}" for point in unique)


def split_sentences(text: str) -> list[str]:
    if not text.strip():
        return []
    # Split on paragraph boundaries first, then sentence enders.
    chunks: list[str] = []
    for para in re.split(r"\n{2,}", text):
        para = para.strip()
        if not para:
            continue
        parts = [part.strip() for part in _SENTENCE_SPLIT.split(para) if part and part.strip()]
        chunks.extend(parts or [para])

    cleaned = []
    for part in chunks:
        part = re.sub(r"\s+", " ", part).strip()
        if len(part) < 20:
            continue
        if _PAGE_NUM.fullmatch(part):
            continue
        cleaned.append(part)
    return cleaned


def build_local_idf(sentences: list[str]) -> dict[str, float]:
    """IDF computed inside this document (helps single-file summarization)."""
    if not sentences:
        return {}
    df: Counter[str] = Counter()
    for sentence in sentences:
        df.update(set(tokenize(sentence)))
    n = len(sentences)
    return {term: math.log((1 + n) / (1 + count)) + 1.0 for term, count in df.items()}


def merge_idf(models: list[SummarizerModel]) -> SummarizerModel:
    """Combine multiple trained models (used when expanding the corpus)."""
    if not models:
        return SummarizerModel()
    if len(models) == 1:
        return models[0]

    totals: dict[str, float] = defaultdict(float)
    weights: dict[str, float] = defaultdict(float)
    labels: list[str] = []
    total_docs = 0
    for model in models:
        if not model.is_trained:
            continue
        total_docs += model.document_count
        labels.extend(model.trained_on)
        for term, value in model.idf.items():
            totals[term] += value * model.document_count
            weights[term] += model.document_count

    idf = {term: totals[term] / weights[term] for term in totals}
    return SummarizerModel(
        document_count=total_docs,
        idf=idf,
        vocabulary_size=len(idf),
        trained_on=labels[:200],
    )
