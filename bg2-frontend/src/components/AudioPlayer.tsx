import { useEffect, useRef } from 'react'

interface AudioPlayerProps {
  audioUrl: string | null
  onPlayingChange: (isPlaying: boolean) => void
}

/**
 * Invisible component. Plays audioUrl automatically on mount / when url changes.
 * Calls onPlayingChange(true) when playback starts, (false) when it ends or errors.
 * When audioUrl is null, immediately signals not-playing so the parent can skip
 * the audio phase and go straight to showing text.
 */
export default function AudioPlayer({ audioUrl, onPlayingChange }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // stable ref so the effect cleanup can call the latest version
  const onPlayingChangeRef = useRef(onPlayingChange)
  onPlayingChangeRef.current = onPlayingChange

  useEffect(() => {
    if (!audioUrl) {
      onPlayingChangeRef.current(false)
      return
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    const done = () => onPlayingChangeRef.current(false)

    audio.addEventListener('ended', done)
    audio.addEventListener('error', done)

    // Signal playing immediately so the parent can update before the first frame
    onPlayingChangeRef.current(true)
    audio.play().catch(done)

    return () => {
      audio.removeEventListener('ended', done)
      audio.removeEventListener('error', done)
      audio.pause()
      audio.src = ''
      onPlayingChangeRef.current(false)
    }
  }, [audioUrl])

  return null
}
