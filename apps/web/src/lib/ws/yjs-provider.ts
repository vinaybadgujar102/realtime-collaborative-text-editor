import * as Y from 'yjs'
import { getToken, getUserIdFromToken } from '#/lib/auth'

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

export type PresenceEvent =
  | { type: 'presence'; event: 'join'; userId: string }
  | { type: 'presence'; event: 'leave'; userId: string }
  | { type: 'presence'; event: 'sync'; userIds: string[] }

const DEFAULT_DEBOUNCE_MS = 300
/** Must be frequent enough to keep presence healthy while connected. */
const PING_INTERVAL_MS = 5_000

type YjsProviderOptions = {
  doc: Y.Doc
  documentId: string
  wsUrl?: string
  /** Delay before sending queued local updates. Defaults to 300ms. */
  debounceMs?: number
  onStatusChange?: (status: ConnectionStatus) => void
  onPresenceChange?: (liveUserIds: string[]) => void
}

/**
 * Custom Yjs WebSocket provider matching the current wsServer protocol:
 * - Connect: ws://host?token=&docId=
 * - Client → server: JSON { type: "update_doc", payload: { userId, docId, data } }
 * - Client → server: JSON { type: "ping", payload: { userId, docId } } (keeps presence set membership)
 * - Server → client: raw binary Yjs update frames
 * - Presence: JSON { type: "presence", event: "join"|"leave"|"sync", ... }
 */
export class YjsWebsocketProvider {
  private ws: WebSocket | null = null
  private doc: Y.Doc
  private documentId: string
  private wsUrl: string
  private debounceMs: number
  private onStatusChange?: (status: ConnectionStatus) => void
  private onPresenceChange?: (liveUserIds: string[]) => void
  private destroyed = false
  private applyingRemote = false
  private pendingUpdates: Uint8Array[] = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private liveUserIds = new Set<string>()

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

  private sendPing = () => {
    if (this.destroyed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    const userId = getUserIdFromToken() ?? ''
    this.ws.send(
      JSON.stringify({
        type: 'ping',
        payload: {
          userId,
          docId: this.documentId,
        },
      }),
    )
  }

  private startPingLoop() {
    this.stopPingLoop()
    this.sendPing()
    this.pingTimer = setInterval(this.sendPing, PING_INTERVAL_MS)
  }

  private stopPingLoop() {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  constructor(options: YjsProviderOptions) {
    this.doc = options.doc
    this.documentId = options.documentId
    this.wsUrl = options.wsUrl ?? import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.onStatusChange = options.onStatusChange
    this.onPresenceChange = options.onPresenceChange

    const selfId = getUserIdFromToken()
    if (selfId) {
      this.liveUserIds.add(selfId)
      this.emitPresence()
    }

    this.doc.on('update', this.handleUpdate)
    this.connect()
  }

  private setStatus(status: ConnectionStatus) {
    this.onStatusChange?.(status)
  }

  private emitPresence() {
    this.onPresenceChange?.([...this.liveUserIds])
  }

  private handlePresenceMessage(message: PresenceEvent) {
    if (message.event === 'sync') {
      this.liveUserIds = new Set(message.userIds)
      const selfId = getUserIdFromToken()
      if (selfId) this.liveUserIds.add(selfId)
      this.emitPresence()
      return
    }

    if (message.event === 'join') {
      this.liveUserIds.add(message.userId)
      this.emitPresence()
      return
    }

    if (message.event === 'leave') {
      this.liveUserIds.delete(message.userId)
      this.emitPresence()
    }
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
      this.flushPendingUpdates()
      this.startPingLoop()
    }

    this.ws.onmessage = (event) => {
      if (this.destroyed) return

      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data) as PresenceEvent
          if (parsed?.type === 'presence') {
            this.handlePresenceMessage(parsed)
          }
        } catch {
          // ignore non-JSON text frames
        }
        return
      }

      let bytes: Uint8Array | null = null

      if (event.data instanceof ArrayBuffer) {
        bytes = new Uint8Array(event.data)
      } else if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then((buffer) => {
          if (this.destroyed) return
          this.applyRemoteUpdate(new Uint8Array(buffer))
        })
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
      this.stopPingLoop()
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
    this.stopPingLoop()

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

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
    this.liveUserIds.clear()
    this.emitPresence()
    this.setStatus('disconnected')
  }
}
