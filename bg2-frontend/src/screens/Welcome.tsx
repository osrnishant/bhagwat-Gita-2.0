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
        <h1 className="font-serif text-5xl mb-4 text-gold">Bhagavad Gita 2.0</h1>
        <p className="text-lg text-muted mb-12 leading-relaxed font-light">
          A place of stillness. Ask Krishna your deepest questions and receive wisdom grounded in scripture.
        </p>
        <button
          onClick={() => navigate('/voice')}
          className="w-full py-4 px-8 bg-gold text-background rounded-full font-medium text-lg hover:bg-gold-dim transition-all shadow-lg shadow-gold/20"
        >
          Begin
        </button>
      </motion.div>
    </div>
  )
}
