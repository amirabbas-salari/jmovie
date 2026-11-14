# ایجنت صوتی دستیار سینمایی (LiveKit Agents)

سرویس پایتون **مستقل از جنگو** که مکالمه‌ی صوتی بلادرنگ را اجرا می‌کند:

```
کاربر → LiveKit → STT ابری (LiveKit Inference) → LLM + ابزار کاتالوگ جنگو → TTS ابری (LiveKit Inference) → کاربر
```

ابزارهای کاتالوگ (`search_movies`، `search_series`، `get_title_details`، `compare_titles`، `recommend_titles`، `search_similar_titles`) از مسیر `POST /ai/assistant/tool/` جنگو با هدر `X-Assistant-Secret` صدا زده می‌شوند؛ ایجنت هرگز مستقیم به دیتابیس وصل نمی‌شود و هیچ اطلاعاتی از خودش نمی‌سازد.

حالت‌های آواتار (idle/listening/thinking/speaking) و کارت‌های پیشنهاد از دیتاچنل LiveKit (topic: `assistant`) برای فرانت ارسال می‌شوند. صدای خام کاربر لاگ یا ذخیره نمی‌شود.

## پشته‌ی گفتار: LiveKit Inference — پیش‌فرض

هیچ حساب یا کلید سومی لازم نیست؛ گفتار با همان کلیدهای LiveKit Cloud شما کار می‌کند و مدل‌ها را LiveKit میزبانی می‌کند:

- **شنیدن (STT):** ‏`deepgram/nova-3`
- **صحبت‌کردن (TTS):** ‏`cartesia/sonic-3` (انگلیسی؛ زبان مکالمه هم انگلیسی می‌شود)

در پلن رایگان **Build** ماهانه ۲٫۵۰ دلار اعتبار Inference هست (تقریباً ۵۰ دقیقه مکالمه) و وقتی تمام شود درخواست‌ها متوقف می‌شوند — هزینه‌ی غافلگیرکننده ندارد. مدل‌ها فقط با env عوض می‌شوند (مثلاً `STT_MODEL=assemblyai/universal-streaming` یا `TTS_MODEL=inworld/inworld-tts-1.5-max`).

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py dev     # توسعه | python agent.py start برای production
```

## گزینه‌های جایگزین

- **Groq** (`SPEECH_PROVIDER=groq`): پلن Free ‏Groq با `GROQ_API_KEY` — شنیدن با `whisper-large-v3-turbo` و صحبت‌کردن با Orpheus انگلیسی.
- **لوکال فارسی** (`SPEECH_PROVIDER=local`): سرور متن‌باز Speaches روی سرور خودتان با Piper فارسی (`fa_IR-amir`) و مکالمه‌ی فارسی:

```bash
docker compose -f docker-compose.speech.yml up -d
curl -X POST http://localhost:8001/v1/models/Systran/faster-whisper-large-v3
curl -X POST http://localhost:8001/v1/models/speaches-ai/piper-fa_IR-amir-medium
```

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | — | از LiveKit Cloud (پلن رایگان) یا LiveKit سلف‌هاست؛ برای گفتار Inference هم همان‌ها کافی‌اند |
| `ASSISTANT_INTERNAL_SECRET` | — | سکرت مشترک با جنگو (ابزارهای کاتالوگ) |
| `JMOVIE_API_BASE` | `http://localhost:8000` | آدرس بک‌اند جنگو |
| `SPEECH_PROVIDER` | `livekit` | `livekit` (Inference) یا `groq` یا `local` |
| `STT_MODEL` / `TTS_MODEL` / `TTS_VOICE` | وابسته به provider | بازنویسی مدل/صدا |
| `ASSISTANT_LANGUAGE` | `en` (ابری) / `fa` (لوکال) | زبان مکالمه و شخصیت دستیار |
| `GROQ_API_KEY` | — | فقط برای `SPEECH_PROVIDER=groq` |
| `SPEECH_BASE_URL` | وابسته به provider | فقط برای providerهای OpenAI-compatible |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | هر endpoint سازگار با OpenAI |
| `LLM_API_KEY` / `OPENROUTER_API_KEY` | — | کلید LLM |
| `LLM_MODEL` / `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | مدل دارای tool calling |

اگر متغیری ناقص باشد، ایجنت با پیام روشن متوقف می‌شود و حالت جعلی ساخته نمی‌شود. راهنمای کلی راه‌اندازی: `../docs/assistant/SETUP.md`
