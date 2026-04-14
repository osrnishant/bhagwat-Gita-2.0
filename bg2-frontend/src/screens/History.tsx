import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { useHistory, type HistoryEntry } from '../hooks/useHistory'

export default function History() {
  const navigate = useNavigate()
  const { entries, isLoading, error } = useHistory()

  return (
    <div className="min-h-full bg-background text-cream flex flex-col">
      <div className="flex justify-between items-center px-5 pt-5 pb-4">
        <h2 className="font-serif text-2xl text-cream">Your chats with Arya</h2>
        <button
          onClick={() => navigate('/voice')}
          className="p-2 hover:bg-black/5 rounded-full transition-colors text-muted"
          aria-label="Back to chat"
        >
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="flex-1 px-5 pb-16 overflow-y-auto flex flex-col gap-2.5">
        {isLoading && (
          <p className="text-muted text-sm animate-pulse pt-4">Loading…</p>
        )}

        {error && (
          <div className="flex items-center gap-2 pt-4 text-error/80">
            <AlertCircle size={16} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div className="pt-8">
            <p className="text-muted text-sm">Nothing yet. Talk to Arya.</p>
            <button
              onClick={() => navigate('/voice')}
              className="mt-5 py-3 px-6 bg-gold text-white rounded-full text-sm font-medium hover:bg-gold-dim transition-all shadow-sm"
            >
              Start your first chat
            </button>
          </div>
        )}

        {!isLoading && entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-2.5"
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
      className="text-left bg-surface border border-border rounded-xl shadow-card hover:shadow-card-hover hover:border-gold/30 transition-all group w-full overflow-hidden"
    >
      <div className="px-5 py-4">
        <p className="text-muted text-xs uppercase tracking-widest mb-1.5 group-hover:text-gold transition-colors">
          {dateLabel}
        </p>
        <p className="text-cream font-light text-sm line-clamp-2 italic mb-1">
          "{entry.question}"
        </p>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-border"
          >
            <p className="text-stone-500 font-light leading-relaxed text-sm whitespace-pre-wrap px-5 py-4">
              {responseText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}
