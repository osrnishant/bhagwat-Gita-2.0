import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Sparkles } from 'lucide-react'
import Orb from '../components/Orb'
import AudioPlayer from '../components/AudioPlayer'
import type { AskResponse, VerseResult } from '../services/api'
import { saveEntry } from '../hooks/useHistory'

interface LocationState {
  question: string
  result: AskResponse
}

export default function Response() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const hasAudio = Boolean(state?.result.audio_url)
  const [isPlaying, setIsPlaying] = useState(hasAudio)
  const [showText, setShowText] = useState(!hasAudio)

  function handlePlayingChange(playing: boolean) {
    setIsPlaying(playing)
    if (!playing) setShowText(true)
  }

  const saved = useRef(false)
  useEffect(() => {
    if (!state || saved.current) return
    saved.current = true
    void saveEntry({
      question: state.question,
      responseText: state.result.response_text,
      verses: state.result.verses,
      timestamp: Date.now(),
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-muted text-sm">No response to show.</p>
      </div>
    )
  }

  const { question, result } = state
  const responseText = result.response_text.replace(/\nCITED:.*$/s, '').trim()

  return (
    <div className="min-h-full bg-background text-cream flex flex-col overflow-y-auto">
      <AudioPlayer audioUrl={result.audio_url} onPlayingChange={handlePlayingChange} />

      {/* Back button */}
      <header className="p-6">
        <button
          onClick={() => navigate('/voice')}
          className="flex items-center gap-2 text-muted hover:text-gold transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm">Ask another question</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pb-16">
        {/* Orb — playing state */}
        <div className="flex flex-col items-center gap-4 mb-12">
          <Orb isPlaying={isPlaying} size={160} />
          <p className="text-xs tracking-widest text-muted uppercase">
            {isPlaying ? 'Speaking…' : 'Krishna'}
          </p>
        </div>

        {/* Content — gated behind audio */}
        <AnimatePresence>
          {showText && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="w-full max-w-4xl flex flex-col gap-8"
            >
              {/* Question echo */}
              <div>
                <p className="text-muted text-sm uppercase tracking-widest font-medium mb-2">
                  Your Question
                </p>
                <p className="text-xl text-cream font-light italic">"{question}"</p>
              </div>

              {/* Wisdom card */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-6 text-gold">
                  <Sparkles size={18} />
                  <span className="uppercase tracking-widest text-xs font-semibold">Wisdom</span>
                </div>
                <p className="font-serif text-2xl leading-relaxed text-cream mb-8 whitespace-pre-wrap">
                  {responseText}
                </p>

                {/* First cited verse inline */}
                {result.verses.length > 0 && (
                  <div className="border-t border-white/10 pt-6">
                    <p className="text-gold font-serif text-lg mb-2">
                      Chapter {result.verses[0].chapter}, Verse {result.verses[0].verse}
                    </p>
                    <p className="text-muted font-light leading-relaxed italic">
                      "{result.verses[0].english}"
                    </p>
                  </div>
                )}
              </div>

              {/* Additional verse cards */}
              {result.verses.length > 1 && (
                <div className="flex flex-col gap-3">
                  {result.verses.slice(1).map((v: VerseResult) => (
                    <VerseCard key={`${v.chapter}_${v.verse}`} verse={v} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

function VerseCard({ verse }: { verse: VerseResult }) {
  const [open, setOpen] = useState(false)

  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="text-left p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group w-full"
    >
      <p className="text-muted text-xs uppercase tracking-widest mb-1 group-hover:text-gold transition-colors">
        Chapter {verse.chapter}, Verse {verse.verse}
      </p>
      <p className="text-cream/70 font-light leading-snug line-clamp-2 italic">
        "{verse.english}"
      </p>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden mt-4 flex flex-col gap-3"
          >
            <p className="text-muted font-light leading-relaxed">{verse.hindi}</p>
            <p className="text-cream/30 font-serif text-sm italic leading-relaxed">{verse.sanskrit}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}
