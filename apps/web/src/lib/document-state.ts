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
