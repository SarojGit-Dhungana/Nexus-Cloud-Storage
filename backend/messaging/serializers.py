from rest_framework import serializers

from accounts.models import User
from .models import DirectMessage, Friendship


class ChatUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = User
        fields = ("id", "name", "email", "avatar_url", "role")


class DirectMessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.UUIDField(source="sender.id", read_only=True)
    receiver_id = serializers.UUIDField(source="receiver.id", read_only=True)
    sender_name = serializers.CharField(source="sender.display_name", read_only=True)
    receiver_name = serializers.CharField(source="receiver.display_name", read_only=True)
    time = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = DirectMessage
        fields = (
            "id",
            "sender_id",
            "receiver_id",
            "sender_name",
            "receiver_name",
            "body",
            "seen",
            "time",
        )
        read_only_fields = fields


class SendMessageSerializer(serializers.Serializer):
    receiver_id = serializers.UUIDField()
    body = serializers.CharField(max_length=4000)

    def validate_body(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("Message cannot be empty.")
        return text


class AddFriendSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
