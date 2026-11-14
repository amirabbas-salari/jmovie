import api from './api'

// ---------------------------------------------------------------------------
// API بک‌اند دستیار (توکن LiveKit / fallback متنی / وضعیت)
// سکرت LiveKit هرگز به فرانت نمی‌آید؛ فقط توکن کوتاه‌عمر اتاق برمی‌گردد.
// ---------------------------------------------------------------------------

export async function getAssistantStatus() {
  const { data } = await api.get('/ai/assistant/status/')
  return data
}

export async function getAssistantLiveKitToken(sessionId) {
  const { data } = await api.post('/ai/assistant/livekit-token/', {
    session_id: sessionId,
  })
  return data
}

export async function sendAssistantMessage(message) {
  const { data } = await api.post('/ai/assistant/message/', { message })
  return data
}

// ---------------------------------------------------------------------------
// حالت مرورگر (fallback رایگان): تشخیص گفتار و گفتار خودِ مرورگر (fa-IR)
// توجه: کیفیت/دسترسی به مرورگر و سیستم‌عامل بستگی دارد؛ Chrome دسکتاپ
// بهترین پشتیبانی را دارد. هیچ صدایی به سرور سایت ارسال نمی‌شود.
// ---------------------------------------------------------------------------

export function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function createPersianRecognizer({ onResult, onError, onEnd } = {}) {
  const Recognition = getSpeechRecognition()
  if (!Recognition) return null
  const recognition = new Recognition()
  recognition.lang = 'fa-IR'
  recognition.interimResults = true
  recognition.continuous = false
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    let interim = ''
    let finalText = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0]?.transcript || ''
      if (event.results[i].isFinal) finalText += transcript
      else interim += transcript
    }
    onResult?.({ interim, finalText })
  }
  recognition.onerror = (event) => onError?.(event.error || 'speech-error')
  recognition.onend = () => onEnd?.()
  return recognition
}

export function pickPersianVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith('fa')) ||
    voices.find((v) => v.lang?.toLowerCase().includes('fa')) ||
    null
  )
}

/**
 * خواندن متن فارسی با صدای مرورگر. تا پایان خواندن صبر می‌کند و در طول
 * صحبت، دامنه‌ی تقریبی دهان (برای لیپ‌سینک دامنه‌ای) را گزارش می‌دهد —
 * Web Speech دامنه‌ی واقعی صدا نمی‌دهد، پس این تقریب هجایی است.
 */
export function speakPersian(text, { onAmplitude, rate = 1 } = {}) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) {
      resolve(false)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickPersianVoice()
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang || 'fa-IR'
    utterance.rate = rate

    let timer = null
    const startFakeAmplitude = () => {
      let seed = 0
      timer = window.setInterval(() => {
        seed += 1
        // موج هجایی ساده: ترکیب دو سینوس + کمی تصادفی ملایم
        const v =
          0.45 +
          0.35 * Math.abs(Math.sin(seed * 1.7)) +
          0.2 * Math.abs(Math.sin(seed * 0.6 + 1.3))
        onAmplitude?.(Math.min(1, v))
      }, 70)
    }
    const stopFakeAmplitude = () => {
      if (timer) window.clearInterval(timer)
      timer = null
      onAmplitude?.(0)
    }
    utterance.onstart = startFakeAmplitude
    utterance.onend = () => {
      stopFakeAmplitude()
      resolve(true)
    }
    utterance.onerror = () => {
      stopFakeAmplitude()
      resolve(false)
    }
    window.speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

export function makeSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  }
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
