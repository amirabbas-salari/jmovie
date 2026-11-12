from concurrent.futures import ThreadPoolExecutor, as_completed

from django.conf import settings
from django.core.management.base import BaseCommand

from movies.models import Movie
from movies.services.tmdb import TMDBClient


POSTER_BASE = settings.TMDB_IMAGE_BASE_URL.rstrip("/") + "/w500"
BACKDROP_BASE = settings.TMDB_IMAGE_BASE_URL.rstrip("/") + "/original"

MAX_WORKERS = 8


class Command(BaseCommand):
    help = "Update poster_url and backdrop_url for all movies"

    def handle(self, *args, **options):

        movies = list(
            Movie.objects.exclude(
                tmdb_id__isnull=True
            )
        )

        total = len(movies)

        self.stdout.write(
            self.style.SUCCESS(
                f"Found {total} movies"
            )
        )

        client = TMDBClient()

        def worker(movie):

            try:

                data = client.movie_details(
                    movie.tmdb_id,
                    language="en-US"
                )

                poster = ""

                if data.get("poster_path"):
                    poster = (
                        POSTER_BASE
                        + data["poster_path"]
                    )

                backdrop = ""

                if data.get("backdrop_path"):
                    backdrop = (
                        BACKDROP_BASE
                        + data["backdrop_path"]
                    )

                movie.poster_url = poster
                movie.backdrop_url = backdrop

                return movie

            except Exception as e:

                self.stdout.write(
                    self.style.ERROR(
                        f"{movie.imdb_id}: {e}"
                    )
                )

                return None

        updated_movies = []

        with ThreadPoolExecutor(
            max_workers=MAX_WORKERS
        ) as executor:

            futures = [
                executor.submit(
                    worker,
                    movie
                )
                for movie in movies
            ]

            for index, future in enumerate(
                as_completed(futures),
                start=1
            ):

                movie = future.result()

                if movie:
                    updated_movies.append(movie)

                if index % 50 == 0 or index == total:
                    self.stdout.write(
                        f"{index}/{total}"
                    )

        Movie.objects.bulk_update(
            updated_movies,
            [
                "poster_url",
                "backdrop_url",
            ],
            batch_size=500,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Updated {len(updated_movies)} movies."
            )
        )