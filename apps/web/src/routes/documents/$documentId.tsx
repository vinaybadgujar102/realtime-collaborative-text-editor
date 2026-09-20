import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { CollaborativeEditor } from '#/components/editor/CollaborativeEditor'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { isAuthenticated } from '#/lib/auth'
import { useDocument } from '#/lib/queries'

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
  const { data, isLoading, isError, error } = useDocument(documentId)

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/documents">
          <ArrowLeft className="size-4" />
          Back to documents
        </Link>
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[420px] w-full" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-lg font-semibold">Unable to load document</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        </div>
      ) : null}

      {data ? <CollaborativeEditor document={data} /> : null}
    </main>
  )
}
