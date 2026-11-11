"""اجرای زمان‌بندی‌شده‌ی ایجنت محتوا (cron سرور).

نمونه‌ی کرون روزانه ساعت ۴ صبح روی سرور (Railway/Linux):
    0 4 * * *  cd /app && python manage.py run_content_agent

یا در پنل Railway یک Cron Service جدا با همین دستور بسازید.
"""
from django.core.management.base import BaseCommand

from content_agent.models import AgentRun
from content_agent.services import ContentAgent


class Command(BaseCommand):
    help = "اجرای ایجنت محتوا: آوردن آثار جدید TMDB به‌صورت پیش‌نویس"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=None, help="سقف تعداد اثر در این اجرا")
        parser.add_argument(
            "--sources",
            type=str,
            default=None,
            help="منابع با کاما: trending,new,popular,top_rated",
        )

    def handle(self, *args, **options):
        sources = (
            [s.strip() for s in options["sources"].split(",") if s.strip()]
            if options["sources"]
            else None
        )
        run = ContentAgent().run(
            triggered_by=None,
            trigger_type=AgentRun.TRIGGER_SCHEDULED,
            sources=sources,
            max_items=options["limit"],
        )
        self.stdout.write(
            f"run={run.id} status={run.status} found={run.found_count} "
            f"movies=+{run.created_movies} series=+{run.created_series} "
            f"existing={run.existing_skipped} blacklisted={run.blacklisted_skipped} "
            f"failed={run.failed_count}"
        )
        if run.status != AgentRun.STATUS_SUCCESS:
            raise SystemExit(1)
