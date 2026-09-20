import * as Y from 'yjs'
import { getToken, getUserIdFromToken } from '#/lib/auth'

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

const DEFAULT_DEBOUNCE_MS = 300

type YjsProviderOptions = {
  doc: Y.Doc
  documentId: string
  wsUrl?: string
  /** Delay before sending queued local updates. Defaults to 300ms. */
  debounceMs?: number
  onStatusChange?: (status: ConnectionStatus) => void
}

/**
 * Custom Yjs WebSocket provider matching the current wsServer protocol:
 * - Connect: ws://host?token=&docId=
 * - Client → server: JSON { type: "update_doc", payload: { userId, docId, data } }
 * - Server → client: raw binary Yjs update frames
 * - Local updates are debounced and merged before send
 */
export class YjsWebsocketProvider {
  private ws: WebSocket | null = null
  private doc: Y.Doc
  private documentId: string
  private wsUrl: string
  private debounceMs: number
  private onStatusChange?: (status: ConnectionStatus) => void
  private destroyed = false
  private applyingRemote = false
  private pendingUpdates: Uint8Array[] = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  private handleUpdate = (update: Uint8Array, origin: unknown) => {
    if (this.destroyed || origin === this || this.applyingRemote) return

    this.pendingUpdates.push(update)
    this.scheduleFlush()
  }

  private scheduleFlush = () => {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.flushPendingUpdates()
    }, this.debounceMs)
  }

  private flushPendingUpdates = () => {
    if (this.destroyed || this.pendingUpdates.length === 0) return
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const merged =
      this.pendingUpdates.length === 1
        ? this.pendingUpdates[0]!
        : Y.mergeUpdates(this.pendingUpdates)

    this.pendingUpdates = []

    const userId = getUserIdFromToken() ?? ''
    const message = {
      id: crypto.randomUUID(),
      type: 'update_doc',
      payload: {
        userId,
        docId: this.documentId,
        data: Array.from(merged),
      },
    }

    this.ws.send(JSON.stringify(message))
  }

  constructor(options: YjsProviderOptions) {
    this.doc = options.doc
    this.documentId = options.documentId
    this.wsUrl = options.wsUrl ?? import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.onStatusChange = options.onStatusChange

    this.doc.on('update', this.handleUpdate)
    this.connect()
  }

  private setStatus(status: ConnectionStatus) {
    this.onStatusChange?.(status)
  }

  private connect() {
    if (this.destroyed) return

    const token = getToken()
    if (!token) {
      this.setStatus('error')
      return
    }

    this.setStatus('connecting')

    const url = new URL(this.wsUrl)
    url.searchParams.set('token', token)
    url.searchParams.set('docId', this.documentId)

    this.ws = new WebSocket(url.toString())
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      if (this.destroyed) return
      this.setStatus('connected')
      // Send anything queued while connecting.
      this.flushPendingUpdates()
    }

    this.ws.onmessage = (event) => {
      if (this.destroyed) return

      let bytes: Uint8Array | null = null

      if (event.data instanceof ArrayBuffer) {
        bytes = new Uint8Array(event.data)
      } else if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then((buffer) => {
          if (this.destroyed) return
          this.applyRemoteUpdate(new Uint8Array(buffer))
        })
        return
      } else if (typeof event.data === 'string') {
        // Backend may occasionally echo JSON; ignore non-binary frames.
        return
      }

      if (bytes) {
        this.applyRemoteUpdate(bytes)
      }
    }

    this.ws.onerror = () => {
      if (this.destroyed) return
      this.setStatus('error')
    }

    this.ws.onclose = () => {
      if (this.destroyed) return
      this.setStatus('disconnected')
    }
  }

  private applyRemoteUpdate(bytes: Uint8Array) {
    this.applyingRemote = true
    try {
      Y.applyUpdate(this.doc, bytes, this)
    } finally {
      this.applyingRemote = false
    }
  }

  destroy() {
    this.destroyed = true

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    // Best-effort flush before closing so recent edits aren't dropped.
    this.flushPendingUpdates()

    this.doc.off('update', this.handleUpdate)
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.setStatus('disconnected')
  }
}
