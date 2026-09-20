import { useEffect, useRef, useState } from 'react'
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

function decodeDocumentState(
  state: DocumentDetail['state'],
): Uint8Array | null {
  if (!state) return null
  if (Array.isArray(state.data)) {
    return new Uint8Array(state.data)
  }
  return null
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
      const bytes = decodeDocumentState(document.state)
      if (bytes) {
        Y.applyUpdate(yDoc, bytes)
      }

      const yText = yDoc.getText('quill')
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
        <Badge variant={statusVariant(status)} className="capitalize">
          {status}
        </Badge>
      </div>

      <div
        ref={containerRef}
        className="min-h-[420px] overflow-hidden rounded-lg border bg-background [&_.ql-container]:min-h-[360px] [&_.ql-editor]:min-h-[360px]"
      />
    </div>
  )
}
