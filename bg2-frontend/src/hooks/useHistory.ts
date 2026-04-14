import { useState, useEffect } from 'react'
import { openDB, type IDBPDatabase } from 'idb'
import type { VerseResult } from '../services/api'

export interface HistoryEntry {
  id?: number
  question: string
  responseText: string
  verses: VerseResult[]
  timestamp: number
}

const DB_NAME = 'bg2'
const STORE = 'conversations'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

export async function saveEntry(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  const db = await getDB()
  await db.add(STORE, entry)
}

export async function getAllEntries(): Promise<HistoryEntry[]> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return (all as HistoryEntry[]).reverse()
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      setEntries(await getAllEntries())
    } catch (err) {
      console.error('Failed to load history:', err)
      setError('Could not load your chat history.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return { entries, isLoading, error, reload: load }
}
