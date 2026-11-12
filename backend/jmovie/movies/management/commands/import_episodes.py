from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand

from series.models import (
    Series,
    Season,
    Episode,
)

from movies.services.tmdb import TMDBClient


class Command(BaseCommand):
    help = "Import seasons and episodes"


    def handle(self, *args, **options):

        client = TMDBClient()

        # series_list = Series.objects.exclude(
        #     tmdb_id__isnull=True
        # )
        
        series_list = (
            Series.objects
            .exclude(tmdb_id__isnull=True)
            .filter(seasons__isnull=True)
            .distinct()
        )

        for series in series_list:

            try:

                self.stdout.write(
                    f"\n{series.original_title}"
                )

                for season_number in range(
                    1,
                    (series.number_of_seasons or 0) + 1
                ):

                    data = client.season_details(
                        series.tmdb_id,
                        season_number
                    )

                    release_date = None

                    if data.get("air_date"):
                        try:
                            release_date = datetime.strptime(
                                data["air_date"],
                                "%Y-%m-%d"
                            ).date()
                        except:
                            pass

                    season, _ = Season.objects.get_or_create(
                        series=series,
                        season_number=season_number,
                        defaults={
                            "title": data.get("name") or "",
                            "description": data.get("overview") or "",
                            "release_date": release_date,
                        }
                    )

                    self.stdout.write(
                        f"Season {season_number}"
                    )

                    for ep in data.get(
                        "episodes",
                        []
                    ):
                        still_image_url = None

                        if ep.get("still_path"):
                            still_image_url = (
                                settings.TMDB_IMAGE_BASE_URL.rstrip("/") + "/w780"
                                + ep["still_path"]
                            )

                        air_date = None

                        if ep.get("air_date"):
                            try:
                                air_date = datetime.strptime(
                                    ep["air_date"],
                                    "%Y-%m-%d"
                                ).date()
                            except:
                                pass

                        Episode.objects.update_or_create(
                            season=season,
                            episode_number=ep["episode_number"],
                            defaults={
                                "title": ep.get("name") or "",
                                "description": ep.get("overview") or "",
                                "runtime": ep.get("runtime"),
                                "air_date": air_date,
                                "tmdb_id": ep.get("id"),
                                "vote_average": ep.get("vote_average"),
                                "vote_count": ep.get("vote_count"),
                                "still_image_url": (
                                    settings.TMDB_IMAGE_BASE_URL.rstrip("/") + "/w780"
                                    + ep["still_path"]
                                    if ep.get("still_path")
                                    else None
                                ),
                            }
                        )

                self.stdout.write(
                    self.style.SUCCESS(
                        "Done"
                    )
                )

            except Exception as e:

                self.stdout.write(
                    self.style.ERROR(
                        f"{series.title}: {e}"
                    )
                )