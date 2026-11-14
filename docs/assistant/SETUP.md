# راه‌اندازی دستیار صوتی زنده (کلیدهای رایگان)

بدون هیچ‌کدام از این کلیدها، دستیار در **حالت مرورگر** (رایگان، بدون LLM) کار می‌کند. برای گفتگوی صوتی زنده‌ی واقعی این سه سرویس لازم است. هیچ کلید واقعی‌ای نباید در گیت یا فرانت قرار گیرد؛ فقط env سرور.

## ۱) LiveKit Cloud (پلن رایگان Build)

1. در https://cloud.livekit.io ثبت‌نام کنید و یک Project بسازید.
2. از Settings → API Keys یک کلید بسازید.
3. در بک‌اند (`.env` جنگو) ست کنید:

```
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

پلن Build رایگان است (بدون کارت): سهمیه‌ی ماهانه‌ی محدود ایجنت/WebRTC دارد و برای پروتوتایپ کافی است. جایگزین کاملاً رایگان: سلف‌هاست LiveKit روی سرور خودتان (همان سه متغیر با آدرس سرور خودتان).

## ۲) Azure AI Speech — تیِر رایگان F0 (فارسی fa-IR)

1. در Azure Portal یک ریسورس **Speech** با Pricing tier ‏**F0 (Free)** بسازید.
2. از Keys and Endpoint، ‏Key و Region را بردارید.
3. فقط روی سرور ایجنت صوتی ست کنید:

```
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=eastus
AZURE_TTS_VOICE=fa-IR-DilaraNeural   # یا fa-IR-FaridNeural
```

F0 ماهانه سهمیه‌ی رایگان گفتار (TTS عصبی و STT) می‌دهد ولی نرخ/هم‌زمانی پایینی دارد؛ برای پروتوتایپ مناسب و برای production نیست.

## ۳) LLM از مسیر OpenRouter (قابل تعویض)

ایجنت از پروتکل OpenAI-compatible استفاده می‌کند. پیش‌فرض OpenRouter است:

```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

مدل را می‌توانید با هر مدل دارای tool calling عوض کنید. سکرت مشترک جنگو و ایجنت را هم بسازید (رشته‌ی تصادفی بلند، مثل خروجی `openssl rand -hex 32`) و در **هر دو** ست کنید:

```
ASSISTANT_INTERNAL_SECRET=...
```

## ۴) اجرا

```bash
# بک‌اند (مثل همیشه)
cd backend/jmovie && python manage.py runserver

# ایجنت صوتی (ترمینال جدا)
cd voice_agent
pip install -r requirements.txt
python agent.py dev      # توسعه — یا start برای production
```

بعد در سایت روی «دستیار سینمایی» بزنید؛ اگر توکن صادر شود و ایجنت به اتاق وصل باشد، دکمه‌ی «شروع مکالمه‌ی صوتی» مکالمه را آغاز می‌کند. میکروفون فقط بعد از کلیک کاربر و اجازه‌ی مرورگر روشن می‌شود.

## عیب‌یابی سریع

- **همیشه حالت مرورگر می‌آید**: `GET /ai/assistant/status/` را ببینید؛ `livekit_configured` یعنی هر سه متغیر LiveKit در env جنگوست.
- **توکن می‌آید ولی صدایی نیست**: ایجنت در حال اجرا نیست یا کلیدهای Azure/OpenRouter روی سرور ایجنت ست نشده‌اند (ایجنت هنگام بالا آمدن، متغیرهای ناقص را با پیام روشن اعلام می‌کند).
- **خطای 403 روی ابزارها**: `ASSISTANT_INTERNAL_SECRET` در جنگو و ایجنت یکی نیست.
