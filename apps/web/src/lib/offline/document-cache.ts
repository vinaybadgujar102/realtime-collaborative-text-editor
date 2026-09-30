const STORAGE_PREFIX = 'collab-doc:'

export type CachedDocument = {
  documentId: string
  name: string
  serverUpdatedAt: string | null
  localUpdatedAt: number
  state: number[]
  pendingUpdates: number[][]
}

function storageKey(documentId: string) {
  return `${STORAGE_PREFIX}${documentId}`
}

function readCache(documentId: string): CachedDocument | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(storageKey(documentId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as CachedDocument
    if (parsed.documentId !== documentId) return null
    if (!Array.isArray(parsed.state)) return null

    return {
      ...parsed,
      pendingUpdates: Array.isArray(parsed.pendingUpdates)
        ? parsed.pendingUpdates
        : [],
    }
  } catch {
    return null
  }
}

function writeCache(documentId: string, cache: CachedDocument) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(storageKey(documentId), JSON.stringify(cache))
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadDocumentCache(documentId: string): CachedDocument | null {
  return readCache(documentId)
}

export function saveDocumentSnapshot(
  documentId: string,
  options: {
    name: string
    state: Uint8Array
    serverUpdatedAt?: string | null
  },
) {
  const existing = readCache(documentId)

  writeCache(documentId, {
    documentId,
    name: options.name,
    serverUpdatedAt:
      options.serverUpdatedAt ?? existing?.serverUpdatedAt ?? null,
    localUpdatedAt: Date.now(),
    state: Array.from(options.state),
    pendingUpdates: existing?.pendingUpdates ?? [],
  })
}

export function savePendingUpdates(
  documentId: string,
  pendingUpdates: Uint8Array[],
) {
  const existing = readCache(documentId)
  if (!existing) return

  writeCache(documentId, {
    ...existing,
    pendingUpdates: pendingUpdates.map((update) => Array.from(update)),
    localUpdatedAt: Date.now(),
  })
}

export function clearPendingUpdates(documentId: string) {
  const existing = readCache(documentId)
  if (!existing) return

  writeCache(documentId, {
    ...existing,
    pendingUpdates: [],
  })
}

export function removeDocumentCache(documentId: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(storageKey(documentId))
}

export function cachedDocumentToDetail(
  cache: CachedDocument,
): {
  id: string
  name: string
  userId: string
  state: { type: 'Buffer'; data: number[] }
  createdAt: string
  updatedAt: string
} {
  const updatedAt = new Date(cache.localUpdatedAt).toISOString()

  return {
    id: cache.documentId,
    name: cache.name,
    userId: '',
    state: { type: 'Buffer', data: cache.state },
    createdAt: updatedAt,
    updatedAt,
  }
}
