from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from storage.services import log_activity
from .models import ChatMessage, Conversation
from .serializers import ChatMessageSerializer, ConversationSerializer, PromptSerializer
from .services import AssistantService


class ConversationViewSet(viewsets.ModelViewSet):
    """
    OOP view class for chat threads.

    Each method is one HTTP action (list, create, send message, ...).
    """
    serializer_class = ConversationSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user).prefetch_related("messages")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=("post",))
    def send(self, request, pk=None):
        conversation = self.get_object()
        serializer = PromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prompt = serializer.validated_data["message"].strip()
        history = list(conversation.messages.all())
        user_message = ChatMessage.objects.create(
            conversation=conversation, role=ChatMessage.Role.USER, content=prompt
        )

        # Use the service class (OOP) instead of a loose function
        assistant = AssistantService(request.user)
        answer, model = assistant.answer(prompt, history)

        assistant_message = ChatMessage.objects.create(
            conversation=conversation,
            role=ChatMessage.Role.ASSISTANT,
            content=answer,
            model=model,
        )
        if conversation.title in ("New conversation", "AI Chat", "New AI chat"):
            conversation.title = prompt[:157] + ("..." if len(prompt) > 157 else "")
        conversation.save(update_fields=("title", "updated_at"))
        log_activity(request, "ai_message", metadata={"conversation_id": str(conversation.id), "model": model})
        return Response(
            {
                "user_message": ChatMessageSerializer(user_message).data,
                "assistant_message": ChatMessageSerializer(assistant_message).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=("post",))
    def clear(self, request, pk=None):
        """Remove all messages but keep the conversation thread."""
        conversation = self.get_object()
        conversation.messages.all().delete()
        conversation.title = "AI Chat"
        conversation.save(update_fields=("title", "updated_at"))
        return Response(ConversationSerializer(conversation).data)
