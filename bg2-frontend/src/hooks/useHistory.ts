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

/** Save one conversation entry. Resolves when written. */
export async function saveEntry(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  const db = await getDB()
  await db.add(STORE, entry)
}

/** Load all entries, newest first. */
export async function getAllEntries(): Promise<HistoryEntry[]> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return (all as HistoryEntry[]).reverse()
}

/** Hook for the History screen: loads entries on mount, exposes reload. */
export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function load() {
    setIsLoading(true)
    try {
      setEntries(await getAllEntries())
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return { entries, isLoading, reload: load }
}
