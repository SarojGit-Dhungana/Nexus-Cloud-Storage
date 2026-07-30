from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from .models import DirectMessage, Friendship
from .serializers import (
    AddFriendSerializer,
    ChatUserSerializer,
    DirectMessageSerializer,
    SendMessageSerializer,
)


def _same_org(user, other):
    return bool(
        user.organization_id
        and other.organization_id
        and user.organization_id == other.organization_id
    )


def _friendship(user, other):
    return Friendship.objects.filter(user=user, friend=other).first()


def _are_friends(user, other):
    return Friendship.objects.filter(user=user, friend=other).exists()


def _ensure_friendship(user, other):
    link, _ = Friendship.objects.get_or_create(user=user, friend=other)
    return link


def _visible_messages(user, peer):
    """Return messages visible to `user` for the chat with `peer` (sticky clear)."""
    base = DirectMessage.objects.filter(
        Q(sender=user, receiver=peer) | Q(sender=peer, receiver=user)
    ).select_related("sender", "receiver")
    link = _friendship(user, peer)
    if link and link.cleared_at:
        base = base.filter(created_at__gt=link.cleared_at)
    return base


class FriendListView(APIView):
    """List friends for the current user (hidden chats stay out of this list)."""

    def get(self, request):
        friend_ids = Friendship.objects.filter(user=request.user, hidden=False).values_list(
            "friend_id", flat=True
        )
        friends = User.objects.filter(id__in=friend_ids, is_active=True).order_by("display_name")
        return Response(ChatUserSerializer(friends, many=True).data)


class FriendSearchView(APIView):
    """Search org members to add as friends (Django-ChatApp search)."""

    def get(self, request):
        if not request.user.organization_id:
            return Response([])
        query = (request.query_params.get("q") or "").strip()
        friend_ids = set(
            Friendship.objects.filter(user=request.user).values_list("friend_id", flat=True)
        )
        users = (
            User.objects.filter(organization_id=request.user.organization_id, is_active=True)
            .exclude(id=request.user.id)
            .exclude(role=User.Role.SUPER_ADMIN)
            .order_by("display_name")
        )
        if query:
            users = users.filter(Q(display_name__icontains=query) | Q(email__icontains=query))
        payload = []
        for user in users[:25]:
            data = ChatUserSerializer(user).data
            data["is_friend"] = user.id in friend_ids
            payload.append(data)
        return Response(payload)


class AddFriendView(APIView):
    """Add a mutual friendship; reopening also unhides a previously deleted chat for me."""

    def post(self, request):
        serializer = AddFriendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            other = User.objects.get(id=serializer.validated_data["user_id"], is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if other.id == request.user.id:
            return Response({"detail": "You cannot add yourself."}, status=status.HTTP_400_BAD_REQUEST)
        if not _same_org(request.user, other):
            return Response(
                {"detail": "You can only chat with people in your organization."},
                status=status.HTTP_403_FORBIDDEN,
            )
        mine = _ensure_friendship(request.user, other)
        mine.hidden = False
        mine.save(update_fields=("hidden", "updated_at"))
        _ensure_friendship(other, request.user)
        return Response(ChatUserSerializer(other).data, status=status.HTTP_201_CREATED)


class ConversationMessagesView(APIView):
    """
    GET history / unread (respects per-user cleared_at).
    POST send a message.
    DELETE clear chat for me only (sticky — other user keeps their history).
    """

    def get(self, request):
        peer_id = request.query_params.get("with")
        if not peer_id:
            return Response({"detail": "Query param 'with' is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            peer = User.objects.get(id=peer_id, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _same_org(request.user, peer) or not _are_friends(request.user, peer):
            return Response({"detail": "You can only message friends."}, status=status.HTTP_403_FORBIDDEN)

        # Opening the thread unhides it for me without touching the friend.
        link = _ensure_friendship(request.user, peer)
        if link.hidden:
            link.hidden = False
            link.save(update_fields=("hidden", "updated_at"))

        unread_only = request.query_params.get("unread") == "1"
        base = _visible_messages(request.user, peer)
        if unread_only:
            messages = list(base.filter(sender=peer, receiver=request.user, seen=False))
            DirectMessage.objects.filter(id__in=[m.id for m in messages]).update(seen=True)
            return Response(DirectMessageSerializer(messages, many=True).data)

        return Response(DirectMessageSerializer(base, many=True).data)

    def post(self, request):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            peer = User.objects.get(id=serializer.validated_data["receiver_id"], is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _same_org(request.user, peer) or not _are_friends(request.user, peer):
            return Response({"detail": "You can only message friends."}, status=status.HTTP_403_FORBIDDEN)

        message = DirectMessage.objects.create(
            sender=request.user,
            receiver=peer,
            body=serializer.validated_data["body"],
        )
        # Keep chat sticky/visible for both sides when a new message arrives.
        for owner, other in ((request.user, peer), (peer, request.user)):
            link = _ensure_friendship(owner, other)
            changed = []
            if link.hidden:
                link.hidden = False
                changed.append("hidden")
            if changed:
                changed.append("updated_at")
                link.save(update_fields=changed)
            else:
                Friendship.objects.filter(pk=link.pk).update(updated_at=timezone.now())

        return Response(DirectMessageSerializer(message).data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        """Clear chat for me only — messages stay for the other user."""
        peer_id = request.query_params.get("with")
        if not peer_id:
            return Response({"detail": "Query param 'with' is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            peer = User.objects.get(id=peer_id, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _same_org(request.user, peer) or not _are_friends(request.user, peer):
            return Response({"detail": "You can only manage chats with friends."}, status=status.HTTP_403_FORBIDDEN)

        link = _ensure_friendship(request.user, peer)
        link.cleared_at = timezone.now()
        link.hidden = False
        link.save(update_fields=("cleared_at", "hidden", "updated_at"))
        return Response({"cleared": True}, status=status.HTTP_200_OK)


class RemoveFriendView(APIView):
    """
    Delete chat for me only (sticky).
    Hides the chat on my side; friend keeps friendship + full history.
    """

    def delete(self, request, user_id):
        try:
            other = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        link = _friendship(request.user, other)
        if not link:
            return Response(status=status.HTTP_204_NO_CONTENT)
        link.hidden = True
        link.cleared_at = timezone.now()
        link.save(update_fields=("hidden", "cleared_at", "updated_at"))
        return Response(status=status.HTTP_204_NO_CONTENT)
