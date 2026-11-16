from rest_framework import serializers

from .models import AgentImportedItem, AgentRun, AgentSettings


class AgentSettingsSerializer(serializers.ModelSerializer):
    def validate_media_types(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("باید فهرستی از نوع‌ها باشد.")
        allowed = [v for v in value if v in ("movie", "series")]
        return allowed

    class Meta:
        model = AgentSettings
        fields = [
            "sources",
            "media_types",
            "max_items_per_run",
            "min_rating",
            "min_votes",
            "translate_with_ai",
            "discovery_source_url",
            "download_source_url",
            "fetch_downloads",
            "release_date_from",
            "release_date_to",
            "updated_at",
        ]


class AgentRunSerializer(serializers.ModelSerializer):
    created_total = serializers.ReadOnlyField()
    triggered_by_username = serializers.CharField(
        source="triggered_by.username", read_only=True, default=None
    )

    class Meta:
        model = AgentRun
        fields = [
            "id",
            "trigger_type",
            "triggered_by_username",
            "status",
            "sources",
            "found_count",
            "existing_skipped",
            "blacklisted_skipped",
            "created_movies",
            "created_series",
            "auto_removed_count",
            "created_total",
            "failed_count",
            "errors",
            "started_at",
            "finished_at",
        ]


class AgentImportedItemSerializer(serializers.ModelSerializer):
    admin_edit_path = serializers.SerializerMethodField()
    downloads_count = serializers.SerializerMethodField()
    seasons_count = serializers.SerializerMethodField()
    episodes_count = serializers.SerializerMethodField()

    class Meta:
        model = AgentImportedItem
        fields = [
            "id",
            "media_type",
            "tmdb_id",
            "imdb_id",
            "object_id",
            "title",
            "original_title",
            "year",
            "rating",
            "poster_url",
            "status",
            "admin_edit_path",
            "downloads_count",
            "seasons_count",
            "episodes_count",
            "created_at",
        ]

    def get_admin_edit_path(self, obj):
        if not obj.object_id:
            return None
        base = "movies" if obj.media_type == "movie" else "series"
        return f"/admin/{base}/{obj.object_id}/edit"

    def _media(self, obj):
        if not obj.object_id:
            return None
        from movies.models import Movie
        from series.models import Series

        model = Movie if obj.media_type == "movie" else Series
        return model.objects.filter(id=obj.object_id).first()

    def get_downloads_count(self, obj):
        media = self._media(obj)
        if media is None:
            return 0
        from django.contrib.contenttypes.models import ContentType

        from downloads.models import Download

        content_ids = [(ContentType.objects.get_for_model(media.__class__), media.id)]
        if obj.media_type == "series":
            episode_ids = [
                ep_id
                for season in media.seasons.all()
                for ep_id in season.episodes.values_list("id", flat=True)
            ]
            if episode_ids:
                from series.models import Episode

                content_ids.append((ContentType.objects.get_for_model(Episode), episode_ids))
        from django.db.models import Q

        query = Q()
        for content_type, ids in content_ids:
            if isinstance(ids, list):
                query |= Q(content_type=content_type, object_id__in=ids)
            else:
                query |= Q(content_type=content_type, object_id=ids)
        return Download.objects.filter(query).count()

    def get_seasons_count(self, obj):
        if obj.media_type != "series":
            return None
        media = self._media(obj)
        return media.seasons.count() if media else 0

    def get_episodes_count(self, obj):
        if obj.media_type != "series":
            return None
        media = self._media(obj)
        if media is None:
            return 0
        return sum(season.episodes.count() for season in media.seasons.all())
