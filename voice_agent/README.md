# ایجنت صوتی دستیار سینمایی (LiveKit Agents)

سرویس پایتون **مستقل از جنگو** که مکالمه‌ی صوتی فارسی را اجرا می‌کند:

```
کاربر → LiveKit → Azure STT (fa-IR) → LLM + ابزار کاتالوگ جنگو → Azure TTS (fa-IR) → کاربر
```

ابزارهای کاتالوگ (`search_movies`، `search_series`، `get_title_details`، `compare_titles`، `recommend_titles`، `search_similar_titles`) از مسیر `POST /ai/assistant/tool/` جنگو با هدر `X-Assistant-Secret` صدا زده می‌شوند؛ ایجنت هرگز مستقیم به دیتابیس وصل نمی‌شود و هیچ اطلاعاتی از خودش نمی‌سازد.

حالت‌های آواتار (idle/listening/thinking/speaking/idle) و کارت‌های پیشنهاد از دیتاچنل LiveKit (topic: `assistant`) برای فرانت ارسال می‌شوند. صدای خام کاربر لاگ یا ذخیره نمی‌شود.

## اجرا

```bash
cd voice_agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py dev     # توسعه | python agent.py start برای production
```

متغیرهای لازم (فقط env، نمونه در `backend/jmovie/.env.example`): `LIVEKIT_URL`، `LIVEKIT_API_KEY`، `LIVEKIT_API_SECRET`، `AZURE_SPEECH_KEY`، `AZURE_SPEECH_REGION`، `OPENROUTER_API_KEY`، `ASSISTANT_INTERNAL_SECRET` و در صورت نیاز `AZURE_TTS_VOICE`، `OPENROUTER_MODEL`، `JMOVIE_API_BASE`.

اگر متغیری ناقص باشد، ایجنت با پیام روشن متوقف می‌شود و حالت جعلی ساخته نمی‌شود. راهنمای گرفتن کلیدهای رایگان: `../docs/assistant/SETUP.md`
