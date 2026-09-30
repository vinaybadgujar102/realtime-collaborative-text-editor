import type { DocumentStateBuffer } from '#/lib/types'

/** Convert API Document.state ({ type: "Buffer", data }) into Yjs update bytes. */
export function decodeDocumentState(
  state: DocumentStateBuffer | null | undefined,
): Uint8Array | null {
  if (!state?.data || !Array.isArray(state.data) || state.data.length === 0) {
    return null
  }
  return Uint8Array.from(state.data)
}

/** Encode Yjs update bytes for API / localStorage storage. */
export function encodeDocumentState(state: Uint8Array): number[] {
  return Array.from(state)
}

export type HydrateResult = 'cache' | 'pending' | 'server-only'

/**
 * Hydrate a Y.Doc from server state, local cache, and any pending offline updates.
 * Uses the newer local snapshot when available; otherwise replays pending updates.
 */
export function hydrateDocumentDoc(
  Y: { applyUpdate: (doc: unknown, update: Uint8Array) => void },
  yDoc: unknown,
  options: {
    serverState?: Uint8Array | null
    cachedState?: Uint8Array | null
    cachedUpdatedAt?: number | null
    serverUpdatedAt?: string | null
    pendingUpdates?: Uint8Array[]
  },
): HydrateResult {
  const {
    serverState,
    cachedState,
    cachedUpdatedAt,
    serverUpdatedAt,
    pendingUpdates = [],
  } = options

  if (serverState) {
    Y.applyUpdate(yDoc, serverState)
  }

  const serverTime = serverUpdatedAt
    ? new Date(serverUpdatedAt).getTime()
    : 0
  const hasNewerCache =
    cachedState &&
    cachedUpdatedAt &&
    cachedUpdatedAt >= serverTime

  if (hasNewerCache) {
    Y.applyUpdate(yDoc, cachedState)
    return 'cache'
  }

  if (pendingUpdates.length > 0) {
    for (const update of pendingUpdates) {
      Y.applyUpdate(yDoc, update)
    }
    return 'pending'
  }

  return 'server-only'
}
