"""اعلان پیام‌های پشتیبانی به ادمین: تلگرام و/یا ایمیل.

هر کانال فقط وقتی فعال است که متغیرهای محیطی‌اش تنظیم شده باشند
(بدون تنظیم، پیام فقط در دیتابیس می‌ماند و از پنل/ادمین جنگو خوانده
می‌شود). خطای هیچ کانالی نباید جلوی ثبت پیام کاربر را بگیرد.

تلگرام (سریع‌ترین راه‌اندازی):
    ۱) در تلگرام به @BotFather پیام بدهید، /newbot بزنید و توکن را بگیرید.
    ۲) به بات خودتان یک پیام بدهید (مثلاً سلام).
    ۳) این آدرس را در مرورگر باز کنید و عدد chat.id را بردارید:
       https://api.telegram.org/bot<TOKEN>/getUpdates
    ۴) در env سرور بگذارید:
       TELEGRAM_BOT_TOKEN=...   و   TELEGRAM_CHAT_ID=...

ایمیل:
    SUPPORT_NOTIFICATION_EMAIL=you@example.com   (ایمیل مقصد)
    EMAIL_HOST=smtp.gmail.com  EMAIL_PORT=587  EMAIL_USE_TLS=True
    EMAIL_HOST_USER=...        EMAIL_HOST_PASSWORD=...  (برای جیمیل: App Password)
    DEFAULT_FROM_EMAIL=MovieVerse <no-reply@example.com>
"""
import logging

import requests
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _format_text(msg):
    lines = [
        f"🎬 پیام جدید پشتیبانی مووی‌ورس — {msg.get_category_display()}",
        "",
        f"نام: {msg.name or '—'}",
        f"ایمیل: {msg.email or '—'}",
    ]
    if msg.subject:
        lines.append(f"موضوع: {msg.subject}")
    for key, value in (msg.meta or {}).items():
        if value not in (None, ""):
            lines.append(f"{key}: {value}")
    lines += ["", "متن پیام:", msg.message]
    return "\n".join(lines)


def _send_telegram(text):
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    chat_id = getattr(settings, "TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return False
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=6,
        )
        return resp.status_code == 200
    except Exception:
        logger.exception("support: telegram notification failed")
        return False


def _send_email(msg, text):
    recipient = getattr(settings, "SUPPORT_NOTIFICATION_EMAIL", "")
    if not recipient:
        return False
    try:
        send_mail(
            subject=f"[مووی‌ورس] {msg.get_category_display()}: {msg.subject or msg.name or 'بدون موضوع'}",
            message=text,
            from_email=None,  # DEFAULT_FROM_EMAIL از settings
            recipient_list=[recipient],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("support: email notification failed")
        return False


def notify_support_message(msg):
    """بهترین تلاش برای اعلان؛ فهرست کانال‌های موفق را برمی‌گرداند."""
    text = _format_text(msg)
    delivered = []
    if _send_telegram(text):
        delivered.append("telegram")
    if _send_email(msg, text):
        delivered.append("email")
    return delivered
