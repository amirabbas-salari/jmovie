"""
ساخت نقش‌های پیش‌فرض پنل مدیریت.

اجرا:
    python manage.py create_admin_roles

نقش‌ها (Group) و مجوزهایشان:
* «مدیر محتوا»   — فیلم، سریال، فصل/قسمت، بازیگران، ژانر، کالکشن، دانلود (بدون مدیریت کاربران)
* «ناظر نظرات»   — فقط مشاهده‌ی محتوا + مدیریت کامل نظرات
* «پشتیبان کاربران» — مشاهده‌ی محتوا + مدیریت کاربران (بدون تعیین سطح دسترسی؛ آن فقط با سوپرادمین است)

سوپرادمین نیازی به نقش ندارد؛ با is_superuser به همه‌چیز دسترسی دارد.
این کامند idempotent است؛ اجرای دوباره‌اش مجوزها را به حالت پیش‌فرض برمی‌گرداند.
"""
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

CONTENT_PERMS = (
    [f"{v}_movie" for v in ("view", "add", "change", "delete")]
    + [f"{v}_moviecast" for v in ("view", "add", "change", "delete")]
    + [f"{v}_moviegalleryimage" for v in ("view", "add", "change", "delete")]
    + [f"{v}_series" for v in ("view", "add", "change", "delete")]
    + [f"{v}_seriescast" for v in ("view", "add", "change", "delete")]
    + [f"{v}_seriesgalleryimage" for v in ("view", "add", "change", "delete")]
    + [f"{v}_season" for v in ("view", "add", "change", "delete")]
    + [f"{v}_episode" for v in ("view", "add", "change", "delete")]
    + [f"{v}_person" for v in ("view", "add", "change", "delete")]
    + [f"{v}_genre" for v in ("view", "add", "change", "delete")]
    + [f"{v}_collection" for v in ("view", "add", "change", "delete")]
    + [f"{v}_collectionitem" for v in ("view", "add", "change", "delete")]
    + [f"{v}_download" for v in ("view", "add", "change", "delete")]
)

ROLES = {
    "مدیر محتوا": CONTENT_PERMS + ["view_comment", "view_admin_dashboard"],
    "ناظر نظرات": [
        "view_movie", "view_series", "view_episode",
        "view_comment", "add_comment", "change_comment", "delete_comment",
        "view_admin_dashboard",
    ],
    "پشتیبان کاربران": [
        "view_movie", "view_series", "view_comment",
        "view_user", "add_user", "change_user",
        "view_admin_dashboard",
    ],
}


class Command(BaseCommand):
    help = "نقش‌های پیش‌فرض پنل مدیریت (مدیر محتوا / ناظر نظرات / پشتیبان کاربران) را می‌سازد."

    def handle(self, *args, **options):
        all_perms = {
            p.codename: p
            for p in Permission.objects.select_related("content_type").all()
        }
        for role_name, codenames in ROLES.items():
            group, created = Group.objects.get_or_create(name=role_name)
            perms = [all_perms[c] for c in codenames if c in all_perms]
            missing = [c for c in codenames if c not in all_perms]
            group.permissions.set(perms)
            verb = "ساخته شد" if created else "به‌روزرسانی شد"
            self.stdout.write(self.style.SUCCESS(f"نقش «{role_name}» {verb} — {len(perms)} مجوز"))
            if missing:
                self.stdout.write(self.style.WARNING(f"  مجوزهای یافت‌نشده: {', '.join(missing)}"))
        self.stdout.write("تمام شد. نقش‌ها را از پنل (بخش «نقش‌ها و دسترسی‌ها») به ادمین‌ها بدهید.")
