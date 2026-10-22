export interface VerseResult {
  chapter: number
  verse: number
  sanskrit: string
  hindi: string
  english: string
}

export interface AskResponse {
  response_text: string
  verses: VerseResult[]
  audio_url: string | null
  retrieval_scores: number[]
}

export interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// The deployment gateway injects the backend credential server-side.
const BASE_URL = '/api'
function checkSession(status: number) {
  if (status === 401) window.location.assign('/api/session')
}

export type StreamEvent =
  | { type: 'meta'; verses: VerseResult[]; scores: number[] }
  | { type: 'token'; text: string }
  | { type: 'done' }

export async function* askAryaStream(
  question: string,
  language: 'en' | 'hi' = 'en',
  history: HistoryTurn[] = [],
): AsyncGenerator<StreamEvent> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const res = await fetch(`${BASE_URL}/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, language, voice: false, top_k: 3, history }),
  })

  checkSession(res.status)
  if (!res.ok) throw new ApiError(res.status, `Request failed: ${res.status}`)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventType = 'message'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim()
        if (eventType === 'error') throw new ApiError(502, 'AI response unavailable')
        if (raw === '[DONE]') {
          yield { type: 'done' }
          return
        }
        try {
          const data = JSON.parse(raw)
          if (eventType === 'meta') {
            yield { type: 'meta', verses: data.verses, scores: data.retrieval_scores }
          } else {
            // Each token is JSON-encoded string to handle embedded newlines safely
            yield { type: 'token', text: typeof data === 'string' ? data : String(data) }
          }
        } catch { /* skip malformed line */ }
        eventType = 'message'
      } else if (line === '') {
        eventType = 'message'
      }
    }
  }
  throw new ApiError(502, 'Incomplete AI response')
}

export async function askArya(
  question: string,
  language: 'en' | 'hi' = 'en',
  voice = false,
  history: HistoryTurn[] = [],
): Promise<AskResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const res = await fetch(`${BASE_URL}/ask`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, language, voice, top_k: 3, history }),
  })

  checkSession(res.status)
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed: ${res.status}`)
  }

  return res.json() as Promise<AskResponse>
}
