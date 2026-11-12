import asyncio
import aiohttp

from django.core.management.base import BaseCommand

from movies.models import Movie, MovieGalleryImage

IMAGE_BASE = settings.TMDB_IMAGE_BASE_URL.rstrip("/") + "/original"
BASE_URL = "https://api-themoviedb-org-7znyli2mits1.curlhub.io/3"

CONCURRENT_REQUESTS = 20


class Command(BaseCommand):
    help = "Import movie gallery images (Async)"

    async def fetch_images(self, session, semaphore, movie):

        async with semaphore:

            if not movie.tmdb_id:
                return movie.id, []

            url = f"{BASE_URL}/movie/{movie.tmdb_id}/images"

            params = {
                "api_key": self.api_key
            }

            try:

                async with session.get(
                    url,
                    params=params,
                    timeout=30
                ) as response:

                    response.raise_for_status()

                    data = await response.json()

                    return (
                        movie.id,
                        data.get("backdrops", [])[:5]
                    )

            except Exception as e:

                self.stdout.write(
                    self.style.ERROR(
                        f"{movie.title}: {e}"
                    )
                )

                return movie.id, []

    async def fetch_all(self, movies):

        semaphore = asyncio.Semaphore(
            CONCURRENT_REQUESTS
        )

        connector = aiohttp.TCPConnector(
            limit=CONCURRENT_REQUESTS
        )

        async with aiohttp.ClientSession(
            connector=connector
        ) as session:

            tasks = [
                self.fetch_images(
                    session,
                    semaphore,
                    movie
                )
                for movie in movies
            ]

            return await asyncio.gather(*tasks)

    def handle(self, *args, **kwargs):

        from django.conf import settings

        self.api_key = settings.TMDB_API_KEY

        movies = list(
            Movie.objects.exclude(
                tmdb_id__isnull=True
            )
        )

        total = len(movies)

        self.stdout.write(
            self.style.SUCCESS(
                f"Fetching images for {total} movies..."
            )
        )

        results = asyncio.run(
            self.fetch_all(movies)
        )

        movie_map = {
            movie.id: movie
            for movie in movies
        }

        MovieGalleryImage.objects.filter(
            movie__in=movies
        ).delete()

        objs = []

        for movie_id, backdrops in results:

            movie = movie_map[movie_id]

            for order, image in enumerate(backdrops):

                objs.append(
                    MovieGalleryImage(
                        movie=movie,
                        image_url=IMAGE_BASE + image["file_path"],
                        order=order,
                    )
                )

        MovieGalleryImage.objects.bulk_create(
            objs,
            batch_size=5000
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done! Imported {len(objs)} images."
            )
        )