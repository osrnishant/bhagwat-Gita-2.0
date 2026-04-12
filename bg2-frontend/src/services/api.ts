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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const API_KEY  = import.meta.env.VITE_API_KEY  ?? ''

export async function askKrishna(
  question: string,
  language: 'en' | 'hi' = 'en',
  voice = false,
): Promise<AskResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`

  const res = await fetch(`${BASE_URL}/ask`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, language, voice, top_k: 5 }),
  })

  if (!res.ok) {
    throw new ApiError(res.status, `Request failed: ${res.status}`)
  }

  return res.json() as Promise<AskResponse>
}
