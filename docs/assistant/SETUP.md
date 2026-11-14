# راه‌اندازی دستیار صوتی زنده (ابری و رایگان)

بدون هیچ کلیدی، دستیار در **حالت مرورگر** (رایگان، بدون LLM) کار می‌کند. برای گفتگوی صوتی زنده‌ی واقعی، سه بخش زیر لازم است — همه ابری‌اند و هیچ‌چیز روی لوکال اجرا نمی‌شود.

## ۱) LiveKit (پلن رایگان Build یا سلف‌هاست)

1. در https://cloud.livekit.io ثبت‌نام کنید و یک Project بسازید.
2. از Settings → API Keys یک کلید بسازید.
3. در بک‌اند (`.env` جنگو) ست کنید:

```
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

پلن Build رایگان است (بدون کارت) و سهمیه‌اش برای پروتوتایپ کافی است.

## ۲) گفتار: LiveKit Inference (همان حساب LiveKit)

برای گفتار **هیچ ثبت‌نام یا کلید جداگانه‌ای لازم نیست**؛ مدل‌ها با همان کلیدهای قدم ۱ کار می‌کنند و از اعتبار Inference حساب شما مصرف می‌کنند:

- پیش‌فرض ایجنت: شنیدن با `deepgram/nova-3` و صحبت‌کردن با `cartesia/sonic-3` (انگلیسی؛ مکالمه هم انگلیسی می‌شود)
- پلن رایگان Build ماهانه ۲٫۵۰ دلار اعتبار Inference می‌دهد (تقریباً ۵۰ دقیقه مکالمه)؛ وقتی تمام شود درخواست‌های گفتار متوقف می‌شوند و هزینه‌ای تحمیل نمی‌شود
- مدل‌ها از env قابل تغییرند (`STT_MODEL` / `TTS_MODEL` / `TTS_VOICE`)؛ فهرست مدل‌های Inference را در مستندات LiveKit ببینید

> گزینه‌ها: `SPEECH_PROVIDER=groq` با پلن Free ‏Groq (کلید جدا از console.groq.com)، یا گفتار فارسی کاملاً لوکال با `SPEECH_PROVIDER=local` و Speaches/Piper — هر دو در `voice_agent/README.md` مستندند.

## ۳) LLM (OpenAI-compatible)

پیش‌فرض همان OpenRouter سایت است:

```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

سکرت مشترک جنگو و ایجنت را هم بسازید (رشته‌ی تصادفی بلند، مثل خروجی `openssl rand -hex 32`) و در **هر دو** ست کنید:

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
- **توکن می‌آید ولی صدایی نیست**: ایجنت در حال اجرا نیست، یا اعتبار Inference ماهانه‌ی حساب LiveKit تمام شده است (در کنسول LiveKit بخش Usage/Billing را ببینید).
- **خطای 403 روی ابزارها**: `ASSISTANT_INTERNAL_SECRET` در جنگو و ایجنت یکی نیست.
