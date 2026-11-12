import time
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand

IMG_BASE = settings.TMDB_IMAGE_BASE_URL.rstrip("/")
from django.db import transaction

from movies.services.tmdb import TMDBClient
from movies.models import Movie, MovieCast
from genres.models import Genre
from people.models import Person


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument("file", type=str)

    def handle(self, *args, **options):

        file_path = options["file"]

        with open(file_path, encoding="utf-8") as f:
            imdb_ids = [line.strip() for line in f if line.strip()]

        client = TMDBClient()

        self.stdout.write(f"Total: {len(imdb_ids)} movies")

        # -----------------------------
        # 🔥 GLOBAL CACHE (VERY IMPORTANT)
        # -----------------------------
        existing_movies = set(Movie.objects.values_list("imdb_id", flat=True))

        person_cache = {
            p.tmdb_id: p
            for p in Person.objects.all()
        }

        genre_cache = {
            g.tmdb_id: g
            for g in Genre.objects.all()
        }

        for index, imdb_id in enumerate(imdb_ids, start=1):

            if imdb_id in existing_movies:
                self.stdout.write(f"[{index}] SKIP {imdb_id}")
                continue

            try:
                self.stdout.write(f"[{index}] {imdb_id}")

                tmdb_id = client.find_movie(imdb_id)
                if not tmdb_id:
                    continue

                # ⚡ only 2 API calls (EN + FA)
                en_data = client.movie_details(tmdb_id, "en-US")
                fa_data = client.movie_details(tmdb_id, "fa-IR")

                release_date = en_data.get("release_date")
                if release_date:
                    release_date = datetime.strptime(
                        release_date,
                        "%Y-%m-%d"
                    ).date()

                with transaction.atomic():

                    movie = Movie.objects.create(
                        imdb_id=imdb_id,
                        tmdb_id=tmdb_id,
                        title=fa_data.get("title") or en_data.get("title"),
                        description=fa_data.get("overview") or en_data.get("overview") or "",
                        runtime=en_data.get("runtime") or 0,
                        imdb_rating=en_data.get("vote_average"),
                        original_title=en_data.get("title"),
                        release_date=release_date,
                        poster_url=(
                            f"{IMG_BASE}/w500{en_data.get('poster_path')}"
                            if en_data.get("poster_path") else None
                        ),
                        backdrop_url=(
                            f"{IMG_BASE}/original{en_data.get('backdrop_path')}"
                            if en_data.get("backdrop_path") else None
                        ),
                    )

                    existing_movies.add(imdb_id)

                    # -----------------------------
                    # GENRES (cached + bulk)
                    # -----------------------------
                    genres_to_add = []

                    for g in en_data.get("genres", []):

                        genre = genre_cache.get(g["id"])

                        if not genre:
                            genre = Genre.objects.create(
                                tmdb_id=g["id"],
                                name=g["name"]
                            )
                            genre_cache[g["id"]] = genre

                        genres_to_add.append(genre)

                    movie.genres.add(*genres_to_add)

                    # -----------------------------
                    # CAST (bulk create)
                    # -----------------------------
                    cast_objects = []

                    cast_list = en_data.get("credits", {}).get("cast", [])[:15]

                    for actor in cast_list:

                        pid = actor["id"]

                        person = person_cache.get(pid)

                        if not person:
                            person_data = client.person_details(pid)

                            person = Person.objects.create(
                                tmdb_id=pid,
                                name=person_data.get("name"),
                                biography=person_data.get("biography") or "",
                                popularity=person_data.get("popularity"),
                                birth_date=person_data.get("birthday"),
                                death_date=person_data.get("deathday"),
                                place_of_birth=person_data.get("place_of_birth") or "",
                                profile_image_url=(
                                    f"{IMG_BASE}/w500{person_data.get('profile_path')}"
                                    if person_data.get("profile_path") else None
                                ),
                            )

                            person_cache[pid] = person

                        cast_objects.append(
                            MovieCast(
                                movie=movie,
                                person=person,
                                role=MovieCast.ROLE_ACTOR,
                                character_name=actor.get("character", "")
                            )
                        )

                    # bulk insert cast
                    MovieCast.objects.bulk_create(cast_objects)

                    # -----------------------------
                    # DIRECTORS
                    # -----------------------------
                    director_objects = []

                    for crew in en_data.get("credits", {}).get("crew", []):

                        if crew.get("job") != "Director":
                            continue

                        pid = crew["id"]

                        person = person_cache.get(pid)

                        if not person:
                            person_data = client.person_details(pid)

                            person = Person.objects.create(
                                tmdb_id=pid,
                                name=person_data.get("name"),
                                biography=person_data.get("biography") or "",
                            )

                            person_cache[pid] = person

                        director_objects.append(
                            MovieCast(
                                movie=movie,
                                person=person,
                                role=MovieCast.ROLE_DIRECTOR
                            )
                        )

                    MovieCast.objects.bulk_create(director_objects)

                self.stdout.write(self.style.SUCCESS(f"DONE {imdb_id}"))

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"ERROR {imdb_id}: {e}")
                )
                continue