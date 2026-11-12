from django.conf import settings
from django.core.management.base import BaseCommand
from backend.jmovie.people.models import Person
from backend.jmovie.movies.services.tmdb import TMDBClient

IMAGE_BASE_URL = settings.TMDB_IMAGE_BASE_URL.rstrip("/") + "/w500"


class Command(BaseCommand):
    help = "Update profile_image_url for existing persons"

    def handle(self, *args, **options):
        client = TMDBClient()

        persons = Person.objects.filter(
            profile_image_url__isnull=True
        )
        # persons = Person.objects.all()

        total = persons.count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Found {total} persons"
            )
        )

        for index, person in enumerate(persons.iterator(), start=1):
            try:
                data = client.person_details(person.tmdb_id)

                profile_path = data.get("profile_path")

                if profile_path:
                    person.profile_image_url = (
                        f"{IMAGE_BASE_URL}{profile_path}"
                    )

                    person.save(
                        update_fields=["profile_image_url"]
                    )

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[{index}/{total}] Updated: {person.name}"
                        )
                    )
                else:
                    self.stdout.write(
                        f"[{index}/{total}] No image: {person.name}"
                    )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"[{index}/{total}] Error {person.name}: {e}"
                    )
                )