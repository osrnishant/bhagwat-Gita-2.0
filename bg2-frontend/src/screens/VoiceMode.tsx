import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, History } from 'lucide-react'
import Orb from '../components/Orb'
import { useVoiceInput, type Lang } from '../hooks/useVoiceInput'
import { askArya, type AskResponse, type HistoryTurn, ApiError } from '../services/api'

const SESSION_KEY = 'arya_session_history'
const MAX_HISTORY_TURNS = 4  // 4 pairs = 8 messages to Claude

function loadHistory(): HistoryTurn[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(turns: HistoryTurn[]) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(turns)) } catch { /* ignore */ }
}

export default function VoiceMode() {
  const navigate = useNavigate()
  const [lang, setLang] = useState<Lang>('en-IN')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [history, setHistory] = useState<HistoryTurn[]>(loadHistory)

  const { transcript, isListening, supported, startListening, stopListening, clearTranscript } =
    useVoiceInput(lang)

  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript
  const wasListening = useRef(false)

  useEffect(() => {
    if (wasListening.current && !isListening) {
      const captured = transcriptRef.current.trim()
      if (captured) submit(captured)
    }
    wasListening.current = isListening
  }, [isListening]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(question: string) {
    if (!question.trim() || isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    setTextInput('')
    try {
      const apiLang = lang === 'hi-IN' ? 'hi' : 'en'
      const result: AskResponse = await askArya(question, apiLang, true, history)

      // Update conversation history (cap at MAX_HISTORY_TURNS pairs)
      const responseText = result.response_text.replace(/\nCITED:.*$/s, '').trim()
      const newHistory: HistoryTurn[] = [
        ...history,
        { role: 'user' as const, content: question },
        { role: 'assistant' as const, content: responseText },
      ].slice(-(MAX_HISTORY_TURNS * 2))

      setHistory(newHistory)
      saveHistory(newHistory)

      // Persist for Response screen crash recovery
      sessionStorage.setItem('arya_last_response', JSON.stringify({ question, result }))

      navigate('/response', { state: { question, result } })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `Server error (${err.status})`
          : 'Could not reach the server.'
      setError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-background text-cream flex flex-col overflow-hidden">
      {/* Header */}
      <header className="p-5 flex justify-between items-center">
        <button
          onClick={() => navigate('/history')}
          className="p-2 hover:bg-black/5 rounded-full transition-colors text-muted"
          aria-label="Chat history"
        >
          <History size={22} />
        </button>
        <p className="text-xs font-medium text-muted/50 tracking-widest uppercase">Arya</p>
        <button
          onClick={() => setLang(l => l === 'en-IN' ? 'hi-IN' : 'en-IN')}
          aria-label={lang === 'en-IN' ? 'Switch to Hindi' : 'Switch to English'}
          className="text-xs tracking-widest text-muted/60 hover:text-muted transition uppercase px-3 py-2 rounded-full hover:bg-black/5 min-h-[40px]"
        >
          {lang === 'en-IN' ? 'हिन्दी' : 'English'}
        </button>
      </header>

      {/* Conversation context indicator */}
      {history.length > 0 && !isSubmitting && (
        <div className="px-5 pb-1 flex items-center justify-between">
          <p className="text-xs text-muted/50">
            Continuing — {Math.floor(history.length / 2)} exchange{history.length > 2 ? 's' : ''} so far
          </p>
          <button
            onClick={() => { setHistory([]); saveHistory([]) }}
            className="text-xs text-muted/40 hover:text-muted transition"
          >
            Start fresh
          </button>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center relative px-6 pb-12">
        <AnimatePresence mode="wait">
          {isSubmitting ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="w-28 h-28 rounded-full border-t-2 border-r-2 border-gold"
              />
              <p className="font-serif text-xl italic text-muted">Arya is thinking…</p>
            </motion.div>
          ) : (
            <motion.div
              key="orb"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="flex flex-col items-center gap-12"
            >
              <Orb
                isListening={isListening}
                onPressStart={() => {
                  if (!supported || isSubmitting) return
                  setError(null)
                  clearTranscript()
                  startListening(lang)
                }}
                onPressEnd={() => stopListening()}
              />

              <div className="min-h-[3rem] text-center">
                <AnimatePresence mode="wait">
                  {transcript ? (
                    <motion.p
                      key="transcript"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-cream/80 font-light text-lg italic max-w-xs leading-relaxed"
                    >
                      "{transcript}"
                    </motion.p>
                  ) : (
                    <motion.p
                      key="hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-muted text-base font-light tracking-wide"
                    >
                      {isListening ? 'Listening…' : 'Hold to speak to Arya'}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {error && (
                <p className="text-error/80 text-sm text-center max-w-xs">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Text input */}
      {!isSubmitting && (
        <footer className="p-6 pb-8">
          <div className="w-full max-w-xl mx-auto">
            <div className="relative flex-1">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit(textInput)}
                placeholder="Or type to Arya…"
                aria-label="Type your message"
                className="w-full bg-surface border border-border rounded-full py-3.5 px-5 pr-12 focus:outline-none focus:border-gold/50 focus:shadow-card-hover transition-all text-cream placeholder:text-muted/50 text-sm shadow-card"
              />
              <button
                onClick={() => submit(textInput)}
                disabled={!textInput.trim()}
                aria-label="Send message"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gold disabled:text-muted/30 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
