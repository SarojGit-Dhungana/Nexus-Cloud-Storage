from django.contrib import admin

from .models import DirectMessage, Friendship

admin.site.register(Friendship)
admin.site.register(DirectMessage)
