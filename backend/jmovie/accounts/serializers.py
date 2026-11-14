import logging

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

from genres.models import Genre
from .models import (
    UserList,
    UserListItem,
    MovieUserStatus,
    SeriesUserStatus,
    EpisodeWatchStatus,
)

User = get_user_model()
logger = logging.getLogger(__name__)


# ---------------------------
# User Serializer (Read)
# ---------------------------
class UserSerializer(serializers.ModelSerializer):
    favorite_genres = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Genre.objects.all(),
        required=False
    )

    class Meta:
        model = User
        fields = (
            "id",
            "phone",
            "email",
            "username",
            "avatar",
            "is_vip",
            "is_staff",
            "is_superuser",
            "is_active",
            "favorite_genres",
        )
        # این سریالایزر فقط خواندنی است (در view دیگری برای update
        # استفاده نمی‌شود)، اما برای اطمینان بیشتر و جلوگیری از هر
        # استفاده‌ی اشتباه احتمالی در آینده، فیلدهای حساس را صراحتاً
        # read_only می‌کنیم تا حتی اگر یک‌روزی این سریالایزر برای
        # نوشتن هم استفاده شد، کاربر نتواند خودش را VIP/staff/superuser کند.
        read_only_fields = ("is_vip", "is_staff", "is_superuser", "is_active")


# ---------------------------
# User Update Serializer
# ---------------------------
class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    password2 = serializers.CharField(write_only=True, required=False)
    old_password = serializers.CharField(write_only=True, required=False)

    favorite_genres = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Genre.objects.all(),
        required=False
    )

    class Meta:
        model = User
        fields = (
            "username",
            "avatar",
            "favorite_genres",
            "phone",
            "password",
            "password2",
            "old_password",
        )

    def validate(self, data):
        password = data.get("password")
        password2 = data.get("password2")
        old_password = data.get("old_password")

        if password or password2:
            if not password or not password2:
                raise serializers.ValidationError(
                    {"password": "هر دو فیلد password و password2 الزامی است."}
                )

            if password != password2:
                raise serializers.ValidationError(
                    {"password2": "پسوردها با هم مطابقت ندارند."}
                )

            # قبلاً old_password اصلاً چک نمی‌شد؛ یعنی هرکسی که به هر
            # طریقی (توکن دزدیده‌شده، دستگاه لاگین‌شده و ...) به سشن دسترسی
            # موقت پیدا می‌کرد، می‌توانست بدون دانستن پسورد فعلی، پسورد را
            # عوض کند و مالک واقعی را کامل از حساب بیرون بیندازد.
            if not old_password:
                raise serializers.ValidationError(
                    {"old_password": "برای تغییر پسورد، وارد کردن پسورد فعلی الزامی است."}
                )

            if not self.instance.check_password(old_password):
                raise serializers.ValidationError(
                    {"old_password": "پسورد فعلی صحیح نیست."}
                )

            # قدرت پسورد جدید هم باید مثل Register بررسی شود؛ قبلاً کاربر
            # می‌توانست پسورد خود را به مقدار ضعیفی مثل "123456" تغییر دهد.
            validate_password(password, self.instance)

        return data

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        validated_data.pop("password2", None)
        validated_data.pop("old_password", None)

        genres = validated_data.pop("favorite_genres", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if genres is not None:
            # PrimaryKeyRelatedField(many=True) از قبل ورودی را به لیستی از
            # آبجکت‌های Genre معتبر تبدیل و اعتبارسنجی کرده است (شامل
            # پارس کردن JSON هم می‌شود چون DRF لیست‌ها را در multipart/form
            # و JSON هر دو مدیریت می‌کند). دیگر نیازی به json.loads دستی و
            # قورت دادن خطا با except/pass نیست؛ اگر PK نامعتبر بود، خطا در
            # مرحله‌ی is_valid() سریالایزر گرفته می‌شود، نه اینجا به‌صورت خاموش.
            instance.favorite_genres.set(genres)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


# ---------------------------
# User Register Serializer
# ---------------------------
# ترجمه‌ی پیام‌های اعتبارسنجی رمز عبور جنگو به فارسی برای فرم ثبت‌نام
_PASSWORD_ERROR_FA = (
    ("too short", "رمز عبور خیلی کوتاه است؛ حداقل ۸ نویسه وارد کنید."),
    ("too common", "این رمز عبور خیلی رایج و قابل حدس است؛ رمز دیگری انتخاب کنید."),
    ("entirely numeric", "رمز عبور نمی‌تواند فقط از عدد تشکیل شده باشد."),
    ("too similar", "رمز عبور بیش از حد شبیه نام کاربری یا ایمیل شماست."),
)


def _fa_password_errors(exc):
    messages = []
    for msg in getattr(exc, "messages", [str(exc)]):
        fa = next((fa for key, fa in _PASSWORD_ERROR_FA if key in str(msg)), None)
        messages.append(fa or str(msg))
    return messages


class UserRegisterSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=True)
    password2 = serializers.CharField(write_only=True, required=True)
    # صریح تعریف می‌شوند تا پیام‌های یکتایی/فرمت فارسی باشند، نه پیش‌فرض انگلیسی DRF
    username = serializers.CharField(
        max_length=150,
        error_messages={
            "required": "نام کاربری الزامی است.",
            "blank": "نام کاربری الزامی است.",
            "unique": "این نام کاربری قبلاً ثبت شده است؛ نام دیگری انتخاب کنید یا وارد شوید.",
        },
    )
    email = serializers.EmailField(
        error_messages={
            "required": "ایمیل الزامی است.",
            "blank": "ایمیل الزامی است.",
            "invalid": "ایمیل معتبر نیست.",
            "unique": "این ایمیل قبلاً ثبت شده است؛ اگر حساب دارید وارد شوید.",
        },
    )

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "این نام کاربری قبلاً ثبت شده است؛ نام دیگری انتخاب کنید یا وارد شوید."
            )
        return value

    def validate_email(self, value):
        value = value.strip()
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "این ایمیل قبلاً ثبت شده است؛ اگر حساب دارید وارد شوید."
            )
        return value

    def validate_password(self, value):
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(_fa_password_errors(exc))
        return value

    class Meta:
        model = User
        fields = [
            'id',
            'first_name',
            'last_name',
            'username',
            'password',
            'password2',
            'email',
            'avatar',
            'phone'
        ]
        read_only_fields = ['id']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password2": "پسوردها با هم مطابقت ندارند."})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


# ---------------------------
# User List Item Serializer
# ---------------------------
class UserListItemSerializer(serializers.ModelSerializer):
    content_object = serializers.SerializerMethodField()

    # لیست مقصد از URL nested گرفته می‌شود نه از بدنه‌ی درخواست (به views.py
    # نگاه کنید)، اما این فیلد را هم read_only نگه می‌داریم تا در خروجی
    # قابل مشاهده باشد بدون این‌که کاربر بتواند آن را دستکاری کند.
    user_list = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = UserListItem
        fields = (
            "id",
            "user_list",
            "content_type",
            "object_id",
            "content_object",
            "created_at",
        )

    def validate_content_type(self, value):
        # قبلاً کاربر می‌توانست content_type دلخواهی (مثلاً مدل User) بفرستد
        # و با استفاده از get_content_object باعث افشای اطلاعات آبجکت‌های
        # دیگر (IDOR) شود. اینجا فقط مدل‌های مجاز را می‌پذیریم؛ چک دوم و
        # قطعی هم در models.UserListItem.clean() انجام می‌شود.
        if value.model not in UserListItem.ALLOWED_MODELS:
            raise serializers.ValidationError("نوع محتوا مجاز نیست.")
        return value

    def get_content_object(self, obj):
        return {
            "id": obj.object_id,
            "type": obj.content_type.model,
            "title": str(obj.content_object),
        }


# ---------------------------
# User List Serializer
# ---------------------------
class UserListSerializer(serializers.ModelSerializer):
    items = UserListItemSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = UserList
        fields = (
            "id",
            "title",
            "is_public",
            "items",
            "created_at",
        )


# ---------------------------
# Movie User Status Serializer
# ---------------------------
class MovieUserStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovieUserStatus
        fields = (
            "id",
            "movie",
            "status",
            "created_at",
        )


# ---------------------------
# Series User Status Serializer
# ---------------------------
class SeriesUserStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeriesUserStatus
        fields = (
            "id",
            "series",
            "status",
            "created_at",
        )


# ---------------------------
# Episode Watch Status Serializer
# ---------------------------
class EpisodeWatchStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = EpisodeWatchStatus
        fields = (
            "id",
            "episode",
            "watched_at",
        )