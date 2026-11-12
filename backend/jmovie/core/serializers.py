from rest_framework import serializers

from .models import SupportMessage


class SupportMessageCreateSerializer(serializers.ModelSerializer):
    # فیلد تله‌ی اسپم (honeypot): کاربر واقعی هرگز آن را نمی‌بیند/پر نمی‌کند؛
    # در ویو چک می‌شود و اگر پر شده باشد پیام بی‌سروصدا دور انداخته می‌شود.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = SupportMessage
        fields = ["category", "name", "email", "subject", "message", "meta", "website"]

    def validate_message(self, value):
        value = (value or "").strip()
        if len(value) < 5:
            raise serializers.ValidationError("متن پیام خیلی کوتاه است.")
        if len(value) > 5000:
            raise serializers.ValidationError("متن پیام بیش از حد طولانی است.")
        return value

    def validate_meta(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("meta باید آبجکت باشد.")
        # فقط مقادیر ساده و کوتاه نگه داشته می‌شوند
        return {str(k)[:50]: str(v)[:300] for k, v in value.items()}
