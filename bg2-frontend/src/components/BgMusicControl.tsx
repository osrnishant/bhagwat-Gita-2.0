import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music2, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useBgMusic, type Track } from '../hooks/useBgMusic'

const TRACKS: { id: Track; label: string; icon: string }[] = [
  { id: 'flute', label: 'Flute',  icon: '🪈' },
  { id: 'sitar', label: 'Sitar',  icon: '🎸' },
]

export default function BgMusicControl() {
  const { playing, volume, track, toggle, setVolume, setTrack } = useBgMusic()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function VolumeIcon() {
    if (volume === 0) return <VolumeX size={14} />
    if (volume < 0.4) return <Volume1 size={14} />
    return <Volume2 size={14} />
  }

  return (
    <div ref={panelRef} className="fixed bottom-6 left-5 z-50 flex flex-col items-start gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="bg-surface border border-border rounded-2xl shadow-card-hover p-4 w-52 flex flex-col gap-4"
          >
            {/* Track selector */}
            <div>
              <p className="text-muted text-xs uppercase tracking-widest mb-2">Track</p>
              <div className="flex gap-2">
                {TRACKS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTrack(t.id)}
                    className={[
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-all border',
                      track === t.id
                        ? 'bg-gold/10 border-gold/40 text-gold'
                        : 'bg-background border-border text-muted hover:border-gold/20',
                    ].join(' ')}
                  >
                    <span className="mr-1">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-muted text-xs uppercase tracking-widest">Volume</p>
                <span className="text-muted">
                  <VolumeIcon />
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-border accent-gold [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-muted/50 text-xs">Off</span>
                <span className="text-muted/50 text-xs">Loud</span>
              </div>
            </div>

            {/* Play / Pause */}
            <button
              onClick={toggle}
              className={[
                'w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all',
                playing
                  ? 'bg-gold/10 text-gold border border-gold/30 hover:bg-gold/15'
                  : 'bg-gold text-white hover:bg-gold-dim shadow-sm',
              ].join(' ')}
            >
              {playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Background music"
        className={[
          'w-10 h-10 rounded-full flex items-center justify-center transition-all border shadow-card',
          open
            ? 'bg-gold text-white border-gold'
            : playing
              ? 'bg-surface border-gold/40 text-gold'
              : 'bg-surface border-border text-muted hover:border-gold/30 hover:text-gold',
        ].join(' ')}
      >
        <Music2 size={16} />
        {/* Playing indicator dot */}
        {playing && !open && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-gold border border-surface" />
        )}
      </button>
    </div>
  )
}
