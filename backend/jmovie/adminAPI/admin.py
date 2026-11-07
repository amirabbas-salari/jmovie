from django.contrib import admin

from .models import AdminAuditLog


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "username", "action", "model_label", "object_id", "object_repr")
    list_filter = ("action", "model_label")
    search_fields = ("username", "object_repr")
    readonly_fields = [f.name for f in AdminAuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
