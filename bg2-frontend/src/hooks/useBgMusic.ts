import { useEffect, useRef, useState, useCallback } from 'react'

export type Track = 'flute' | 'sitar'

const TRACKS: Record<Track, { src: string; label: string }> = {
  flute:  { src: '/audio/krishna_flute.mp3',    label: 'Flute' },
  sitar:  { src: '/audio/sitar_meditation.mp3',  label: 'Sitar' },
}

const LS_KEY = 'arya_bg_music'

interface Prefs {
  track: Track
  volume: number
  playing: boolean
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...{ track: 'flute', volume: 0.18, playing: true }, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { track: 'flute', volume: 0.18, playing: true }
}

function savePrefs(p: Prefs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

export function useBgMusic() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  // Tracks whether we're waiting for first user gesture to unblock autoplay
  const [blockedByPolicy, setBlockedByPolicy] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Create / swap audio element when track changes
  useEffect(() => {
    const audio = new Audio(TRACKS[prefs.track].src)
    audio.loop = true
    audio.volume = prefs.volume
    audioRef.current = audio

    if (prefs.playing) {
      audio.play().catch(() => {
        // Browser blocked autoplay — wait for first user interaction
        setBlockedByPolicy(true)
        setPrefs(p => ({ ...p, playing: false }))
      })
    }

    return () => {
      audio.pause()
      audio.src = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.track])

  // On first user gesture: retry autoplay if it was blocked
  useEffect(() => {
    if (!blockedByPolicy) return
    function onInteraction() {
      setBlockedByPolicy(false)
      setPrefs(p => ({ ...p, playing: true }))
      document.removeEventListener('click', onInteraction)
      document.removeEventListener('touchstart', onInteraction)
      document.removeEventListener('keydown', onInteraction)
    }
    document.addEventListener('click', onInteraction)
    document.addEventListener('touchstart', onInteraction)
    document.addEventListener('keydown', onInteraction)
    return () => {
      document.removeEventListener('click', onInteraction)
      document.removeEventListener('touchstart', onInteraction)
      document.removeEventListener('keydown', onInteraction)
    }
  }, [blockedByPolicy])

  // Sync volume without restarting
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = prefs.volume
  }, [prefs.volume])

  // Sync play/pause without restarting
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (prefs.playing) {
      audio.play().catch(() => {
        setBlockedByPolicy(true)
        setPrefs(p => ({ ...p, playing: false }))
      })
    } else {
      audio.pause()
    }
  }, [prefs.playing])

  useEffect(() => { savePrefs(prefs) }, [prefs])

  const toggle    = useCallback(() => setPrefs(p => ({ ...p, playing: !p.playing })), [])
  const setVolume = useCallback((v: number) => setPrefs(p => ({ ...p, volume: v })), [])
  const setTrack  = useCallback((t: Track)  => setPrefs(p => ({ ...p, track: t })), [])

  return {
    playing: prefs.playing,
    volume:  prefs.volume,
    track:   prefs.track,
    trackLabel: TRACKS[prefs.track].label,
    blockedByPolicy,
    toggle,
    setVolume,
    setTrack,
  }
}
