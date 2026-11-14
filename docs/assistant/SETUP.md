# راه‌اندازی دستیار صوتی زنده (کاملاً رایگان)

بدون هیچ کلیدی، دستیار در **حالت مرورگر** (رایگان، بدون LLM) کار می‌کند. برای گفتگوی صوتی زنده‌ی واقعی، این سه بخش لازم است — هیچ‌کدام پولی نیست و برای گفتار حتی حساب ابری هم لازم نیست.

## ۱) LiveKit (پلن رایگان Build یا سلف‌هاست)

1. در https://cloud.livekit.io ثبت‌نام کنید و یک Project بسازید.
2. از Settings → API Keys یک کلید بسازید.
3. در بک‌اند (`.env` جنگو) ست کنید:

```
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

پلن Build رایگان است (بدون کارت) و سهمیه‌اش برای پروتوتایپ کافی است. جایگزین کاملاً رایگان و بدون سهمیه: سلف‌هاست LiveKit روی سرور خودتان (همان سه متغیر با آدرس سرور خودتان).

## ۲) گفتار: سرور لوکال Speaches (Whisper + Piper فارسی)

یک کانتینر متن‌باز، هر دو جهت گفتار را می‌دهد — شنیدن با faster-whisper (فارسی را هم می‌فهمد) و صحبت‌کردن با Piper فارسی:

```bash
cd voice_agent
docker compose -f docker-compose.speech.yml up -d

# دانلود مدل‌ها (فقط بار اول؛ چند صد مگابایت تا چند گیگابایت بسته به مدل)
curl -X POST http://localhost:8001/v1/models/Systran/faster-whisper-large-v3
curl -X POST http://localhost:8001/v1/models/speaches-ai/piper-fa_IR-amir-medium
curl http://localhost:8001/v1/models   # باید هر دو مدل را ببینید
```

ایجنت به‌صورت پیش‌فرض به `http://localhost:8001/v1` وصل می‌شود (`SPEECH_BASE_URL`). روی CPU هم کار می‌کند؛ اگر کند بود `STT_MODEL` را کوچک‌تر کنید (مثلاً `Systran/faster-whisper-medium`). صدای انگلیسی طبیعی‌تر می‌خواهید؟ `TTS_MODEL=speaches-ai/Kokoro-82M-v1.0-ONNX` و `TTS_VOICE=af_heart` (مدل Kokoro را هم مثل بالا دانلود کنید).

## ۳) LLM (OpenAI-compatible)

پیش‌فرض همان OpenRouter سایت است:

```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

یا کاملاً لوکال با Ollama: `LLM_BASE_URL=http://localhost:11434/v1` و `LLM_MODEL` یک مدل دارای tool calling — در این حالت هیچ کلیدی لازم نیست.

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
- **توکن می‌آید ولی صدایی نیست**: ایجنت در حال اجرا نیست، یا سرور گفتار بالا نیست (`curl http://localhost:8001/v1/models`)، یا مدل STT/TTS دانلود نشده است. ایجنت هنگام بالا آمدن نبود سرور گفتار را در لاگ هشدار می‌دهد.
- **خطای 403 روی ابزارها**: `ASSISTANT_INTERNAL_SECRET` در جنگو و ایجنت یکی نیست.
