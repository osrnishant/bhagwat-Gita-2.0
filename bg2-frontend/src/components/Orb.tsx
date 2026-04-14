import { motion } from 'framer-motion'
import { Mic } from 'lucide-react'

interface OrbProps {
  isListening?: boolean
  isPlaying?: boolean
  size?: number
  onPressStart?: () => void
  onPressEnd?: () => void
}

// 4-7-8 breathing (19 s): inhale 4 s → hold 7 s → exhale 8 s
const BREATHE = {
  scale:   [1, 1.05, 1.05, 1],
  opacity: [0.15, 0.30, 0.30, 0.15],
}
const BREATHE_T = {
  duration: 19,
  times: [0, 0.21, 0.58, 1],
  repeat: Infinity,
  ease: 'easeInOut' as const,
}

// Fast pulse while recording
const LISTEN = {
  scale:   [1, 1.4, 1],
  opacity: [0.25, 0.50, 0.25],
}
const LISTEN_T = {
  duration: 1,
  repeat: Infinity,
  ease: 'easeInOut' as const,
}

export default function Orb({
  isListening = false,
  isPlaying = false,
  size = 192,
  onPressStart,
  onPressEnd,
}: OrbProps) {
  const glowAnimate   = isListening ? LISTEN   : BREATHE
  const glowTransition = isListening ? LISTEN_T : BREATHE_T

  const buttonSize = Math.round(size * 0.75)
  const glowSize   = Math.round(size * 1.33)

  return (
    <div style={{ width: size, height: size, position: 'relative' }} className="flex items-center justify-center">
      {/* Outer glow — terracotta */}
      <motion.div
        animate={glowAnimate}
        transition={glowTransition}
        style={{
          position: 'absolute',
          width: glowSize,
          height: glowSize,
          borderRadius: '50%',
          backgroundColor: '#C8603A',
          filter: 'blur(52px)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Clickable / holdable button */}
      <button
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onTouchStart={onPressStart}
        onTouchEnd={onPressEnd}
        aria-label={isListening ? 'Stop listening' : 'Hold to speak'}
        style={{ width: buttonSize, height: buttonSize }}
        className={[
          'relative z-10 rounded-full border-2 flex items-center justify-center transition-all bg-surface shadow-card',
          isListening
            ? 'border-gold scale-110 shadow-card-hover'
            : 'border-gold/30 hover:border-gold/60 hover:shadow-card-hover',
        ].join(' ')}
      >
        <Mic
          size={Math.round(buttonSize * 0.27)}
          className={isListening ? 'text-gold' : 'text-muted'}
        />
      </button>

      {/* isPlaying: subtle pulse ring */}
      {isPlaying && (
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.12, 0.28, 0.12] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: buttonSize,
            height: buttonSize,
            borderRadius: '50%',
            border: '2px solid #C8603A',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  )
}
