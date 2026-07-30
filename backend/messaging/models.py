import uuid

from django.conf import settings
from django.db import models


class Friendship(models.Model):
    """
    Directed friendship edge (user → friend).
    Clear/delete are sticky per user and never wipe the other person's chat.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friendships"
    )
    friend = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friend_of"
    )
    # Messages at/before this timestamp are hidden only for `user`.
    cleared_at = models.DateTimeField(null=True, blank=True)
    # Soft-hide this chat from `user`'s list without affecting the friend.
    hidden = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("user", "friend"), name="unique_friendship_pair"),
        ]
        ordering = ("-updated_at", "-created_at")

    def __str__(self):
        return f"{self.user_id} → {self.friend_id}"


class DirectMessage(models.Model):
    """One-to-one chat message between friends (Django-ChatApp Messages)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_messages"
    )
    body = models.TextField()
    seen = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.sender_id} → {self.receiver_id}: {self.body[:40]}"
