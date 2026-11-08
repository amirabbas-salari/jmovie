import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  ChevronDown,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'

import { sendAIMessage } from '../../services/ai'
import AIMessage from './AIMessage'

const suggestions = [
  {
    icon: '🎬',
    text: 'یک فیلم اکشن خوب پیشنهاد بده',
  },
  {
    icon: '📺',
    text: 'چند سریال جنایی جذاب معرفی کن',
  },
  {
    icon: '🔎',
    text: 'آیا Interstellar در JMovie هست؟',
  },
  {
    icon: '⭐',
    text: 'چند فیلم با امتیاز بالا پیشنهاد بده',
  },
]

const AIChat = ({ initialOpen = false }) => {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // --------------------------------------------------
  // Auto scroll
  // --------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages, loading])

  // --------------------------------------------------
  // Focus input when chat opens
  // --------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 150)
    }
  }, [isOpen])

  // --------------------------------------------------
  // Send message
  // --------------------------------------------------

  const handleSend = async (customMessage = null) => {
    const message = (customMessage ?? input).trim()

    if (!message || loading) {
      return
    }

    setInput('')
    setError(null)

    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: message,
      },
    ])

    setLoading(true)

    try {
      const data = await sendAIMessage({
        message,
        conversationId,
        sessionId,
      })

      if (data.conversation_id) {
        setConversationId(data.conversation_id)
      }

      if (data.session_id) {
        setSessionId(data.session_id)
      }

      setMessages(prev => [
        ...prev,
        {
            role: 'assistant',
            content: data.message,
            type: data.type ?? 'text',
            items: data.items ?? [],
            request: data.request ?? null,
        },
      ])
    } catch (err) {
      console.error('AI chat error:', err)

      setError(
        err.response?.data?.detail ||
        'خطایی در ارتباط با سرویس هوش مصنوعی رخ داد.'
      )
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------
  // Keyboard
  // --------------------------------------------------

  const handleKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  // --------------------------------------------------
  // New conversation
  // --------------------------------------------------

  const handleNewConversation = () => {
    setMessages([])
    setInput('')
    setConversationId(null)
    setSessionId(null)
    setError(null)

    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  // --------------------------------------------------
  // Closed state
  // --------------------------------------------------

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="باز کردن دستیار هوشمند"
        className="
          fixed bottom-24 right-6 z-[9999]
          flex h-14 w-14 items-center justify-center
          rounded-full
          border border-white/10
          bg-[#8b1e2d]
          text-white
          shadow-[0_10px_40px_rgba(139,30,45,0.35)]
          transition-all duration-300
          hover:scale-105
          hover:bg-[#a82536]
          active:scale-95
        "
      >
        <MessageCircle size={24} strokeWidth={2} />

        <span
          className="
            absolute -right-0.5 -top-0.5
            h-3.5 w-3.5
            rounded-full
            border-2 border-[#1A0B0C]
            bg-emerald-500
          "
        />
      </button>
    )
  }

  // --------------------------------------------------
  // Open state
  // --------------------------------------------------

  return (
    <div
      dir="rtl"
      className="
        fixed bottom-24 right-5 z-[9999]
        flex
        h-[min(700px,calc(100vh-40px))]
        w-[min(430px,calc(100vw-40px))]
        flex-col
        overflow-hidden
        rounded-[24px]
        border border-white/[0.08]
        bg-[#100809]
        text-white
        shadow-[0_25px_80px_rgba(0,0,0,0.55)]
        backdrop-blur-xl
        animate-in
        fade-in
        slide-in-from-bottom-4
        duration-300
      "
    >
      {/* ==================================================
          Header
      ================================================== */}

      <header
        className="
          relative
          flex
          items-center
          justify-between
          border-b border-white/[0.07]
          bg-[#150b0d]/95
          px-4
          py-3.5
        "
      >
        <div className="flex items-center gap-3">

          {/* AI Avatar */}

          <div
            className="
              relative
              flex h-10 w-10 shrink-0
              items-center justify-center
              rounded-xl
              bg-gradient-to-br
              from-[#a82536]
              to-[#641520]
              shadow-lg
            "
          >
            <Bot
              size={21}
              strokeWidth={1.8}
            />

            <span
              className="
                absolute
                bottom-0.5
                right-0.5
                h-2.5 w-2.5
                rounded-full
                border-2 border-[#150b0d]
                bg-emerald-500
              "
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold">
                JMovie AI
              </h2>

              <Sparkles
                size={13}
                className="text-[#d96a78]"
              />
            </div>

            <p className="mt-0.5 text-[11px] text-gray-500">
              دستیار هوشمند JMovie
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">

          {/* New conversation */}

          <button
            type="button"
            onClick={handleNewConversation}
            title="گفتگوی جدید"
            className="
              flex h-9 w-9
              items-center justify-center
              rounded-lg
              text-gray-500
              transition
              hover:bg-white/[0.06]
              hover:text-white
            "
          >
            <RotateCcw size={17} />
          </button>

          {/* Close */}

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title="بستن"
            className="
              flex h-9 w-9
              items-center justify-center
              rounded-lg
              text-gray-500
              transition
              hover:bg-white/[0.06]
              hover:text-white
            "
          >
            <X size={19} />
          </button>
        </div>
      </header>

      {/* ==================================================
          Messages
      ================================================== */}

      <main
        className="
          scrollbar-thin
          scrollbar-thumb-white/10
          scrollbar-track-transparent
          flex-1
          overflow-y-auto
          px-4
          py-5
        "
      >

        {/* ================= Welcome ================= */}

        {messages.length === 0 && !loading && (
          <div
            className="
              flex
              min-h-full
              flex-col
              items-center
              justify-center
              py-6
              text-center
            "
          >

            {/* Icon */}

            <div
              className="
                mb-5
                flex h-16 w-16
                items-center justify-center
                rounded-2xl
                border border-[#8b1e2d]/20
                bg-[#8b1e2d]/10
              "
            >
              <Sparkles
                size={28}
                className="text-[#c95264]"
                strokeWidth={1.7}
              />
            </div>

            <h3 className="text-lg font-semibold">
              سلام 👋
            </h3>

            <p
              className="
                mt-2
                max-w-[300px]
                text-xs
                leading-6
                text-gray-500
              "
            >
              من دستیار هوشمند JMovie هستم.
              <br />
              می‌تونم برای پیدا کردن یا انتخاب
              فیلم و سریال کمکت کنم.
            </p>

            {/* Suggestions */}

            <div className="mt-7 w-full space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSend(suggestion.text)}
                  className="
                    group
                    flex w-full
                    items-center
                    gap-3
                    rounded-xl
                    border border-white/[0.07]
                    bg-white/[0.025]
                    px-3.5
                    py-3
                    text-right
                    transition-all
                    hover:border-[#8b1e2d]/30
                    hover:bg-[#8b1e2d]/10
                  "
                >
                  <span
                    className="
                      flex h-8 w-8
                      shrink-0
                      items-center justify-center
                      rounded-lg
                      bg-white/[0.05]
                      text-sm
                      transition
                      group-hover:bg-[#8b1e2d]/15
                    "
                  >
                    {suggestion.icon}
                  </span>

                  <span
                    className="
                      text-xs
                      text-gray-400
                      transition
                      group-hover:text-gray-200
                    "
                  >
                    {suggestion.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= Messages ================= */}

        {messages.length > 0 && (
          <div className="space-y-5">


            {messages.map((message, index) => (
              <AIMessage
                key={index}
                message={message}
              />
            ))}


            {/* ================= Typing ================= */}

            {loading && (
              <div className="flex items-end justify-end gap-2">

                <div
                  className="
                    flex items-center
                    gap-1
                    rounded-2xl
                    rounded-bl-md
                    border border-white/[0.06]
                    bg-white/[0.055]
                    px-4
                    py-3.5
                  "
                >
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
                </div>

                <div
                  className="
                    flex h-7 w-7
                    items-center justify-center
                    rounded-lg
                    bg-[#8b1e2d]/15
                    text-[#c95264]
                  "
                >
                  <Bot
                    size={14}
                    strokeWidth={2}
                  />
                </div>
              </div>
            )}

            {/* ================= Error ================= */}

            {error && (
              <div
                className="
                  rounded-xl
                  border border-red-500/15
                  bg-red-500/[0.07]
                  px-3.5
                  py-3
                  text-xs
                  leading-6
                  text-red-300
                "
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* ==================================================
          Composer
      ================================================== */}

      <footer
        className="
          border-t border-white/[0.07]
          bg-[#12090a]/95
          p-3
        "
      >
        <div
          className="
            flex
            items-end
            gap-2
            rounded-2xl
            border border-white/[0.08]
            bg-white/[0.035]
            p-1.5
            transition
            focus-within:border-[#8b1e2d]/50
            focus-within:bg-white/[0.05]
          "
        >

          <textarea
            ref={textareaRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            placeholder="پیام خود را بنویسید..."
            className="
              max-h-32
              min-h-[42px]
              flex-1
              resize-none
              bg-transparent
              px-3
              py-2.5
              text-xs
              leading-6
              text-white
              outline-none
              placeholder:text-gray-600
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          />

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            aria-label="ارسال پیام"
            className="
              flex h-10 w-10
              shrink-0
              items-center justify-center
              rounded-xl
              bg-[#8b1e2d]
              text-white
              transition-all
              hover:bg-[#a82536]
              hover:shadow-[0_5px_20px_rgba(139,30,45,0.25)]
              active:scale-95
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            <Send
              size={17}
              strokeWidth={2}
            />
          </button>
        </div>

        <div
          className="
            mt-2
            flex
            items-center
            justify-center
            gap-1
            text-[9px]
            text-gray-600
          "
        >
          <span>Enter برای ارسال</span>
          <span>•</span>
          <span>Shift + Enter برای خط جدید</span>
        </div>
      </footer>
    </div>
  )
}

export default AIChat
