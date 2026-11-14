# دستیار سینمایی مجازی مووی‌ورس

دستیار صوتی بلادرنگ فارسی برای پیشنهاد و معرفی فیلم/سریال از **آرشیو واقعی سایت**، همراه با آواتار سه‌بعدی و کارت‌های پیشنهاد داخل سایت.

## حالت‌های اجرا

| حالت | چطور فعال می‌شود | اجزا |
|---|---|---|
| **گفتگوی صوتی زنده (اصلی)** | وقتی `LIVEKIT_*` در بک‌اند ست شده و ایجنت صوتی در حال اجراست | LiveKit (WebRTC) + ایجنت پایتون + گفتار ابری LiveKit Inference (Deepgram + Cartesia) + LLM |
| **مرورگر (fallback رایگان)** | همیشه، وقتی حالت زنده در دسترس نیست | تشخیص گفتار/گفتار خود مرورگر + مغز مکالمه‌ی کاتالوگی جنگو (بدون LLM و بدون هزینه) |

در حالت مرورگر هیچ صدایی به سرور سایت ارسال نمی‌شود و پاسخ‌ها فقط از دیتابیس واقعی سایت ساخته می‌شوند؛ هیچ امتیاز/بازیگر/جزئیاتی ساخته نمی‌شود.

## معماری

```
مرورگر (React + three.js آواتار + livekit-client)
   │  ▲
   │  │ توکن کوتاه‌عمر (فقط اتاق خودش)
   ▼  │
جنگو  /ai/assistant/livekit-token/   صدور توکن LiveKit (سکرت هرگز به فرانت نمی‌رود)
      /ai/assistant/message/         fallback متنی/مرورگری
      /ai/assistant/tool/            اجرای ابزار کاتالوگ برای ایجنت (فقط با هدر سکرت داخلی)
      /ai/assistant/status/          تشخیص حالت فعال توسط فرانت
   ▲
   │ HTTP + X-Assistant-Secret
ایجنت صوتی (voice_agent/agent.py — LiveKit Agents، مستقل از جنگو)
   میکروفون → STT ابری (LiveKit Inference) → LLM (ابزارها) → TTS ابری (LiveKit Inference) → صدا
```

- **ابزارهای کاتالوگ** (`backend/jmovie/ai/assistant_tools.py`): `search_movies`، `search_series`، `get_title_details`، `compare_titles`، `recommend_titles`، `search_similar_titles` — همه روی مدل‌های واقعی `Movie`/`Series` و فقط آثار فعال (`is_active=True`). LLM هرگز مستقیم به دیتابیس وصل نمی‌شود.
- **کارت‌های پیشنهاد**: خروجی ابزارها شامل `slug` و `url` صفحه‌ی جزئیات موجود سایت (`/movie/:slug` و `/series/:slug`) است؛ در حالت زنده از دیتاچنل LiveKit و در حالت مرورگر از پاسخ HTTP می‌رسد و در ویجت رندر می‌شود.
- **آواتار و حالت‌ها**: وضعیت واقعی ایجنت (idle/listening/thinking/speaking) از رویدادهای LiveKit Agents روی دیتاچنل با topic `assistant` ارسال می‌شود (`{"type":"assistant_state","state":"..."}` و `{"type":"assistant_cards","titles":[...]}`).

## آواتار و لیپ‌سینک

- رندر با three.js (`frontend/src/components/assistant/AssistantAvatar.jsx`).
- لیپ‌سینک **دامنه‌ای** است: دامنه‌ی صدای خروجی (Web Audio `AnalyserNode` روی ترک صوتی ایجنت؛ در حالت مرورگر تقریب هجایی از خود گفتار مرورگر) دهان را باز/بسته می‌کند.
- اگر فایل `frontend/public/models/avatar.glb` موجود باشد و Morph Target دهان/فک (مثل `mouthOpen`، `jawOpen`، `viseme_aa`) داشته باشد، همان مدل لود و مورف‌ها رانده می‌شوند؛ وگرنه آواتار رویه‌ای داخلی رندر می‌شود. اسناد منبع/لایسنس مدل را در `ASSET_LICENSES.md` ثبت کنید.
- لیپ‌سینک viseme دقیق (مثل NVIDIA Audio2Face) در این پروتوتایپ نیست؛ مسیر ارتقا در همان فایل مستند شده است.

## محدودیت‌های آگاهانه‌ی پروتوتایپ

- پلن‌های رایگان سقف دارند: LiveKit Cloud Build سهمیه‌ی ماهانه و اعتبار Inference محدود (۲٫۵۰ دلار در ماه ≈ ۵۰ دقیقه مکالمه) می‌دهد — برای پروتوتایپ مناسب است، نه ترافیک بالا.
- صدای ابری پیش‌فرض (Cartesia) انگلیسی است و مکالمه در حالت زنده انگلیسی انجام می‌شود؛ گفتار فارسی با گزینه‌ی لوکال Speaches/Piper (`SPEECH_PROVIDER=local`) ممکن است. در حالت مرورگر، کیفیت به مرورگر کاربر وابسته است.
- حافظه‌ی مکالمه داخل همان جلسه‌ی LiveKit/صفحه است و بین بازدیدها ذخیره نمی‌شود.

## فایل‌ها

- بک‌اند: `backend/jmovie/ai/assistant_tools.py`، `assistant_brain.py`، `assistant_views.py`، تست‌ها در `ai/test_assistant.py`
- فرانت: `frontend/src/components/assistant/` و `frontend/src/services/assistant.js`
- ایجنت: `voice_agent/agent.py` (اجرا و پیش‌نیازها: `voice_agent/README.md`)
- راه‌اندازی کلیدهای رایگان: `SETUP.md`
