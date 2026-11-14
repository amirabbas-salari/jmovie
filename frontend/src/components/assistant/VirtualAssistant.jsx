import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Room, RoomEvent, Track } from 'livekit-client'
import {
  Bot,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Sparkles,
  Star,
  X,
} from 'lucide-react'

import AssistantAvatar from './AssistantAvatar'
import {
  createPersianRecognizer,
  getAssistantLiveKitToken,
  getAssistantStatus,
  getSpeechRecognition,
  makeSessionId,
  sendAssistantMessage,
  speakPersian,
  stopSpeaking,
} from '../../services/assistant'

// ---------------------------------------------------------------------------
// دستیار سینمایی مجازی (صوتی بلادرنگ فارسی + آواتار سه‌بعدی + کارت پیشنهاد)
//
// حالت‌ها:
// - livekit: مکالمه‌ی صوتی واقعی از طریق LiveKit و ایجنت پایتون (وقتی
//   سرور LiveKit کانفیگ شده باشد)؛ حالت آواتار و کارت‌ها از دیتاچنل
//   LiveKit می‌آیند و لیپ‌سینک با دامنه‌ی واقعی صدای ایجنت است.
// - browser: fallback رایگان مرورگر (تشخیص گفتار/گفتار خود مرورگر +
//   بک‌اند کاتالوگ بدون LLM). صدای کاربر در این حالت از سایت خارج
//   نمی‌شود (پردازش با خود مرورگر است).
//
// میکروفون فقط پس از کلیک صریح کاربر روشن می‌شود و هر لحظه قابل قطع است.
// ---------------------------------------------------------------------------

const STATE_LABELS = {
  idle: 'آماده‌ی گفتگو',
  listening: 'در حال گوش‌دادن…',
  thinking: 'در حال فکرکردن…',
  speaking: 'در حال صحبت…',
  error: 'خطایی رخ داد',
}

const GREETING =
  'سلام! من دستیار سینمایی مووی‌ورسم. بگو امشب چه حسی داری یا چه ژانری دوست داری تا از بین فیلم‌ها و سریال‌های سایت بهترین گزینه رو بهت پیشنهاد بدم.'

function TitleCard({ item }) {
  return (
    <Link
      to={item.url}
      className="group flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 transition hover:border-rose-400/40 hover:bg-white/[0.07]"
    >
      {item.poster_url ? (
        <img
          src={item.poster_url}
          alt={item.title}
          className="h-16 w-11 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[10px] text-slate-300">
          بدون پوستر
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-white group-hover:text-rose-200">
          {item.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300">
          {item.year ? <span>{item.year}</span> : null}
          {item.rating ? (
            <span className="inline-flex items-center gap-0.5 text-amber-300">
              <Star size={11} fill="currentColor" /> {Number(item.rating).toFixed(1)}
            </span>
          ) : null}
          <span>{item.media_type === 'series' ? 'سریال' : 'فیلم'}</span>
          {item.runtime ? <span>{item.runtime} دقیقه</span> : null}
          {item.seasons_count ? <span>{item.seasons_count} فصل</span> : null}
        </p>
        {item.genres?.length ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {item.genres.join('، ')}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

export default function VirtualAssistant() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('browser') // 'livekit' | 'browser'
  const [voiceState, setVoiceState] = useState('idle')
  const [connected, setConnected] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: GREETING, titles: [] },
  ])
  const [cards, setCards] = useState([])
  const [input, setInput] = useState('')
  const [liveCaption, setLiveCaption] = useState('')
  const [notice, setNotice] = useState('')
  const [avatarVideoActive, setAvatarVideoActive] = useState(false)

  const sessionIdRef = useRef(makeSessionId())
  const roomRef = useRef(null)
  const videoContainerRef = useRef(null)
  const recognizerRef = useRef(null)
  const amplitudeRef = useRef(0)
  const audioCtxRef = useRef(null)
  const ampRafRef = useRef(0)
  const stateTimerRef = useRef(null)
  const scrollRef = useRef(null)
  const hasSpeechRecognition = Boolean(getSpeechRecognition())

  const setStateSafe = useCallback((next) => {
    setVoiceState(next)
    if (stateTimerRef.current) window.clearTimeout(stateTimerRef.current)
    if (next === 'error') {
      stateTimerRef.current = window.setTimeout(() => setVoiceState('idle'), 2600)
    }
  }, [])

  // وضعیت سرور: آیا حالت صوتی LiveKit فعال است یا fallback مرورگر؟
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getAssistantStatus()
      .then((data) => {
        if (cancelled) return
        if (data?.livekit_configured) {
          setMode('livekit')
          setNotice('حالت گفتگوی صوتی زنده فعال است؛ برای شروع، «شروع مکالمه» را بزن.')
        } else {
          setMode('browser')
          setNotice(
            hasSpeechRecognition
              ? 'حالت مرورگر فعال است: با دکمه‌ی میکروفون فارسی صحبت کن یا بنویس.'
              : 'این مرورگر تشخیص گفتار ندارد؛ می‌توانی بنویسی و پاسخ را متنی ببینی.',
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMode('browser')
          setNotice('حالت مرورگر فعال است (سرور صوتی در دسترس نیست).')
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, hasSpeechRecognition])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, cards, liveCaption, open])

  const pushMessage = useCallback((role, text, titles = []) => {
    setMessages((prev) => [...prev.slice(-24), { role, text, titles }])
  }, [])

  const stopAmplitudeLoop = useCallback(() => {
    if (ampRafRef.current) cancelAnimationFrame(ampRafRef.current)
    ampRafRef.current = 0
    amplitudeRef.current = 0
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [])

  const startAmplitudeLoop = useCallback(
    (mediaStreamTrack) => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx || !mediaStreamTrack) return
        const ctx = new Ctx()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(new MediaStream([mediaStreamTrack]))
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i += 1) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          amplitudeRef.current = Math.min(1, rms * 4.2)
          ampRafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        /* لیپ‌سینک دامنه‌ای best-effort است؛ نبودنش مکالمه را قطع نمی‌کند */
      }
    },
    [],
  )

  // ---------------- حالت LiveKit ----------------

  const endLiveKit = useCallback(async () => {
    stopAmplitudeLoop()
    if (videoContainerRef.current) videoContainerRef.current.replaceChildren()
    setAvatarVideoActive(false)
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect()
      } catch {
        /* قطع اتصال نباید خطای نمایشی بدهد */
      }
      roomRef.current = null
    }
    setConnected(false)
    setMicOn(false)
    setStateSafe('idle')
  }, [setStateSafe, stopAmplitudeLoop])

  const startLiveKit = useCallback(async () => {
    setNotice('')
    setStateSafe('thinking')
    try {
      const { token, url } = await getAssistantLiveKitToken(sessionIdRef.current)
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const text = new TextDecoder().decode(payload)
          const data = JSON.parse(text)
          if (data.type === 'assistant_state' && STATE_LABELS[data.state]) {
            setStateSafe(data.state)
          } else if (data.type === 'assistant_avatar' && data.mode === '3d') {
            // ایجنت گفته چهره‌ی ویدیویی ندارد؛ آواتار سه‌بعدی می‌ماند
            setAvatarVideoActive(false)
          } else if (data.type === 'assistant_cards' && Array.isArray(data.titles)) {
            setCards(data.titles)
          }
        } catch {
          /* پیام‌های غیر JSON دیتاچنل نادیده گرفته می‌شوند */
        }
      })

      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const text = segments.map((s) => s.text).join(' ').trim()
        if (!text) return
        const isAgent = (participant?.identity || '').startsWith('agent')
        if (segments.every((s) => s.final)) {
          pushMessage(isAgent ? 'assistant' : 'user', text)
          setLiveCaption('')
        } else if (!isAgent) {
          setLiveCaption(text)
        }
      })

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          // چهره‌ی ویدیویی زنده (مثل Tavus) روی آواتار سه‌بعدی می‌نشیند
          const container = videoContainerRef.current
          if (container) {
            const el = track.attach()
            el.style.width = '100%'
            el.style.height = '100%'
            el.style.objectFit = 'cover'
            container.replaceChildren(el)
            setAvatarVideoActive(true)
          }
          return
        }
        if (track.kind === Track.Kind.Audio) {
          // صدای گوینده (ایجنت یا شرکت‌کننده‌ی آواتار) — هر ترک صوتی راه دور
          const el = track.attach()
          el.style.display = 'none'
          document.body.appendChild(el)
          if (track.mediaStreamTrack) startAmplitudeLoop(track.mediaStreamTrack)
        }
      })

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          track.detach()
          if (videoContainerRef.current) videoContainerRef.current.replaceChildren()
          setAvatarVideoActive(false)
        }
      })

      room.on(RoomEvent.Disconnected, () => {
        setConnected(false)
        setMicOn(false)
        setStateSafe('idle')
      })

      await room.connect(url, token)
      // میکروفون فقط بعد از اقدام صریح کاربر (همین کلیک) روشن می‌شود
      await room.localParticipant.setMicrophoneEnabled(true)
      setConnected(true)
      setMicOn(true)
      setStateSafe('listening')
      setNotice('مکالمه شروع شد؛ فارسی صحبت کن. هر وقت خواستی میکروفون را قطع یا مکالمه را تمام کن.')
    } catch {
      await endLiveKit()
      setStateSafe('error')
      setMode('browser')
      setNotice(
        'اتصال صوتی برقرار نشد (ممکن است ایجنت صوتی خاموش باشد یا اجازه‌ی میکروفون داده نشده باشد). حالت مرورگر فعال شد؛ می‌توانی بنویسی یا با میکروفون مرورگر صحبت کنی.',
      )
    }
  }, [endLiveKit, pushMessage, setStateSafe, startAmplitudeLoop])

  const toggleLiveKitMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !micOn
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicOn(next)
      setStateSafe(next ? 'listening' : 'idle')
    } catch {
      setStateSafe('error')
    }
  }, [micOn, setStateSafe])

  // ---------------- حالت مرورگر ----------------

  const stopBrowserMic = useCallback(() => {
    try {
      recognizerRef.current?.stop()
    } catch {
      /* قبلاً متوقف شده */
    }
    recognizerRef.current = null
    setMicOn(false)
  }, [])

  const askBrowserBrain = useCallback(
    async (text) => {
      const clean = (text || '').trim()
      if (!clean) return
      pushMessage('user', clean)
      setStateSafe('thinking')
      amplitudeRef.current = 0
      try {
        const data = await sendAssistantMessage(clean)
        setCards(data.titles || [])
        pushMessage('assistant', data.reply, data.titles || [])
        setStateSafe('speaking')
        await speakPersian(data.reply, {
          onAmplitude: (v) => {
            amplitudeRef.current = v
          },
        })
        amplitudeRef.current = 0
        setStateSafe('idle')
      } catch {
        setStateSafe('error')
        pushMessage('assistant', 'الان نتونستم جواب بدم؛ چند لحظه‌ی دیگه دوباره امتحان کن.')
      }
    },
    [pushMessage, setStateSafe],
  )

  const startBrowserMic = useCallback(() => {
    if (!hasSpeechRecognition) {
      setNotice('این مرورگر تشخیص گفتار فارسی ندارد؛ لطفاً بنویس یا از Chrome استفاده کن.')
      return
    }
    stopSpeaking()
    amplitudeRef.current = 0
    const recognition = createPersianRecognizer({
      onResult: ({ interim, finalText }) => {
        setLiveCaption(finalText || interim)
        if (finalText) {
          setLiveCaption('')
          stopBrowserMic()
          askBrowserBrain(finalText)
        }
      },
      onError: (error) => {
        stopBrowserMic()
        setStateSafe('error')
        setNotice(
          error === 'not-allowed'
            ? 'اجازه‌ی میکروفون داده نشد. از تنظیمات مرورگر اجازه بده یا متنی بنویس.'
            : 'تشخیص گفتار ناموفق بود؛ دوباره تلاش کن یا بنویس.',
        )
      },
      onEnd: () => {
        setMicOn(false)
        recognizerRef.current = null
        setVoiceState((prev) => (prev === 'listening' ? 'idle' : prev))
      },
    })
    if (!recognition) return
    recognizerRef.current = recognition
    try {
      recognition.start()
      setMicOn(true)
      setStateSafe('listening')
      setNotice('در حال گوش‌دادن… فارسی صحبت کن.')
    } catch {
      setStateSafe('error')
    }
  }, [askBrowserBrain, hasSpeechRecognition, setStateSafe, stopBrowserMic])

  // ---------------- اقدامات عمومی ----------------

  const handleStart = () => {
    if (mode === 'livekit') startLiveKit()
    else startBrowserMic()
  }

  const handleMicToggle = () => {
    if (mode === 'livekit' && connected) {
      toggleLiveKitMic()
    } else if (micOn) {
      stopBrowserMic()
      setStateSafe('idle')
    } else {
      startBrowserMic()
    }
  }

  const handleEnd = async () => {
    stopSpeaking()
    stopBrowserMic()
    await endLiveKit()
    setLiveCaption('')
    setNotice('مکالمه تمام شد. هر وقت خواستی دوباره شروع کن.')
  }

  const handleSendText = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (mode === 'livekit' && connected) {
      // در حالت صوتی زنده هم تایپ‌کردن ممکن است: از مغز متنی استفاده می‌شود
      // تا کاربر مجبور به صحبت‌کردن نباشد.
      await askBrowserBrain(text)
    } else {
      await askBrowserBrain(text)
    }
  }

  useEffect(
    () => () => {
      stopSpeaking()
      stopBrowserMic()
      endLiveKit()
    },
    [endLiveKit, stopBrowserMic],
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="باز کردن دستیار سینمایی مجازی"
        className="fixed bottom-6 left-6 z-[9999] flex h-14 items-center gap-2 rounded-full border border-white/10 bg-[#8b1e2d] px-4 text-white shadow-[0_10px_40px_rgba(139,30,45,0.35)] transition-all duration-300 hover:scale-105 hover:bg-[#a82536] active:scale-95"
      >
        <Sparkles size={22} />
        <span className="hidden text-sm font-bold sm:inline">دستیار سینمایی</span>
        <span className="absolute -left-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#08040d] bg-emerald-500" />
      </button>
    )
  }

  return (
    <section
      dir="rtl"
      aria-label="دستیار سینمایی مجازی"
      className="fixed bottom-6 left-6 z-[9999] flex max-h-[min(88vh,760px)] w-[min(92vw,392px)] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0a14]/95 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      {/* سربرگ */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8b1e2d] text-white">
            <Bot size={19} />
          </span>
          <div>
            <p className="text-sm font-black">دستیار سینمایی مووی‌ورس</p>
            <p className="text-[11px] text-slate-400">
              {mode === 'livekit' ? 'گفتگوی صوتی زنده (LiveKit)' : 'حالت مرورگر (رایگان)'} •{' '}
              {STATE_LABELS[voiceState]}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="بستن دستیار"
          className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </header>

      {/* آواتار */}
      <div className="relative h-52 shrink-0 bg-[radial-gradient(circle_at_50%_30%,rgba(139,30,45,0.35),rgba(13,10,20,0.2)_60%)]">
        <AssistantAvatar state={voiceState} amplitudeRef={amplitudeRef} />
        {/* چهره‌ی ویدیویی زنده (Tavus) — وقتی ترک ویدیو برسد روی آواتار سه‌بعدی می‌آید */}
        <div
          ref={videoContainerRef}
          className={`absolute inset-0 ${avatarVideoActive ? '' : 'hidden'}`}
          aria-hidden={!avatarVideoActive}
        />
        <span
          className={`absolute bottom-3 right-1/2 translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold ${
            voiceState === 'error'
              ? 'bg-red-500/20 text-red-200'
              : voiceState === 'listening'
                ? 'bg-emerald-500/20 text-emerald-200'
                : voiceState === 'speaking'
                  ? 'bg-rose-500/20 text-rose-100'
                  : 'bg-white/10 text-slate-200'
          }`}
        >
          {STATE_LABELS[voiceState]}
        </span>
      </div>

      {/* متن مکالمه و کارت‌ها */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((msg, index) => (
          <div key={index} className={msg.role === 'user' ? 'text-left' : 'text-right'}>
            <div
              className={`inline-block max-w-[92%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-6 ${
                msg.role === 'user'
                  ? 'bg-[#8b1e2d] text-white'
                  : 'border border-white/10 bg-white/[0.05] text-slate-100'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {cards.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-400">پیشنهادها از آرشیو مووی‌ورس:</p>
            {cards.map((item) => (
              <TitleCard key={`${item.media_type}-${item.id}`} item={item} />
            ))}
          </div>
        )}

        {liveCaption && (
          <p className="rounded-xl bg-white/5 px-3 py-2 text-[12px] text-slate-300">
            داری می‌گی: {liveCaption}
          </p>
        )}
        {notice && <p className="text-[11px] leading-5 text-amber-200/90">{notice}</p>}
      </div>

      {/* کنترل‌ها */}
      <footer className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="mb-3 flex items-center justify-center gap-2.5">
          {!connected ? (
            <button
              type="button"
              onClick={handleStart}
              className="flex items-center gap-2 rounded-full bg-[#8b1e2d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#a82536] active:scale-95"
            >
              <Mic size={17} />
              {mode === 'livekit' ? 'شروع مکالمه‌ی صوتی' : 'صحبت کن'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleMicToggle}
                aria-label={micOn ? 'قطع میکروفون' : 'وصل میکروفون'}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95 ${
                  micOn
                    ? 'bg-emerald-500/90 text-white hover:bg-emerald-500'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                {micOn ? <Mic size={19} /> : <MicOff size={19} />}
              </button>
              <button
                type="button"
                onClick={handleEnd}
                className="flex items-center gap-2 rounded-full bg-red-500/90 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 active:scale-95"
              >
                <PhoneOff size={16} /> پایان مکالمه
              </button>
            </>
          )}
          {(micOn || voiceState === 'speaking' || voiceState === 'listening') && (
            <button
              type="button"
              onClick={handleEnd}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2.5 text-xs font-bold text-slate-100 transition hover:bg-white/20"
            >
              <PhoneOff size={14} /> پایان
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendText()
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="یا بنویس: یه فیلم معمایی خوب پیشنهاد بده…"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[13px] text-white outline-none placeholder:text-slate-500 focus:border-rose-400/50"
          />
          <button
            type="submit"
            aria-label="ارسال پیام"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8b1e2d] text-white transition hover:bg-[#a82536] active:scale-95"
          >
            <Send size={16} className="-scale-x-100" />
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">
          پیشنهادها فقط از آرشیو واقعی مووی‌ورس می‌آیند؛ بدون اجازه‌ی تو میکروفون روشن نمی‌شود.
        </p>
      </footer>
    </section>
  )
}
