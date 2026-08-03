"""
AI assistant service.

Beginner tip:
- AssistantService is one class that owns "build context" + "answer question".
- Views create the class, then call .answer(...) — easy to read and test.
- File content questions are handled by the local trainable summarizer first.
"""

import json

import httpx
from django.conf import settings
from django.db.models import Q, Sum

from storage.models import FileNode, ShareGrant

from .file_analysis import FileAnalysisService


class AssistantService:
    """
    Builds a safe metadata summary for the signed-in user,
    then answers their chat prompt from that summary.
    """

    SYSTEM_PROMPT = """You are Cloud Based Storage System Assistant, a privacy-conscious cloud-storage copilot.
Answer from the supplied account context. File contents are analyzed by a separate local model
when the user asks to summarize or analyze a specific file — do not invent file contents.
Help users locate files, understand storage usage, review sharing, and improve organization.
Do not reveal another organization's data. Do not invent counts or filenames.
For destructive actions, explain the steps but never claim the action already happened.
Keep answers concise and practical."""

    def __init__(self, user):
        self.user = user

    def build_context(self):
        """Collect only metadata the current user is allowed to see."""
        visible = (
            FileNode.objects.filter(organization=self.user.organization, deleted_at__isnull=True)
            .filter(Q(owner=self.user) | Q(share_grants__recipient=self.user))
            .select_related("owner")
            .distinct()
        )
        owned_files = visible.filter(owner=self.user, node_type="file")
        largest = owned_files.order_by("-size_bytes")[:20]
        recent = visible.order_by("-updated_at")[:20]

        return {
            "user": {"name": self.user.display_name, "role": self.user.role},
            "storage": {
                "used_bytes": owned_files.aggregate(total=Sum("size_bytes"))["total"] or 0,
                "quota_bytes": self.user.effective_storage_quota,
                "file_count": owned_files.count(),
                "folder_count": visible.filter(owner=self.user, node_type="folder").count(),
                "shared_with_user": ShareGrant.objects.filter(recipient=self.user).count(),
                "shared_by_user": ShareGrant.objects.filter(created_by=self.user).count(),
            },
            "largest_files": [
                {"name": node.name, "size_bytes": node.size_bytes, "mime_type": node.mime_type}
                for node in largest
            ],
            "recent_items": [
                {
                    "name": node.name,
                    "kind": node.category,
                    "size_bytes": node.size_bytes,
                    "owner": node.owner.display_name,
                    "updated_at": node.updated_at.isoformat(),
                }
                for node in recent
            ],
            "file_analysis": FileAnalysisService.model_status(),
        }

    def _deterministic_answer(self, message, context):
        """Simple keyword replies when the AI provider is off or fails."""
        lower = message.lower()
        storage = context["storage"]

        if any(term in lower for term in ("large", "largest", "free space", "storage")):
            files = context["largest_files"][:5]
            names = ", ".join(f'{item["name"]} ({item["size_bytes"] / 1024**2:.1f} MB)' for item in files)
            used = storage["used_bytes"] / 1024**3
            quota = storage["quota_bytes"] / 1024**3
            return f"You use {used:.2f} GB of {quota:.2f} GB. Largest files: {names or 'none'}."

        if "share" in lower:
            return (
                f"You have {storage['shared_with_user']} items shared with you and "
                f"{storage['shared_by_user']} direct shares created by you."
            )

        if any(term in lower for term in ("find", "recent", "file")):
            names = ", ".join(item["name"] for item in context["recent_items"][:10])
            return f"Your recent accessible items are: {names or 'none'}."

        analysis = context.get("file_analysis") or {}
        trained = "ready" if analysis.get("trained") else "not trained yet"
        return (
            "I can report storage usage, list large or recent files, and summarize shared items. "
            f"I can also summarize PDF and document contents with the local file-analysis model ({trained}). "
            'Try: summarize report.pdf'
        )

    def answer(self, prompt, history):
        """
        Return (answer_text, model_name).

        1) Local file analysis for summarize/analyze-file prompts
        2) Configured AI provider for open-ended metadata chat
        3) Keyword fallback
        """
        file_hit = FileAnalysisService(self.user).maybe_answer(prompt)
        if file_hit is not None:
            return file_hit

        context = self.build_context()

        if settings.AI_PROVIDER == "disabled":
            return self._deterministic_answer(prompt, context), "metadata-assistant"

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "system", "content": "Account metadata:\n" + json.dumps(context, ensure_ascii=False)},
        ]
        messages.extend(
            {"role": item.role, "content": item.content}
            for item in history[-20:]
            if item.role in ("user", "assistant")
        )
        messages.append({"role": "user", "content": prompt})

        try:
            response = httpx.post(
                f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.AI_API_KEY}", "Content-Type": "application/json"},
                json={"model": settings.AI_MODEL, "messages": messages, "temperature": 0.2},
                timeout=settings.AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            answer = response.json()["choices"][0]["message"]["content"].strip()
            return answer, settings.AI_MODEL
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
            return self._deterministic_answer(prompt, context), "metadata-assistant-fallback"


# Thin wrappers — keep older imports working for beginners
def build_account_context(user):
    return AssistantService(user).build_context()


def generate_answer(user, prompt, history):
    return AssistantService(user).answer(prompt, history)
