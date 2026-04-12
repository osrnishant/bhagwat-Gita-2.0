import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useHistory, type HistoryEntry } from '../hooks/useHistory'

export default function History() {
  const navigate = useNavigate()
  const { entries, isLoading } = useHistory()

  return (
    <div className="min-h-full bg-surface text-cream flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-8 mb-4">
        <h2 className="font-serif text-3xl text-gold">Past Wisdom</h2>
        <button
          onClick={() => navigate('/voice')}
          className="text-muted hover:text-cream transition-colors"
          aria-label="Close"
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      <div className="flex-1 px-8 pb-16 overflow-y-auto">
        {isLoading && (
          <p className="text-muted italic animate-pulse">Loading…</p>
        )}

        {!isLoading && entries.length === 0 && (
          <div>
            <p className="text-muted italic">Your journey begins here.</p>
            <button
              onClick={() => navigate('/voice')}
              className="mt-6 py-4 px-8 bg-gold text-background rounded-full font-medium hover:bg-gold-dim transition-all"
            >
              Ask your first question
            </button>
          </div>
        )}

        {!isLoading && entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-6"
          >
            {entries.map(entry => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function EntryCard({ entry }: { entry: HistoryEntry }) {
  const [open, setOpen] = useState(false)
  const responseText = entry.responseText.replace(/\nCITED:.*$/s, '').trim()
  const dateLabel = new Date(entry.timestamp).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="text-left p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group w-full"
    >
      <p className="text-muted text-xs uppercase tracking-widest mb-2 group-hover:text-gold transition-colors">
        {dateLabel}
      </p>
      <p className="text-cream font-light line-clamp-2 italic mb-2">"{entry.question}"</p>

      {entry.verses.length > 0 && (
        <p className="text-gold text-sm font-serif">
          Chapter {entry.verses[0].chapter}, Verse {entry.verses[0].verse}
        </p>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden mt-4"
          >
            <p className="text-muted font-light leading-relaxed text-sm whitespace-pre-wrap">
              {responseText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}
