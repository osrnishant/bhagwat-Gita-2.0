import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-md"
      >
        <p className="text-xs uppercase tracking-widest text-muted font-medium mb-4">
          Meet Arya
        </p>
        <h1 className="font-serif text-5xl text-cream mb-5 leading-tight">
          Real talk,<br />any time.
        </h1>
        <p className="text-base text-muted mb-12 leading-relaxed font-light max-w-sm mx-auto">
          Tell Arya what is on your mind. Career, relationships, purpose, a decision you cannot make. Arya listens, thinks it through with you, and gives you a straight answer.
        </p>
        <button
          onClick={() => navigate('/voice')}
          className="w-full py-4 px-8 bg-gold text-white rounded-full font-medium text-base hover:bg-gold-dim transition-all shadow-sm"
        >
          Talk to Arya
        </button>
        <p className="mt-6 text-xs text-muted/60">
          Speak or type — your choice
        </p>
      </motion.div>
    </div>
  )
}
