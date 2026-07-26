from rest_framework import serializers

from .models import ChatMessage, Conversation


class ChatMessageSerializer(serializers.ModelSerializer):
    from_user = serializers.SerializerMethodField()
    text = serializers.CharField(source="content")
    time = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ChatMessage
        fields = ("id", "role", "from_user", "text", "time", "model", "metadata")

    def get_from_user(self, obj):
        return obj.role == ChatMessage.Role.USER


class ConversationSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ("id", "title", "created_at", "updated_at", "messages")
        read_only_fields = ("id", "created_at", "updated_at", "messages")


class PromptSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=8000)
