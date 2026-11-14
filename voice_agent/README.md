# ایجنت صوتی دستیار سینمایی (LiveKit Agents)

سرویس پایتون **مستقل از جنگو** که مکالمه‌ی صوتی بلادرنگ را اجرا می‌کند:

```
کاربر → LiveKit → STT ابری (Whisper) → LLM + ابزار کاتالوگ جنگو → TTS ابری (Orpheus) → کاربر
```

ابزارهای کاتالوگ (`search_movies`، `search_series`، `get_title_details`، `compare_titles`، `recommend_titles`، `search_similar_titles`) از مسیر `POST /ai/assistant/tool/` جنگو با هدر `X-Assistant-Secret` صدا زده می‌شوند؛ ایجنت هرگز مستقیم به دیتابیس وصل نمی‌شود و هیچ اطلاعاتی از خودش نمی‌سازد.

حالت‌های آواتار (idle/listening/thinking/speaking) و کارت‌های پیشنهاد از دیتاچنل LiveKit (topic: `assistant`) برای فرانت ارسال می‌شوند. صدای خام کاربر لاگ یا ذخیره نمی‌شود.

## پشته‌ی گفتار: ابری و رایگان (Groq) — پیش‌فرض

هیچ‌چیز روی لوکال اجرا نمی‌شود؛ گفتار از پلن **Free سرویس Groq** می‌آید (بدون کارت بانکی، فقط ثبت‌نام و ساخت API Key از https://console.groq.com):

- **شنیدن (STT):** ‏`whisper-large-v3-turbo` — بسیار سریع؛ فارسی را هم transcribe می‌کند
- **صحبت‌کردن (TTS):** ‏`canopylabs/orpheus-v1-english` با صدای `autumn` — انگلیسی طبیعی

چون صدای خروجی انگلیسی است، در این حالت زبان مکالمه هم انگلیسی می‌شود (`ASSISTANT_LANGUAGE=en` به‌صورت پیش‌فرض). سقف پلن رایگان برای پروتوتایپ مناسب است (TTS حدود ۱۰۰ درخواست در روز)؛ سقف‌ها را در کنسول Groq ببینید.

```bash
# فقط کافی است کلید رایگان Groq را داشته باشید:
export GROQ_API_KEY=gsk_...
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py dev     # توسعه | python agent.py start برای production
```

## گزینه‌ی جایگزین: گفتار لوکال فارسی (Speaches)

اگر بعداً گفتار فارسی و بدون وابستگی ابری خواستید: `SPEECH_PROVIDER=local` — سرور متن‌باز Speaches روی سرور خودتان (Whisper + Piper فارسی `fa_IR-amir`):

```bash
docker compose -f docker-compose.speech.yml up -d
curl -X POST http://localhost:8001/v1/models/Systran/faster-whisper-large-v3
curl -X POST http://localhost:8001/v1/models/speaches-ai/piper-fa_IR-amir-medium
```

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | — | از LiveKit Cloud (پلن رایگان) یا LiveKit سلف‌هاست |
| `ASSISTANT_INTERNAL_SECRET` | — | سکرت مشترک با جنگو (ابزارهای کاتالوگ) |
| `JMOVIE_API_BASE` | `http://localhost:8000` | آدرس بک‌اند جنگو |
| `SPEECH_PROVIDER` | `groq` | `groq` (ابری رایگان) یا `local` (Speaches) |
| `GROQ_API_KEY` | — | کلید پلن رایگان Groq (حالت ابری) |
| `ASSISTANT_LANGUAGE` | `en` در ابری / `fa` در لوکال | زبان مکالمه و شخصیت دستیار |
| `STT_MODEL` / `TTS_MODEL` / `TTS_VOICE` | وابسته به provider | بازنویسی مدل/صدا |
| `SPEECH_BASE_URL` | وابسته به provider | بازنویسی آدرس API گفتار |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | هر endpoint سازگار با OpenAI |
| `LLM_API_KEY` / `OPENROUTER_API_KEY` | — | کلید LLM |
| `LLM_MODEL` / `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | مدل دارای tool calling |

اگر متغیری ناقص باشد، ایجنت با پیام روشن متوقف می‌شود و حالت جعلی ساخته نمی‌شود. راهنمای کلی راه‌اندازی: `../docs/assistant/SETUP.md`
