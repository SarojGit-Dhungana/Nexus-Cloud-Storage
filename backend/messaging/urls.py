from django.urls import path

from .views import AddFriendView, ConversationMessagesView, FriendListView, FriendSearchView, RemoveFriendView

urlpatterns = [
    path("friends/", FriendListView.as_view(), name="messaging-friends"),
    path("friends/add/", AddFriendView.as_view(), name="messaging-add-friend"),
    path("friends/<uuid:user_id>/", RemoveFriendView.as_view(), name="messaging-remove-friend"),
    path("users/", FriendSearchView.as_view(), name="messaging-search"),
    path("messages/", ConversationMessagesView.as_view(), name="messaging-messages"),
]
