from rest_framework import serializers
from django.contrib.auth import get_user_model
User = get_user_model()


from .models import Comment

class CommentUserSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "avatar"]

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url


class CommentSerializer(serializers.ModelSerializer):
    user = CommentUserSerializer(read_only=True)
    replies = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Comment
        fields = (
            "id",
            "user",
            "text",
            "parent",
            "replies",
            "created_at",
        )
        read_only_fields = (
            "id",
            "user",
            "created_at",
            "replies",
        )

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("متن کامنت نباید خالی باشد.")
        if len(value) > MAX_COMMENT_LENGTH:
            raise serializers.ValidationError(
                f"متن کامنت نباید بیشتر از {MAX_COMMENT_LENGTH} نویسه باشد."
            )
        return value

    def get_replies(self, obj):
        qs = obj.replies.filter(is_active=True, is_approved=True)
        return CommentSerializer(qs, many=True, context=self.context).data



MAX_COMMENT_LENGTH = 2000

# کامنت فقط می‌تواند زیر این مدل‌ها باشد؛ content_type دلخواه (مثلاً User)
# یعنی ارجاع به آبجکت‌های نامرتبط و افشای/دستکاری داده‌ی دیگران.
ALLOWED_COMMENT_MODELS = {"movie", "series", "episode"}


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = (
            "text",
            "parent",
            "content_type",
            "object_id",
        )

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("متن کامنت نباید خالی باشد.")
        if len(value) > MAX_COMMENT_LENGTH:
            raise serializers.ValidationError(
                f"متن کامنت نباید بیشتر از {MAX_COMMENT_LENGTH} نویسه باشد."
            )
        return value

    def validate_content_type(self, value):
        if value.model not in ALLOWED_COMMENT_MODELS:
            raise serializers.ValidationError("نوع محتوا مجاز نیست.")
        return value

    def validate(self, data):
        # پاسخ (parent) باید متعلق به همان مدیایی باشد که کامنت زیر آن
        # ثبت می‌شود؛ وگرنه می‌شد رشته‌های کامنت را بین مدیاهای مختلف
        # قاطی کرد و ساختار نمایش را به هم ریخت.
        parent = data.get("parent")
        if parent is not None:
            if (
                parent.content_type_id != data["content_type"].id
                or parent.object_id != data["object_id"]
            ):
                raise serializers.ValidationError(
                    {"parent": "کامنت والد متعلق به این مدیا نیست."}
                )
        return data

    def create(self, validated_data):
        request = self.context["request"]
        validated_data["user"] = request.user
        return super().create(validated_data)
