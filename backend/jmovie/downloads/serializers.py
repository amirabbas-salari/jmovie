from rest_framework import serializers

from .models import Download


class DownloadSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    def get_url(self, obj):
        request = self.context.get("request")

        # قبلاً فقط «لاگین بودن» چک می‌شد و هر کاربر رایگان در پاسخ
        # جزئیات فیلم/سریال، URL دانلودهای VIP (is_vip=True) را هم می‌دید
        # — دور زدن کامل سیستم VIP. حالا: مهمان هیچ لینکی نمی‌بیند،
        # دانلود VIP فقط برای کاربر VIP و دانلود عادی برای هر کاربر
        # واردشده نمایش داده می‌شود.
        if not request or not request.user.is_authenticated:
            return None
        if obj.is_vip and not getattr(request.user, "is_vip", False):
            return None
        return obj.url

    class Meta:
        model = Download
        fields = "__all__"
