import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, History } from 'lucide-react'
import Orb from '../components/Orb'
import { useVoiceInput, type Lang } from '../hooks/useVoiceInput'
import { askKrishna, type AskResponse, ApiError } from '../services/api'

export default function VoiceMode() {
  const navigate = useNavigate()
  const [lang, setLang] = useState<Lang>('en-IN')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')

  const { transcript, isListening, supported, startListening, stopListening, clearTranscript } =
    useVoiceInput(lang)

  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript
  const wasListening = useRef(false)

  // Auto-submit when speech ends
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
      const result: AskResponse = await askKrishna(question, apiLang, true)
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
      <header className="p-6 flex justify-between items-center z-10">
        <button
          onClick={() => navigate('/history')}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted"
          aria-label="History"
        >
          <History size={24} />
        </button>
        <button
          onClick={() => setLang(l => l === 'en-IN' ? 'hi-IN' : 'en-IN')}
          className="text-xs tracking-widest text-muted/60 hover:text-muted transition uppercase"
        >
          {lang === 'en-IN' ? 'हिन्दी' : 'English'}
        </button>
      </header>

      {/* Main — orb or processing */}
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
                className="w-32 h-32 rounded-full border-t-2 border-r-2 border-gold"
              />
              <p className="font-serif text-xl italic text-gold">Krishna is reflecting…</p>
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

              {/* Status / transcript */}
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
                      className="text-muted text-lg font-light tracking-wide"
                    >
                      {isListening ? 'Listening…' : 'Hold to speak to Krishna'}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Error */}
              {error && (
                <p className="text-error/70 text-sm text-center max-w-xs">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Text input bar */}
      {!isSubmitting && (
        <footer className="p-8 bg-gradient-to-t from-background to-transparent">
          <div className="w-full max-w-xl mx-auto flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit(textInput)}
                placeholder="Or type your question here…"
                className="w-full bg-white/5 border border-white/10 rounded-full py-4 px-6 pr-14 focus:outline-none focus:border-gold/50 transition-all text-cream placeholder:text-muted/50"
              />
              <button
                onClick={() => submit(textInput)}
                disabled={!textInput.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gold disabled:text-muted/30 transition-colors"
              >
                <Send size={22} />
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
