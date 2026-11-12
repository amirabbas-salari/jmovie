from datetime import datetime
import time

from django.conf import settings
from django.core.management.base import BaseCommand

IMG_BASE = settings.TMDB_IMAGE_BASE_URL.rstrip("/")
from django.db import transaction

from genres.models import Genre
from people.models import Person
from series.models import Series, SeriesCast

from movies.services.tmdb import TMDBClient


IMAGE_BASE_URL = IMG_BASE + "/w500"


class Command(BaseCommand):
    help = "Import series from imdb ids"

    def add_arguments(self, parser):
        parser.add_argument("file", type=str)

    def handle(self, *args, **options):

        with open(options["file"], encoding="utf-8") as f:
            imdb_ids = list(
                dict.fromkeys(
                    line.strip()
                    for line in f
                    if line.strip()
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Found {len(imdb_ids)} unique series"
            )
        )

        client = TMDBClient()

        for index, imdb_id in enumerate(imdb_ids, start=1):

            if Series.objects.filter(imdb_id=imdb_id).exists():
                self.stdout.write(
                    f"[{index}] SKIP {imdb_id}"
                )
                continue

            try:

                self.stdout.write(
                    f"[{index}] Processing {imdb_id}"
                )

                tmdb_id = client.find_tv(imdb_id)

                if not tmdb_id:
                    self.stdout.write(
                        self.style.ERROR(
                            f"NOT FOUND {imdb_id}"
                        )
                    )
                    continue

                en_data = client.tv_details(tmdb_id, language="en-US")
                data = client.tv_details(tmdb_id, language="fa-IR")
                

                first_air_date = None
                last_air_date = None

                if data.get("first_air_date"):
                    try:
                        first_air_date = datetime.strptime(
                            data["first_air_date"],
                            "%Y-%m-%d"
                        ).date()
                    except Exception:
                        pass

                if data.get("last_air_date"):
                    try:
                        last_air_date = datetime.strptime(
                            data["last_air_date"],
                            "%Y-%m-%d"
                        ).date()
                    except Exception:
                        pass

                with transaction.atomic():

                    poster_url = None
                    if data.get("poster_path"):
                        poster_url = f"{IMG_BASE}/w500{en_data['poster_path']}"

                    backdrop_url = None
                    if data.get("backdrop_path"):
                        backdrop_url = f"{IMG_BASE}/original{en_data['backdrop_path']}"
                    
                    
                    series = Series.objects.create(
                        imdb_id=imdb_id,
                        tmdb_id=tmdb_id,

                        title=data.get("name") or "",
                        original_title=en_data.get("original_name") or "",

                        description=data.get("overview") or "",

                        start_date=first_air_date,
                        end_date=last_air_date,

                        imdb_rating=data.get("vote_average"),
                        imdb_votes=data.get("vote_count"),

                        number_of_seasons=data.get("number_of_seasons"),
                        number_of_episodes=data.get("number_of_episodes"),

                        is_ended=data.get("status") == "Ended",
                        
                        poster_url=poster_url,
                        backdrop_url=backdrop_url,
                        
                    )
                    
                    
                    # --------------------
                    # Genres
                    # --------------------
                    for item in data.get("genres", []):

                        genre, _ = Genre.objects.get_or_create(
                            name=item["name"]
                        )

                        series.genres.add(genre)

                    # --------------------
                    # Actors
                    # --------------------
                    for actor in data.get(
                        "credits",
                        {}
                    ).get("cast", [])[:15]:

                        person, _ = Person.objects.get_or_create(
                            tmdb_id=str(actor["id"]),
                            defaults={
                                "name": actor.get("name") or "",
                                "original_name": (
                                    actor.get("original_name")
                                    or actor.get("name")
                                    or ""
                                ),
                                "biography": "",
                                "place_of_birth": "",
                                "profile_image_url": (
                                    f"{IMAGE_BASE_URL}{actor['profile_path']}"
                                    if actor.get("profile_path")
                                    else None
                                ),
                                "popularity": actor.get("popularity"),
                            }
                        )

                        SeriesCast.objects.get_or_create(
                            series=series,
                            person=person,
                            role="actor",
                            defaults={
                                "character_name":
                                    actor.get("character")
                                    or ""
                            }
                        )

                    # --------------------
                    # Directors
                    # --------------------
                    for crew in data.get(
                        "credits",
                        {}
                    ).get("crew", []):

                        if crew.get("job") != "Director":
                            continue

                        person, _ = Person.objects.get_or_create(
                            tmdb_id=str(crew["id"]),
                            defaults={
                                "name": crew.get("name") or "",
                                "original_name": (
                                    crew.get("original_name")
                                    or crew.get("name")
                                    or ""
                                ),
                                "biography": "",
                                "place_of_birth": "",
                            }
                        )

                        SeriesCast.objects.get_or_create(
                            series=series,
                            person=person,
                            role="director"
                        )

                    # --------------------
                    # Writers
                    # --------------------
                    for crew in data.get(
                        "credits",
                        {}
                    ).get("crew", []):

                        if crew.get("department") != "Writing":
                            continue

                        person, _ = Person.objects.get_or_create(
                            tmdb_id=str(crew["id"]),
                            defaults={
                                "name": crew.get("name") or "",
                                "original_name": (
                                    crew.get("original_name")
                                    or crew.get("name")
                                    or ""
                                ),
                                "biography": "",
                                "place_of_birth": "",
                            }
                        )

                        SeriesCast.objects.get_or_create(
                            series=series,
                            person=person,
                            role="writer"
                        )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Imported: {series.title}"
                    )
                )

                time.sleep(0.25)

            except Exception as e:

                self.stdout.write(
                    self.style.ERROR(
                        f"ERROR {imdb_id}: {e}"
                    )
                )

                continue