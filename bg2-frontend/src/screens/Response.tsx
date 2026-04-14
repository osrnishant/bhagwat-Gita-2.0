import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronDown, BookOpen, Send, Mic } from 'lucide-react'
import Orb from '../components/Orb'
import AudioPlayer from '../components/AudioPlayer'
import { askAryaStream, type AskResponse, type VerseResult, type HistoryTurn, ApiError } from '../services/api'
import { saveEntry } from '../hooks/useHistory'
import { useVoiceInput } from '../hooks/useVoiceInput'

const SESSION_KEY = 'arya_session_history'
const MAX_HISTORY_TURNS = 4

function loadHistory(): HistoryTurn[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(turns: HistoryTurn[]) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(turns)) } catch {}
}

interface LocationState {
  question: string
  // Streaming mode (new path from VoiceMode)
  streaming?: boolean
  language?: 'en' | 'hi'
  history?: HistoryTurn[]
  // Legacy mode (crash recovery via sessionStorage)
  result?: AskResponse
}

export default function Response() {
  const navigate = useNavigate()
  const location = useLocation()

  // Recover from crash/refresh via localStorage
  const state: LocationState | null = location.state as LocationState | null ?? (() => {
    try {
      const raw = localStorage.getItem('arya_last_response')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()

  // ── Display state ────────────────────────────────────────────────────────────
  const [displayText, setDisplayText] = useState(() => {
    if (!state?.streaming && state?.result) {
      return state.result.response_text.replace(/\nCITED:.*$/s, '').trim()
    }
    return ''
  })
  const [verses, setVerses] = useState<VerseResult[]>(() =>
    (!state?.streaming && state?.result?.verses) ? state.result.verses : []
  )
  const [currentQuestion, setCurrentQuestion] = useState(state?.question ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)

  // ── Audio (legacy / non-streaming only) ─────────────────────────────────────
  const hasAudio = Boolean(!state?.streaming && state?.result?.audio_url)
  const [isPlaying, setIsPlaying] = useState(hasAudio)
  const [showText, setShowText] = useState(!hasAudio)

  // ── Follow-up input ──────────────────────────────────────────────────────────
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Voice input ──────────────────────────────────────────────────────────────
  const currentLanguage = useRef<'en' | 'hi'>(state?.language ?? 'en')
  const { transcript, isListening, supported, startListening, stopListening, clearTranscript } =
    useVoiceInput(currentLanguage.current === 'hi' ? 'hi-IN' : 'en-IN')

  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript
  const wasListening = useRef(false)

  useEffect(() => {
    if (transcript) setReply(transcript)
  }, [transcript])

  useEffect(() => {
    if (wasListening.current && !isListening) {
      const captured = transcriptRef.current.trim()
      if (captured) submitReply(captured)
    }
    wasListening.current = isListening
  }, [isListening]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Streaming accumulation refs ──────────────────────────────────────────────
  const accTextRef = useRef('')
  const accVersesRef = useRef<VerseResult[]>([])
  const cancelledRef = useRef(false)

  // ── Core streaming function ──────────────────────────────────────────────────
  async function runStream(question: string, lang: 'en' | 'hi', history: HistoryTurn[]) {
    cancelledRef.current = false
    accTextRef.current = ''
    accVersesRef.current = []
    setDisplayText('')
    setVerses([])
    setStreamError(null)
    setIsStreaming(true)
    setShowText(true)

    try {
      for await (const ev of askAryaStream(question, lang, history)) {
        if (cancelledRef.current) break
        if (ev.type === 'meta') {
          accVersesRef.current = ev.verses
          setVerses(ev.verses)
        } else if (ev.type === 'token') {
          accTextRef.current += ev.text
          setDisplayText(accTextRef.current)
        } else if (ev.type === 'done') {
          const responseText = accTextRef.current.replace(/\nCITED:.*$/s, '').trim()
          const newHistory: HistoryTurn[] = [
            ...history,
            { role: 'user' as const, content: question },
            { role: 'assistant' as const, content: responseText },
          ].slice(-(MAX_HISTORY_TURNS * 2))
          saveHistory(newHistory)
          localStorage.setItem('arya_last_response', JSON.stringify({
            question,
            result: {
              response_text: accTextRef.current,
              verses: accVersesRef.current,
              audio_url: null,
              retrieval_scores: [],
            },
          }))
          void saveEntry({
            question,
            responseText: accTextRef.current,
            verses: accVersesRef.current,
            timestamp: Date.now(),
          })
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setStreamError(
          err instanceof ApiError ? `Server error (${err.status})` : 'Could not reach Arya.'
        )
      }
    } finally {
      setIsStreaming(false)
    }
  }

  // ── Initial stream on mount (from VoiceMode navigation) ─────────────────────
  useEffect(() => {
    if (!state?.streaming) return
    const { question, language = 'en', history: initialHistory = [] } = state
    currentLanguage.current = language
    void runStream(question, language, initialHistory)
    return () => { cancelledRef.current = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legacy save on mount ─────────────────────────────────────────────────────
  const savedLegacy = useRef(false)
  useEffect(() => {
    if (state?.streaming || !state?.result || savedLegacy.current) return
    savedLegacy.current = true
    void saveEntry({
      question: state.question,
      responseText: state.result.response_text,
      verses: state.result.verses,
      timestamp: Date.now(),
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Follow-up submit ─────────────────────────────────────────────────────────
  async function submitReply(question: string) {
    if (!question.trim() || isStreaming) return
    setReplyError(null)
    setReply('')
    clearTranscript()
    setCurrentQuestion(question)

    const currentHistory = loadHistory()
    await runStream(question, currentLanguage.current, currentHistory)

    // Focus reply input after streaming completes
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  function handlePlayingChange(playing: boolean) {
    setIsPlaying(playing)
    if (!playing) {
      setShowText(true)
      setTimeout(() => inputRef.current?.focus(), 600)
    }
  }

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted text-sm mb-4">Nothing to show.</p>
          <button
            onClick={() => navigate('/voice')}
            className="py-3 px-6 bg-gold text-white rounded-full text-sm font-medium hover:bg-gold-dim transition-all"
          >
            Talk to Arya
          </button>
        </div>
      </div>
    )
  }

  const audioUrl = (!state.streaming && state.result?.audio_url) ?? null

  return (
    <div className="min-h-full bg-background text-cream flex flex-col">
      {audioUrl && <AudioPlayer audioUrl={audioUrl} onPlayingChange={handlePlayingChange} />}

      {/* Header */}
      <header className="p-5 pb-0 flex-shrink-0">
        <button
          onClick={() => { cancelledRef.current = true; navigate('/voice') }}
          className="flex items-center gap-1.5 text-muted hover:text-cream transition-colors text-sm"
        >
          <ChevronLeft size={18} />
          <span>New conversation</span>
        </button>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <main className="flex flex-col items-center px-5 pt-6 pb-4">
          <div className="flex flex-col items-center gap-3 mb-8">
            <Orb isPlaying={isPlaying} size={120} />
            <p className="text-xs tracking-widest text-muted uppercase">
              {isPlaying ? 'Arya is speaking…' : isStreaming ? 'Arya is thinking…' : 'Arya'}
            </p>
          </div>

          <AnimatePresence>
            {showText && (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full max-w-2xl flex flex-col gap-5"
              >
                {/* Question echo */}
                <div className="px-1">
                  <p className="text-muted text-xs uppercase tracking-widest font-medium mb-1.5">
                    You asked
                  </p>
                  <p className="text-base text-stone-600 font-light italic">"{currentQuestion}"</p>
                </div>

                {/* Response card */}
                <div className="bg-surface border border-border rounded-2xl p-6 shadow-card min-h-[3rem]">
                  {displayText ? (
                    <p className="font-serif text-xl leading-relaxed text-cream whitespace-pre-wrap">
                      {displayText}
                      {isStreaming && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                          className="inline-block w-0.5 h-5 bg-gold/60 ml-0.5 align-middle"
                        />
                      )}
                    </p>
                  ) : isStreaming ? (
                    <motion.div
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      className="flex gap-1.5 items-center pt-1"
                    >
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-gold/50" />
                      ))}
                    </motion.div>
                  ) : null}
                </div>

                {streamError && (
                  <p className="text-error/70 text-sm text-center">{streamError}</p>
                )}

                {/* Sources — shown after stream completes */}
                {!isStreaming && verses.length > 0 && (
                  <SourcesSection verses={verses} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Reply bar */}
      <div className="flex-shrink-0 px-5 pb-8 pt-3 border-t border-border/50 bg-background">
        {replyError && (
          <p className="text-error/70 text-xs text-center mb-2">{replyError}</p>
        )}
        <div className="w-full max-w-xl mx-auto flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitReply(reply)}
              placeholder={isStreaming ? 'Arya is thinking…' : 'Reply to Arya…'}
              disabled={isStreaming}
              aria-label="Reply to Arya"
              className="w-full bg-surface border border-border rounded-full py-3 px-5 pr-11 focus:outline-none focus:border-gold/50 transition-all text-cream placeholder:text-muted/50 text-sm shadow-card disabled:opacity-50"
            />
            <button
              onClick={() => submitReply(reply)}
              disabled={!reply.trim() || isStreaming}
              aria-label="Send reply"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gold disabled:text-muted/30 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
          {supported && (
            <button
              onMouseDown={() => { clearTranscript(); setReply(''); startListening(currentLanguage.current === 'hi' ? 'hi-IN' : 'en-IN') }}
              onMouseUp={() => stopListening()}
              onTouchStart={() => { clearTranscript(); setReply(''); startListening(currentLanguage.current === 'hi' ? 'hi-IN' : 'en-IN') }}
              onTouchEnd={() => stopListening()}
              disabled={isStreaming}
              aria-label="Hold to speak reply"
              className={[
                'w-11 h-11 rounded-full border flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40',
                isListening
                  ? 'bg-gold/10 border-gold text-gold scale-110'
                  : 'bg-surface border-border text-muted hover:border-gold/40 hover:text-gold shadow-card',
              ].join(' ')}
            >
              <Mic size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SourcesSection({ verses }: { verses: VerseResult[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-background hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-muted">
          <BookOpen size={14} />
          <span className="text-xs font-medium uppercase tracking-widest">
            Where this comes from
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-muted" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="flex flex-col divide-y divide-border">
              {verses.map(v => (
                <VerseCard key={`${v.chapter}_${v.verse}`} verse={v} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function VerseCard({ verse }: { verse: VerseResult }) {
  const [tab, setTab] = useState<'en' | 'hi' | 'sa'>('en')

  return (
    <div className="bg-surface">
      <div className="px-5 pt-4 pb-2">
        <p className="text-gold text-xs font-medium uppercase tracking-widest">
          Ch.{verse.chapter} · V.{verse.verse}
        </p>
      </div>
      <div className="flex border-b border-border">
        {(['en', 'hi', 'sa'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-colors',
              tab === t ? 'text-gold border-b-2 border-gold -mb-px' : 'text-muted hover:text-cream',
            ].join(' ')}
          >
            {t === 'en' ? 'English' : t === 'hi' ? 'Hindi' : 'Sanskrit'}
          </button>
        ))}
      </div>
      <div className="px-5 py-4">
        {tab === 'en' && <p className="text-stone-600 font-light leading-relaxed text-sm italic">"{verse.english}"</p>}
        {tab === 'hi' && <p className="text-stone-600 font-light leading-relaxed text-sm">{verse.hindi}</p>}
        {tab === 'sa' && <p className="text-stone-400 font-serif text-sm italic leading-relaxed">{verse.sanskrit}</p>}
      </div>
    </div>
  )
}
