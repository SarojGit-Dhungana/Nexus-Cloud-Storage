from django.contrib import admin

from .models import ActivityLog, FileNode, ShareGrant, ShareLink

admin.site.register(FileNode)
admin.site.register(ShareGrant)
admin.site.register(ShareLink)
admin.site.register(ActivityLog)
