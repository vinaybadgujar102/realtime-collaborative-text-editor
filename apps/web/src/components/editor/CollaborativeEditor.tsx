import { useEffect, useRef, useState } from 'react'
import { Bot, WifiOff } from 'lucide-react'
import { decodeDocumentState, hydrateDocumentDoc } from '#/lib/document-state'
import { getUserIdFromToken } from '#/lib/auth'
import {
  getDemoIntervalMs,
  insertDemoFragment,
} from '#/lib/demo/conflict-demo'
import {
  clearPendingUpdates,
  loadDocumentCache,
  saveDocumentSnapshot,
} from '#/lib/offline/document-cache'
import type { ConnectionStatus } from '#/lib/ws/yjs-provider'
import type { DocumentDetail } from '#/lib/types'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'

type CollaborativeEditorProps = {
  document: DocumentDetail
  isOfflineFallback?: boolean
}

const LIVE_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
]

const SNAPSHOT_DEBOUNCE_MS = 500

function statusVariant(
  status: ConnectionStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'connected':
      return 'default'
    case 'connecting':
    case 'syncing':
      return 'secondary'
    case 'error':
      return 'destructive'
    case 'offline':
      return 'outline'
    default:
      return 'outline'
  }
}

function statusLabel(status: ConnectionStatus) {
  switch (status) {
    case 'offline':
      return 'offline'
    case 'syncing':
      return 'syncing'
    default:
      return status
  }
}

function shortId(userId: string) {
  return userId.slice(0, 2).toUpperCase()
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['clean'],
  ],
}

/**
 * Quill/Yjs editor — rendered only on the client to avoid SSR issues
 * with react-quill / document access.
 */
export function CollaborativeEditor({
  document,
  isOfflineFallback = false,
}: CollaborativeEditorProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-[420px] w-full" />
      </div>
    )
  }

  return (
    <CollaborativeEditorClient
      document={document}
      isOfflineFallback={isOfflineFallback}
    />
  )
}

type EditorApi = {
  yText: { length: number; insert: (index: number, text: string) => void } | null
}

function CollaborativeEditorClient({
  document,
  isOfflineFallback,
}: CollaborativeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorApiRef = useRef<EditorApi>({ yText: null })
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [liveUserIds, setLiveUserIds] = useState<string[]>([])
  const [demoActive, setDemoActive] = useState(false)
  const [demoInsertCount, setDemoInsertCount] = useState(0)
  const selfId = getUserIdFromToken()

  const isOffline =
    status === 'offline' || status === 'disconnected' || isOfflineFallback

  useEffect(() => {
    setDemoActive(false)
    setDemoInsertCount(0)
  }, [document.id])

  useEffect(() => {
    if (!demoActive) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const scheduleNextInsert = () => {
      timeoutId = setTimeout(() => {
        if (cancelled) return

        const yText = editorApiRef.current.yText
        if (yText) {
          insertDemoFragment(yText)
          setDemoInsertCount((count) => count + 1)
        }

        scheduleNextInsert()
      }, getDemoIntervalMs())
    }

    scheduleNextInsert()

    return () => {
      cancelled = true
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [demoActive])

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    async function setup() {
      const [
        { default: Quill },
        Y,
        { QuillBinding },
        { YjsWebsocketProvider },
      ] = await Promise.all([
        import('quill'),
        import('yjs'),
        import('y-quill'),
        import('#/lib/ws/yjs-provider'),
      ])

      await import('quill/dist/quill.snow.css')

      if (cancelled || !containerRef.current) return

      containerRef.current.innerHTML = ''
      const editorEl = window.document.createElement('div')
      containerRef.current.appendChild(editorEl)

      const yDoc = new Y.Doc()
      const yText = yDoc.getText('quill')

      const serverBytes = decodeDocumentState(document.state)
      const cached = loadDocumentCache(document.id)
      const cachedBytes = cached?.state?.length
        ? Uint8Array.from(cached.state)
        : null
      const pendingUpdates =
        cached?.pendingUpdates.map((data) => Uint8Array.from(data)) ?? []

      const hydrateResult = hydrateDocumentDoc(Y, yDoc, {
        serverState: serverBytes,
        cachedState: cachedBytes,
        cachedUpdatedAt: cached?.localUpdatedAt,
        serverUpdatedAt: document.updatedAt,
        pendingUpdates,
      })

      if (hydrateResult === 'cache') {
        clearPendingUpdates(document.id)
      }

      const quill = new Quill(editorEl, {
        theme: 'snow',
        modules: quillModules,
        placeholder: 'Start typing…',
      })

      const binding = new QuillBinding(yText, quill)
      editorApiRef.current.yText = yText

      let snapshotTimer: ReturnType<typeof setTimeout> | null = null

      const saveSnapshot = () => {
        const snapshot = Y.encodeStateAsUpdate(yDoc)
        saveDocumentSnapshot(document.id, {
          name: document.name,
          state: snapshot,
          serverUpdatedAt: document.updatedAt,
        })
      }

      const handleDocUpdate = () => {
        if (snapshotTimer !== null) {
          clearTimeout(snapshotTimer)
        }

        snapshotTimer = setTimeout(() => {
          snapshotTimer = null
          saveSnapshot()
        }, SNAPSHOT_DEBOUNCE_MS)
      }

      yDoc.on('update', handleDocUpdate)

      const provider = new YjsWebsocketProvider({
        doc: yDoc,
        documentId: document.id,
        onStatusChange: setStatus,
        onPresenceChange: setLiveUserIds,
      })

      saveSnapshot()

      cleanup = () => {
        editorApiRef.current.yText = null
        if (snapshotTimer !== null) {
          clearTimeout(snapshotTimer)
        }
        saveSnapshot()
        yDoc.off('update', handleDocUpdate)
        provider.destroy()
        binding.destroy()
        yDoc.destroy()
      }
    }

    void setup()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [document.id, document.name, document.state, document.updatedAt])

  return (
    <div className="space-y-4">
      {isOffline ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <WifiOff className="size-4 shrink-0" />
          <span>
            You&apos;re offline. Changes are saved locally and will sync when
            you&apos;re back online.
          </span>
        </div>
      ) : null}

      {demoActive ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-900 dark:text-violet-100">
          <div className="flex items-center gap-2">
            <Bot className="size-4 shrink-0" />
            <span>
              Conflict demo running — auto-inserting text at random positions.
              Keep typing to see Yjs merge your edits with the bot.
            </span>
          </div>
          <span className="text-xs text-violet-700 dark:text-violet-200">
            {demoInsertCount} auto-inserts
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {document.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Collaborative editor powered by Quill and Yjs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant={demoActive ? 'destructive' : 'outline'}
            onClick={() => {
              setDemoActive((active) => {
                if (active) return false
                setDemoInsertCount(0)
                return true
              })
            }}
          >
            <Bot className="size-4" />
            {demoActive ? 'Stop conflict demo' : 'Start conflict demo'}
          </Button>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                  liveUserIds.length > 0 ? 'bg-emerald-400' : 'bg-muted-foreground'
                }`}
              />
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  liveUserIds.length > 0 ? 'bg-emerald-500' : 'bg-muted-foreground'
                }`}
              />
            </span>
            <span className="text-sm text-muted-foreground">
              {liveUserIds.length} live
            </span>
            <div className="flex -space-x-1.5">
              {liveUserIds.map((userId, index) => (
                <div
                  key={userId}
                  title={userId === selfId ? 'You' : userId}
                  className={`flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white ${
                    LIVE_COLORS[index % LIVE_COLORS.length]
                  }`}
                >
                  {shortId(userId)}
                </div>
              ))}
            </div>
          </div>
          <Badge variant={statusVariant(status)} className="capitalize">
            {statusLabel(status)}
          </Badge>
        </div>
      </div>

      <div
        ref={containerRef}
        className="min-h-[420px] overflow-hidden rounded-lg border bg-background [&_.ql-container]:min-h-[360px] [&_.ql-editor]:min-h-[360px]"
      />
    </div>
  )
}
