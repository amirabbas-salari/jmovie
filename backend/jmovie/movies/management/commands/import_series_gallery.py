from concurrent.futures import ThreadPoolExecutor, as_completed

from django.conf import settings
from django.core.management.base import BaseCommand

from series.models import Series, SeriesGalleryImage
from movies.services.tmdb import TMDBClient

IMAGE_BASE = settings.TMDB_IMAGE_BASE_URL.rstrip("/") + "/original"

MAX_WORKERS = 8


class Command(BaseCommand):
    help = "Import series gallery images"

    def handle(self, *args, **kwargs):

        series_list = list(
            Series.objects.exclude(
                tmdb_id__isnull=True
            )
        )

        total = len(series_list)

        self.stdout.write(
            self.style.SUCCESS(
                f"Found {total} series"
            )
        )

        client = TMDBClient()

        def process(series):

            try:

                images = client.tv_images(
                    series.tmdb_id
                )

                backdrops = images.get(
                    "backdrops",
                    []
                )[:5]

                SeriesGalleryImage.objects.filter(
                    series=series
                ).delete()

                objs = []

                for order, image in enumerate(backdrops):

                    objs.append(
                        SeriesGalleryImage(
                            series=series,
                            image_url=IMAGE_BASE + image["file_path"],
                            order=order,
                        )
                    )

                if objs:
                    SeriesGalleryImage.objects.bulk_create(
                        objs
                    )

                return (
                    True,
                    series.title,
                    len(objs)
                )

            except Exception as e:

                return (
                    False,
                    series.title,
                    str(e)
                )

        success = 0
        failed = 0

        with ThreadPoolExecutor(
            max_workers=MAX_WORKERS
        ) as executor:

            futures = [
                executor.submit(
                    process,
                    series
                )
                for series in series_list
            ]

            for index, future in enumerate(
                as_completed(futures),
                start=1
            ):

                ok, title, result = future.result()

                if ok:
                    success += 1
                else:
                    failed += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f"{title}: {result}"
                        )
                    )

                if index % 50 == 0 or index == total:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"{index}/{total} | Success: {success} | Failed: {failed}"
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nFinished\nSuccess: {success}\nFailed: {failed}"
            )
        )