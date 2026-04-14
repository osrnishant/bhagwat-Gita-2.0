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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.30, 0.15] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-full bg-gold/20 border border-gold/40 mx-auto mb-8"
        />
        <h1 className="font-serif text-4xl text-cream">Arya</h1>
        <p className="mt-2 text-sm text-muted font-light tracking-wide">Your thinking partner</p>
      </motion.div>
    </div>
  )
}
