import { useEffect, useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { CollaborativeEditor } from '#/components/editor/CollaborativeEditor'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { useOnlineStatus } from '#/hooks/useOnlineStatus'
import { isAuthenticated } from '#/lib/auth'
import {
  cachedDocumentToDetail,
  loadDocumentCache,
} from '#/lib/offline/document-cache'
import { useDocument } from '#/lib/queries'
import type { DocumentDetail } from '#/lib/types'

export const Route = createFileRoute('/documents/$documentId')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: DocumentEditorPage,
  head: () => ({
    meta: [{ title: 'Editor · Collab Editor' }],
  }),
})

function DocumentEditorPage() {
  const { documentId } = Route.useParams()
  const isOnline = useOnlineStatus()
  const { data, isLoading, isError, error } = useDocument(documentId)
  const [mounted, setMounted] = useState(false)
  const [offlineDocument, setOfflineDocument] = useState<DocumentDetail | null>(
    null,
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const cached = loadDocumentCache(documentId)
    if (cached && (!isOnline || isError)) {
      setOfflineDocument(cachedDocumentToDetail(cached))
    } else {
      setOfflineDocument(null)
    }
  }, [mounted, documentId, isOnline, isError])

  const documentToRender = data ?? offlineDocument
  const isOfflineFallback = !data && Boolean(offlineDocument)
  const showLoading = isLoading && !documentToRender

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/documents">
          <ArrowLeft className="size-4" />
          Back to documents
        </Link>
      </Button>

      {showLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[420px] w-full" />
        </div>
      ) : null}

      {isError && !offlineDocument ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-lg font-semibold">Unable to load document</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        </div>
      ) : null}

      {documentToRender ? (
        <CollaborativeEditor
          document={documentToRender}
          isOfflineFallback={isOfflineFallback}
        />
      ) : null}
    </main>
  )
}
