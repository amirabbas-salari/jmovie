from django.test import TestCase

# Create your tests here.


from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APIClient

from .models import SupportMessage


class SupportMessageAPITest(TestCase):
    """فرم‌های صفحه‌ی حمایت: ثبت در دیتابیس + اعلان تلگرام/ایمیل."""

    def setUp(self):
        self.client = APIClient()

    def test_create_general_message_is_saved(self):
        res = self.client.post("/support/messages/", {
            "category": "general", "name": "تست", "email": "a@b.co",
            "subject": "سلام", "message": "متن پیام تست برای پشتیبانی",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["ok"], True)
        msg = SupportMessage.objects.get()
        self.assertEqual(msg.category, "general")
        self.assertEqual(msg.message, "متن پیام تست برای پشتیبانی")

    def test_report_message_saves_meta(self):
        res = self.client.post("/support/messages/", {
            "category": "report", "name": "", "email": "",
            "message": "لینک قسمت ۳ باز نمی‌شود",
            "meta": {"media_title": "سریال تست", "quality": "1080p"},
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(SupportMessage.objects.get().meta["quality"], "1080p")

    def test_short_message_is_rejected(self):
        res = self.client.post("/support/messages/", {
            "category": "general", "message": "کم",
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(SupportMessage.objects.count(), 0)

    def test_invalid_email_is_rejected(self):
        res = self.client.post("/support/messages/", {
            "category": "general", "email": "not-an-email",
            "message": "متن پیام کافی طولانی",
        }, format="json")
        self.assertEqual(res.status_code, 400)

    def test_honeypot_is_silently_dropped(self):
        res = self.client.post("/support/messages/", {
            "category": "general", "message": "پیام اسپم بات‌ها",
            "website": "http://spam.example.com",
        }, format="json")
        self.assertEqual(res.status_code, 201)  # وانمود به موفقیت
        self.assertEqual(SupportMessage.objects.count(), 0)  # ولی ذخیره نشد

    @override_settings(TELEGRAM_BOT_TOKEN="tok123", TELEGRAM_CHAT_ID="42")
    def test_telegram_notification_sent_when_configured(self):
        with patch("core.notify.requests.post") as mock_post:
            mock_post.return_value.status_code = 200
            res = self.client.post("/support/messages/", {
                "category": "request", "name": "علی",
                "message": "لطفاً فیلم تست را اضافه کنید",
            }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertIn("telegram", res.data["delivered_via"])
        args, kwargs = mock_post.call_args
        self.assertIn("tok123", args[0])
        self.assertEqual(kwargs["json"]["chat_id"], "42")
        self.assertIn("درخواست فیلم/سریال", kwargs["json"]["text"])

    @override_settings(SUPPORT_NOTIFICATION_EMAIL="admin@example.com")
    def test_email_notification_sent_when_configured(self):
        with patch("core.notify.send_mail") as mock_mail:
            res = self.client.post("/support/messages/", {
                "category": "general", "name": "سارا",
                "message": "یک پیام برای تست ایمیل",
            }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertIn("email", res.data["delivered_via"])
        self.assertEqual(mock_mail.call_args.kwargs["recipient_list"], ["admin@example.com"])

    def test_no_notification_without_configuration(self):
        res = self.client.post("/support/messages/", {
            "category": "general", "message": "پیام بدون هیچ اعلانی",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["delivered_via"], [])
