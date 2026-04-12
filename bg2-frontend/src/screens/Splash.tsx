import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Splash() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/welcome'), 2000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 rounded-full bg-gold/20 border border-gold/50 mx-auto mb-8"
        />
        <h1 className="font-serif text-4xl text-gold">Bhagavad Gita 2.0</h1>
        <p className="mt-3 text-sm text-muted font-light tracking-wide">A place of stillness.</p>
      </motion.div>
    </div>
  )
}
