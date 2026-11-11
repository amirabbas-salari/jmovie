from rest_framework import serializers

from .models import AgentImportedItem, AgentRun, AgentSettings


class AgentSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSettings
        fields = [
            "sources",
            "max_items_per_run",
            "min_rating",
            "min_votes",
            "translate_with_ai",
            "discovery_source_url",
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
            "created_total",
            "failed_count",
            "errors",
            "started_at",
            "finished_at",
        ]


class AgentImportedItemSerializer(serializers.ModelSerializer):
    admin_edit_path = serializers.SerializerMethodField()

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
            "created_at",
        ]

    def get_admin_edit_path(self, obj):
        if not obj.object_id:
            return None
        base = "movies" if obj.media_type == "movie" else "series"
        return f"/admin/{base}/{obj.object_id}/edit"
