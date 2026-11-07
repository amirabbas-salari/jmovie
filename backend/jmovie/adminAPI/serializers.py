from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.auth.password_validation import validate_password
from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers

from collection.models import Collection, CollectionItem
from comments.models import Comment
from downloads.models import Download
from genres.models import Genre
from movies.models import Movie, MovieCast, MovieGalleryImage
from people.models import Person
from series.models import Episode, Season, Series, SeriesCast, SeriesGalleryImage

from .models import AdminAuditLog

User = get_user_model()

GENRE_FIELDS = ["id", "name", "slug"]


def _set_genres(instance, genres):
    if genres is not None:
        instance.genres.set(genres)


# ---------------------------------------------------------------------------
# Genres
# ---------------------------------------------------------------------------
class AdminGenreSerializer(serializers.ModelSerializer):
    movies_count = serializers.IntegerField(read_only=True, required=False)
    series_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Genre
        fields = ["id", "name", "slug", "description", "is_active", "tmdb_id",
                  "movies_count", "series_count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Cast & Gallery (nested, used inside movie/series detail)
# ---------------------------------------------------------------------------
class AdminCastWriteSerializer(serializers.Serializer):
    """آیتم عوامل برای نوشتن: {person: id, role, character_name}"""
    person = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all())
    role = serializers.ChoiceField(choices=["actor", "director", "writer"], default="actor")
    character_name = serializers.CharField(required=False, allow_blank=True, default="")


class AdminCastReadSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    person = serializers.SerializerMethodField()
    role = serializers.CharField()
    character_name = serializers.CharField()

    def get_person(self, obj):
        p = obj.person
        return {"id": p.id, "name": p.name, "slug": p.slug,
                "profile_image_url": p.profile_image_url}


class AdminGalleryWriteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    image_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    caption = serializers.CharField(required=False, allow_blank=True, default="")
    order = serializers.IntegerField(required=False, default=0)


class AdminGalleryReadSerializer(serializers.ModelSerializer):
    class Meta:
        fields = ["id", "image", "image_url", "caption", "order"]


class MovieGalleryReadSerializer(AdminGalleryReadSerializer):
    class Meta(AdminGalleryReadSerializer.Meta):
        model = MovieGalleryImage


class SeriesGalleryReadSerializer(AdminGalleryReadSerializer):
    class Meta(AdminGalleryReadSerializer.Meta):
        model = SeriesGalleryImage


# ---------------------------------------------------------------------------
# Downloads (GenericRelation → با نام مدل + آیدی هدف کار می‌کند)
# ---------------------------------------------------------------------------
DOWNLOAD_TARGET_MODELS = {"movie": Movie, "series": Series, "episode": Episode}


class AdminDownloadSerializer(serializers.ModelSerializer):
    target_type = serializers.SerializerMethodField()
    target_title = serializers.SerializerMethodField()
    # برای نوشتن: نام مدل هدف («movie» | «series» | «episode»)
    content_type = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Download
        fields = ["id", "content_type", "target_type", "target_title", "object_id",
                  "title", "quality", "language", "subtitle", "size", "url",
                  "is_vip", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_target_type(self, obj):
        return obj.content_type.model if obj.content_type_id else None

    def get_target_title(self, obj):
        target = obj.content_object
        return str(target) if target is not None else f"حذف‌شده #{obj.object_id}"

    def validate(self, attrs):
        model_name = attrs.pop("content_type", None)
        if self.instance is None and not model_name:
            raise serializers.ValidationError({"content_type": "نوع هدف (فیلم/سریال/قسمت) الزامی است."})
        if model_name:
            model = DOWNLOAD_TARGET_MODELS.get(str(model_name).lower())
            if model is None:
                raise serializers.ValidationError({"content_type": "نوع هدف معتبر نیست."})
            object_id = attrs.get("object_id", getattr(self.instance, "object_id", None))
            if object_id is None or not model.objects.filter(pk=object_id).exists():
                raise serializers.ValidationError({"object_id": "هدف انتخاب‌شده وجود ندارد."})
            attrs["content_type"] = ContentType.objects.get_for_model(model)
        return attrs


# ---------------------------------------------------------------------------
# Movies
# ---------------------------------------------------------------------------
class AdminMovieListSerializer(serializers.ModelSerializer):
    """سریالایزر سبکِ لیست — بدون عوامل/گالری/دانلود تا لیست سریع بماند."""
    genres = serializers.SerializerMethodField()
    poster_display = serializers.SerializerMethodField()

    class Meta:
        model = Movie
        fields = ["id", "title", "original_title", "slug", "year", "release_date",
                  "imdb_rating", "imdb_id", "tmdb_id", "views", "is_active",
                  "genres", "poster_display", "updated_at"]

    def get_genres(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.genres.all()]

    def get_poster_display(self, obj):
        if obj.poster:
            return obj.poster.url
        return obj.poster_url or None


class AdminMovieSerializer(serializers.ModelSerializer):
    genres = serializers.SerializerMethodField(read_only=True)
    genre_ids = serializers.PrimaryKeyRelatedField(
        queryset=Genre.objects.all(), many=True, write_only=True,
        source="genres", required=False,
    )
    cast = AdminCastReadSerializer(source="movie_cast", many=True, read_only=True)
    cast_items = AdminCastWriteSerializer(many=True, write_only=True, required=False)
    gallery = MovieGalleryReadSerializer(many=True, read_only=True)
    gallery_items = AdminGalleryWriteSerializer(many=True, write_only=True, required=False)
    downloads = AdminDownloadSerializer(many=True, read_only=True)
    comments_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Movie
        fields = "__all__"

    def get_genres(self, obj):
        return [{"id": g.id, "name": g.name, "slug": g.slug} for g in obj.genres.all()]

    def get_comments_count(self, obj):
        return obj.comments.count()

    def _sync_cast(self, movie, items):
        MovieCast.objects.filter(movie=movie).delete()
        MovieCast.objects.bulk_create([
            MovieCast(movie=movie, person=i["person"], role=i["role"],
                      character_name=i.get("character_name", ""))
            for i in items
        ])

    def _sync_gallery(self, movie, items):
        MovieGalleryImage.objects.filter(movie=movie).delete()
        MovieGalleryImage.objects.bulk_create([
            MovieGalleryImage(movie=movie, image_url=i.get("image_url") or None,
                              caption=i.get("caption", ""), order=i.get("order", 0))
            for i in items
        ])

    def create(self, validated_data):
        genres = validated_data.pop("genres", None)
        cast_items = validated_data.pop("cast_items", None)
        gallery_items = validated_data.pop("gallery_items", None)
        movie = Movie.objects.create(**validated_data)
        _set_genres(movie, genres)
        if cast_items is not None:
            self._sync_cast(movie, cast_items)
        if gallery_items is not None:
            self._sync_gallery(movie, gallery_items)
        return movie

    def update(self, instance, validated_data):
        genres = validated_data.pop("genres", None)
        cast_items = validated_data.pop("cast_items", None)
        gallery_items = validated_data.pop("gallery_items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        _set_genres(instance, genres)
        if cast_items is not None:
            self._sync_cast(instance, cast_items)
        if gallery_items is not None:
            self._sync_gallery(instance, gallery_items)
        return instance


# ---------------------------------------------------------------------------
# Series / Seasons / Episodes
# ---------------------------------------------------------------------------
class AdminSeriesListSerializer(serializers.ModelSerializer):
    genres = serializers.SerializerMethodField()
    poster_display = serializers.SerializerMethodField()
    seasons_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Series
        fields = ["id", "title", "original_title", "slug", "start_date", "imdb_rating",
                  "imdb_id", "tmdb_id", "views", "is_ended", "number_of_seasons",
                  "number_of_episodes", "seasons_count", "genres", "poster_display",
                  "updated_at"]

    def get_genres(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.genres.all()]

    def get_poster_display(self, obj):
        if obj.poster:
            return obj.poster.url
        return obj.poster_url or None


class AdminSeriesSerializer(serializers.ModelSerializer):
    genres = serializers.SerializerMethodField(read_only=True)
    genre_ids = serializers.PrimaryKeyRelatedField(
        queryset=Genre.objects.all(), many=True, write_only=True,
        source="genres", required=False,
    )
    cast = AdminCastReadSerializer(many=True, read_only=True)
    cast_items = AdminCastWriteSerializer(many=True, write_only=True, required=False)
    gallery = SeriesGalleryReadSerializer(many=True, read_only=True)
    gallery_items = AdminGalleryWriteSerializer(many=True, write_only=True, required=False)
    downloads = AdminDownloadSerializer(many=True, read_only=True)
    comments_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Series
        fields = "__all__"

    def get_genres(self, obj):
        return [{"id": g.id, "name": g.name, "slug": g.slug} for g in obj.genres.all()]

    def get_comments_count(self, obj):
        return obj.comments.count()

    def _sync_cast(self, series, items):
        SeriesCast.objects.filter(series=series).delete()
        SeriesCast.objects.bulk_create([
            SeriesCast(series=series, person=i["person"], role=i["role"],
                       character_name=i.get("character_name", ""))
            for i in items
        ])

    def _sync_gallery(self, series, items):
        SeriesGalleryImage.objects.filter(series=series).delete()
        SeriesGalleryImage.objects.bulk_create([
            SeriesGalleryImage(series=series, image_url=i.get("image_url") or None,
                               caption=i.get("caption", ""), order=i.get("order", 0))
            for i in items
        ])

    def create(self, validated_data):
        genres = validated_data.pop("genres", None)
        cast_items = validated_data.pop("cast_items", None)
        gallery_items = validated_data.pop("gallery_items", None)
        series = Series.objects.create(**validated_data)
        _set_genres(series, genres)
        if cast_items is not None:
            self._sync_cast(series, cast_items)
        if gallery_items is not None:
            self._sync_gallery(series, gallery_items)
        return series

    def update(self, instance, validated_data):
        genres = validated_data.pop("genres", None)
        cast_items = validated_data.pop("cast_items", None)
        gallery_items = validated_data.pop("gallery_items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        _set_genres(instance, genres)
        if cast_items is not None:
            self._sync_cast(instance, cast_items)
        if gallery_items is not None:
            self._sync_gallery(instance, gallery_items)
        return instance


class AdminSeasonSerializer(serializers.ModelSerializer):
    episodes_count = serializers.IntegerField(read_only=True, required=False)
    series_title = serializers.CharField(source="series.title", read_only=True)

    class Meta:
        model = Season
        fields = ["id", "series", "series_title", "season_number", "title",
                  "description", "release_date", "poster", "episodes_count",
                  "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class AdminEpisodeSerializer(serializers.ModelSerializer):
    season_number = serializers.IntegerField(source="season.season_number", read_only=True)
    series_id = serializers.IntegerField(source="season.series_id", read_only=True)
    series_title = serializers.CharField(source="season.series.title", read_only=True)
    downloads = AdminDownloadSerializer(many=True, read_only=True)

    class Meta:
        model = Episode
        fields = ["id", "season", "season_number", "series_id", "series_title",
                  "episode_number", "title", "description", "runtime", "air_date",
                  "tmdb_id", "vote_average", "vote_count", "still_image",
                  "still_image_url", "downloads", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------
class AdminPersonSerializer(serializers.ModelSerializer):
    display_image = serializers.ReadOnlyField()

    class Meta:
        model = Person
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class AdminPersonListSerializer(serializers.ModelSerializer):
    display_image = serializers.ReadOnlyField()

    class Meta:
        model = Person
        fields = ["id", "name", "original_name", "slug", "tmdb_id", "popularity",
                  "birth_date", "display_image", "updated_at"]


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------
class AdminCollectionItemSerializer(serializers.ModelSerializer):
    target_type = serializers.SerializerMethodField()
    target_title = serializers.SerializerMethodField()
    content_type = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = CollectionItem
        fields = ["id", "collection", "content_type", "target_type", "target_title",
                  "object_id", "order"]
        read_only_fields = ["id"]

    def get_target_type(self, obj):
        return obj.content_type.model if obj.content_type_id else None

    def get_target_title(self, obj):
        target = obj.content_object
        return str(target) if target is not None else f"حذف‌شده #{obj.object_id}"

    def validate(self, attrs):
        model_name = attrs.pop("content_type", None)
        if model_name:
            model = {"movie": Movie, "series": Series}.get(str(model_name).lower())
            if model is None:
                raise serializers.ValidationError({"content_type": "فقط فیلم یا سریال مجاز است."})
            object_id = attrs.get("object_id", getattr(self.instance, "object_id", None))
            if object_id is None or not model.objects.filter(pk=object_id).exists():
                raise serializers.ValidationError({"object_id": "آیتم انتخاب‌شده وجود ندارد."})
            attrs["content_type"] = ContentType.objects.get_for_model(model)
        return attrs


class AdminCollectionSerializer(serializers.ModelSerializer):
    items = AdminCollectionItemSerializer(many=True, read_only=True)
    items_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Collection
        fields = ["id", "tmdb_id", "title", "slug", "description", "poster",
                  "poster_url", "backdrop", "backdrop_url", "order", "is_active",
                  "items", "items_count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class AdminCollectionListSerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Collection
        fields = ["id", "title", "slug", "poster", "poster_url", "order", "is_active",
                  "items_count", "updated_at"]


# ---------------------------------------------------------------------------
# Comments (نظارت / moderation)
# ---------------------------------------------------------------------------
class AdminCommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    target_type = serializers.SerializerMethodField()
    target_title = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "user", "username", "text", "parent", "is_active",
                  "is_approved", "target_type", "target_title", "object_id",
                  "created_at", "updated_at"]
        read_only_fields = ["id", "user", "created_at", "updated_at"]

    def get_target_type(self, obj):
        return obj.content_type.model if obj.content_type_id else None

    def get_target_title(self, obj):
        target = obj.content_object
        return str(target) if target is not None else f"حذف‌شده #{obj.object_id}"


# ---------------------------------------------------------------------------
# Users / Roles / Permissions
# ---------------------------------------------------------------------------
class AdminRoleSerializer(serializers.ModelSerializer):
    """نقش = Group جنگو + مجموعه‌ای از مجوزها. فقط سوپرادمین آن را مدیریت می‌کند."""
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(), many=True, source="permissions", required=False,
    )
    permissions_detail = serializers.SerializerMethodField(read_only=True)
    users_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Group
        fields = ["id", "name", "permission_ids", "permissions_detail", "users_count"]

    def get_permissions_detail(self, obj):
        return [
            {"id": p.id, "codename": f"{p.content_type.app_label}.{p.codename}", "name": p.name}
            for p in obj.permissions.all()
        ]

    def get_users_count(self, obj):
        return obj.user_set.count()


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    role_ids = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(), many=True, source="groups", required=False,
    )
    roles = serializers.SerializerMethodField(read_only=True)
    permissions = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "phone",
                  "avatar", "password", "is_active", "is_staff", "is_superuser",
                  "is_vip", "role_ids", "roles", "permissions",
                  "date_joined", "last_login"]
        read_only_fields = ["id", "date_joined", "last_login"]

    def get_roles(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.groups.all()]

    def get_permissions(self, obj):
        if obj.is_superuser:
            return ["*"]
        return sorted(obj.get_all_permissions())

    def validate_password(self, value):
        validate_password(value)
        return value

    def _check_privileges(self, validated_data):
        request = self.context.get("request")
        if request is not None:
            from .permissions import ensure_superuser_for_privilege_escalation
            ensure_superuser_for_privilege_escalation(request, validated_data, self.instance)

    def create(self, validated_data):
        self._check_privileges(validated_data)
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "برای ساخت کاربر، رمز عبور الزامی است."})
        groups = validated_data.pop("groups", [])
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if groups:
            user.groups.set(groups)
        return user

    def update(self, instance, validated_data):
        self._check_privileges(validated_data)
        password = validated_data.pop("password", None)
        groups = validated_data.pop("groups", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if groups is not None:
            instance.groups.set(groups)
        return instance


class PermissionCatalogSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)
    full_codename = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ["id", "name", "codename", "full_codename", "app_label", "model"]

    def get_full_codename(self, obj):
        return f"{obj.content_type.app_label}.{obj.codename}"


# ---------------------------------------------------------------------------
# Audit log / Me
# ---------------------------------------------------------------------------
class AdminAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminAuditLog
        fields = ["id", "user", "username", "action", "model_label", "object_id",
                  "object_repr", "changes", "ip_address", "created_at"]


class AdminMeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    avatar = serializers.SerializerMethodField()
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    def get_avatar(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            url = obj.avatar.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_roles(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.groups.all()]

    def get_permissions(self, obj):
        if obj.is_superuser:
            return ["*"]
        return sorted(obj.get_all_permissions())
