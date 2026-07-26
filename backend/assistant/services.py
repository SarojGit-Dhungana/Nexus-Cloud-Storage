import json

import httpx
from django.conf import settings
from django.db.models import Q, Sum

from storage.models import FileNode, ShareGrant


SYSTEM_PROMPT = """You are NexusStorage Assistant, a privacy-conscious cloud-storage copilot.
Answer only from the supplied account context. Never claim to have read file contents: only metadata is available.
Help users locate files, understand storage usage, review sharing, and improve organization.
Do not reveal another organization's data. Do not invent counts or filenames.
For destructive actions, explain the steps but never claim the action already happened.
Keep answers concise and practical."""


def build_account_context(user):
    visible = (
        FileNode.objects.filter(organization=user.organization, deleted_at__isnull=True)
        .filter(Q(owner=user) | Q(share_grants__recipient=user))
        .select_related("owner")
        .distinct()
    )
    owned_files = visible.filter(owner=user, node_type="file")
    largest = owned_files.order_by("-size_bytes")[:20]
    recent = visible.order_by("-updated_at")[:20]
    return {
        "user": {"name": user.display_name, "role": user.role},
        "storage": {
            "used_bytes": owned_files.aggregate(total=Sum("size_bytes"))["total"] or 0,
            "quota_bytes": user.effective_storage_quota,
            "file_count": owned_files.count(),
            "folder_count": visible.filter(owner=user, node_type="folder").count(),
            "shared_with_user": ShareGrant.objects.filter(recipient=user).count(),
            "shared_by_user": ShareGrant.objects.filter(created_by=user).count(),
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
    }


def deterministic_answer(message, context):
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
    return (
        "I can report storage usage, list large or recent files, and summarize shared items. "
        "Configure Ollama or Groq to enable open-ended AI answers."
    )


def generate_answer(user, prompt, history):
    context = build_account_context(user)
    if settings.AI_PROVIDER == "disabled":
        return deterministic_answer(prompt, context), "metadata-assistant"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
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
        return deterministic_answer(prompt, context), "metadata-assistant-fallback"
