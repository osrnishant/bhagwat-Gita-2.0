import { useState, useRef, useCallback, useEffect } from 'react'

export type Lang = 'hi-IN' | 'en-IN'

export interface UseVoiceInputReturn {
  transcript: string
  isListening: boolean
  supported: boolean
  startListening: (lang?: Lang) => void
  stopListening: () => void
  clearTranscript: () => void
}

// Minimal browser Speech Recognition types (not yet universally in TS DOM lib)
interface SRResult {
  readonly isFinal: boolean
  readonly 0: { readonly transcript: string }
}
interface SRResultList {
  readonly length: number
  readonly resultIndex: number
  readonly results: SRResult[]
}
interface SRInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((e: SRResultList) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
interface SRConstructor {
  new (): SRInstance
}

const win = window as unknown as Record<string, SRConstructor | undefined>
const SR: SRConstructor | undefined = win.SpeechRecognition ?? win.webkitSpeechRecognition

export function useVoiceInput(defaultLang: Lang = 'en-IN'): UseVoiceInputReturn {
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const recRef = useRef<SRInstance | null>(null)

  const stopListening = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const startListening = useCallback(
    (lang: Lang = defaultLang) => {
      if (!SR || isListening) return

      const rec = new SR()
      rec.lang = lang
      rec.continuous = false
      rec.interimResults = true
      rec.maxAlternatives = 1

      rec.onstart = () => {
        setTranscript('')
        setIsListening(true)
      }

      rec.onresult = (event: SRResultList) => {
        let final = ''
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i]
          if (r.isFinal) final += r[0].transcript
          else interim += r[0].transcript
        }
        setTranscript(final || interim)
      }

      rec.onerror = () => setIsListening(false)
      rec.onend = () => setIsListening(false)

      recRef.current = rec
      rec.start()
    },
    [defaultLang, isListening],
  )

  // abort on unmount to avoid stale callbacks
  useEffect(() => () => { recRef.current?.abort() }, [])

  return {
    transcript,
    isListening,
    supported: Boolean(SR),
    startListening,
    stopListening,
    clearTranscript: () => setTranscript(''),
  }
}
