from django.conf import settings
from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed

from collection.models import (
    Collection,
    CollectionItem,
)

from movies.models import Movie
from movies.services.tmdb import TMDBClient


IMAGE_BASE = settings.TMDB_IMAGE_BASE_URL.rstrip("/")


class Command(BaseCommand):
    help = "Import TMDB Collections"
    MAX_WORKERS = 8

    def handle(self, *args, **options):

        self.tmdb = TMDBClient()

        self.movie_content_type = (
            ContentType.objects.get_for_model(
                Movie
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Loading movies..."
            )
        )

        self.movies = list(

            Movie.objects.exclude(
                tmdb_id__isnull=True
            )

        )

        self.stdout.write(

            self.style.SUCCESS(

                f"{len(self.movies)} movies found"

            )

        )

        self.import_collections()

    # --------------------------------------------------
    # Helpers
    # --------------------------------------------------

    def get_or_create_collection(
        self,
        tmdb_collection,
    ):

        poster = None
        backdrop = None

        if tmdb_collection.get(
            "poster_path"
        ):

            poster = (
                IMAGE_BASE
                + "/w500"
                + tmdb_collection["poster_path"]
            )

        if tmdb_collection.get(
            "backdrop_path"
        ):

            backdrop = (
                IMAGE_BASE
                + "/original"
                + tmdb_collection["backdrop_path"]
            )

        collection, _ = (
            Collection.objects.update_or_create(

                tmdb_id=tmdb_collection["id"],

                defaults={

                    "title":
                        tmdb_collection["name"],

                    "description":
                        "",

                    "poster_url":
                        poster,

                    "backdrop_url":
                        backdrop,

                    "is_active":
                        True,

                },

            )
        )

        return collection

    # --------------------------------------------------

    def add_movie(
        self,
        collection,
        movie,
        order,
    ):

        CollectionItem.objects.get_or_create(

            collection=collection,

            content_type=self.movie_content_type,

            object_id=movie.id,

            defaults={

                "order": order,

            },

        )

    # --------------------------------------------------

    def clear_collection(
        self,
        collection,
    ):

        CollectionItem.objects.filter(

            collection=collection

        ).delete()

    # --------------------------------------------------

    # --------------------------------------------------
    # Import Collections
    # --------------------------------------------------

    def import_collections(self):

        total = len(self.movies)

        processed = set()

        def process(movie):

            try:

                details = self.tmdb.movie_details(
                    movie.tmdb_id,
                    language="en-US"
                )

                tmdb_collection = details.get(
                    "belongs_to_collection"
                )

                if not tmdb_collection:
                    return None

                return tmdb_collection["id"], tmdb_collection

            except Exception:

                return None


        with ThreadPoolExecutor(
            max_workers=self.MAX_WORKERS
        ) as executor:

            futures = [

                executor.submit(
                    process,
                    movie
                )

                for movie in self.movies

            ]

            for future in as_completed(futures):

                result = future.result()

                if not result:
                    continue

                collection_id, tmdb_collection = result

                if collection_id in processed:
                    continue

                processed.add(collection_id)

                try:

                    collection = self.get_or_create_collection(
                        tmdb_collection
                    )

                    self.clear_collection(
                        collection
                    )

                    collection_data = self.tmdb._get(
                        f"collection/{collection_id}"
                    )

                    parts = sorted(

                        collection_data.get(
                            "parts",
                            []
                        ),

                        key=lambda x:
                            x.get("release_date")
                            or ""

                    )

                    order = 1

                    for part in parts:

                        movie = Movie.objects.filter(
                            tmdb_id=part["id"]
                        ).first()

                        if not movie:
                            continue

                        self.add_movie(
                            collection,
                            movie,
                            order
                        )

                        order += 1

                    self.stdout.write(

                        self.style.SUCCESS(
                            collection.title
                        )

                    )

                except Exception as e:

                    self.stdout.write(
                        self.style.ERROR(str(e))
                    )

        self.stdout.write("")

        self.stdout.write(

            self.style.SUCCESS(

                f"{len(processed)} collections imported."

            )

        )