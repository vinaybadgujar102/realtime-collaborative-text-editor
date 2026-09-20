import { useEffect, useRef, useState } from 'react'
import { decodeDocumentState } from '#/lib/document-state'
import { getUserIdFromToken } from '#/lib/auth'
import type { DocumentDetail } from '#/lib/types'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'

type CollaborativeEditorProps = {
  document: DocumentDetail
}

type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

const LIVE_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
]

function statusVariant(
  status: ConnectionStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'connected':
      return 'default'
    case 'connecting':
      return 'secondary'
    case 'error':
      return 'destructive'
    default:
      return 'outline'
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
export function CollaborativeEditor({ document }: CollaborativeEditorProps) {
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

  return <CollaborativeEditorClient document={document} />
}

function CollaborativeEditorClient({ document }: CollaborativeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [liveUserIds, setLiveUserIds] = useState<string[]>([])
  const selfId = getUserIdFromToken()

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

      const bytes = decodeDocumentState(document.state)
      if (bytes) {
        Y.applyUpdate(yDoc, bytes)
      }

      const quill = new Quill(editorEl, {
        theme: 'snow',
        modules: quillModules,
        placeholder: 'Start typing…',
      })

      const binding = new QuillBinding(yText, quill)
      const provider = new YjsWebsocketProvider({
        doc: yDoc,
        documentId: document.id,
        onStatusChange: setStatus,
        onPresenceChange: setLiveUserIds,
      })

      cleanup = () => {
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
  }, [document.id, document.state])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {document.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Collaborative editor powered by Quill and Yjs
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            {status}
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
