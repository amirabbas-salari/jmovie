# ایجنت صوتی دستیار سینمایی (LiveKit Agents)

سرویس پایتون **مستقل از جنگو** که مکالمه‌ی صوتی فارسی را اجرا می‌کند:

```
کاربر → LiveKit → STT (Whisper لوکال) → LLM + ابزار کاتالوگ جنگو → TTS (Piper فارسی لوکال) → کاربر
```

ابزارهای کاتالوگ (`search_movies`، `search_series`، `get_title_details`، `compare_titles`، `recommend_titles`، `search_similar_titles`) از مسیر `POST /ai/assistant/tool/` جنگو با هدر `X-Assistant-Secret` صدا زده می‌شوند؛ ایجنت هرگز مستقیم به دیتابیس وصل نمی‌شود و هیچ اطلاعاتی از خودش نمی‌سازد.

حالت‌های آواتار (idle/listening/thinking/speaking) و کارت‌های پیشنهاد از دیتاچنل LiveKit (topic: `assistant`) برای فرانت ارسال می‌شوند. صدای خام کاربر لاگ یا ذخیره نمی‌شود.

## پشته‌ی گفتار: کاملاً رایگان و لوکال (Speaches)

هیچ سرویس ابری برای صدا لازم نیست. یک سرور **Speaches** (متن‌باز) هر دو جهت گفتار را پشت API سازگار با OpenAI می‌دهد:

- **شنیدن (STT):** ‏faster-whisper — چندزبانه است و فارسی را هم transcribe می‌کند (`STT_LANGUAGE=fa`)
- **صحبت‌کردن (TTS):** ‏Piper با صدای فارسی `fa_IR-amir` — یا Kokoro انگلیسی (`TTS_MODEL=speaches-ai/Kokoro-82M-v1.0-ONNX`، `TTS_VOICE=af_heart`)

```bash
# ۱) سرور گفتار (Docker)
docker compose -f docker-compose.speech.yml up -d

# ۲) دانلود مدل‌ها (فقط بار اول)
curl -X POST http://localhost:8001/v1/models/Systran/faster-whisper-large-v3
curl -X POST http://localhost:8001/v1/models/speaches-ai/piper-fa_IR-amir-medium
curl http://localhost:8001/v1/models   # بررسی نصب مدل‌ها

# ۳) خود ایجنت
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py dev     # توسعه | python agent.py start برای production
```

روی CPU هم کار می‌کند (برای پروتوتایپ کافی است)؛ برای کیفیت/سرعت بهتر مدل STT را می‌توانید `Systran/faster-whisper-large-v3-turbo` یا مدل کوچک‌تر (`small`/`medium`) بگذارید. اگر مدل/صدایی را عوض کردید، اول با `curl http://localhost:8001/v1/models` از نصبش مطمئن شوید.

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | — | از LiveKit Cloud (پلن رایگان) یا LiveKit سلف‌هاست |
| `ASSISTANT_INTERNAL_SECRET` | — | سکرت مشترک با جنگو (ابزارهای کاتالوگ) |
| `JMOVIE_API_BASE` | `http://localhost:8000` | آدرس بک‌اند جنگو |
| `SPEECH_BASE_URL` | `http://localhost:8001/v1` | آدرس سرور گفتار Speaches |
| `STT_MODEL` | `Systran/faster-whisper-large-v3` | مدل Whisper |
| `STT_LANGUAGE` | `fa` | زبان شنیدن |
| `TTS_MODEL` | `speaches-ai/piper-fa_IR-amir-medium` | مدل صحبت‌کردن |
| `TTS_VOICE` | `amir` | صدای مدل TTS |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | هر endpoint سازگار با OpenAI (مثلاً Ollama لوکال: `http://localhost:11434/v1`) |
| `LLM_API_KEY` / `OPENROUTER_API_KEY` | — | کلید LLM (برای سرور لوکال لازم نیست) |
| `LLM_MODEL` / `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | مدل دارای tool calling |

اگر متغیری ناقص باشد، ایجنت با پیام روشن متوقف می‌شود و حالت جعلی ساخته نمی‌شود؛ اگر سرور گفتار بالا نباشد فقط هشدار لاگ می‌شود. راهنمای کلی راه‌اندازی: `../docs/assistant/SETUP.md`
