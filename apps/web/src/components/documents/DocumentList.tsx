import { Link } from '@tanstack/react-router'
import { FileText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiClientError } from '#/lib/api-client'
import { useDeleteDocument, useDocuments } from '#/lib/queries'
import { CreateDocumentDialog } from '#/components/documents/CreateDocumentDialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function DocumentList() {
  const { data, isLoading, isError, error, refetch } = useDocuments()
  const deleteDocument = useDeleteDocument()

  async function handleDelete(id: string, name: string) {
    const confirmed = window.confirm(`Delete "${name}"? This cannot be undone.`)
    if (!confirmed) return

    try {
      await deleteDocument.mutateAsync(id)
      toast.success('Document deleted')
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Unable to delete document.'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Open a document to collaborate in real time.
          </p>
        </div>
        <CreateDocumentDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardFooter>
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : null}

      {isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Could not load documents</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {!isLoading && !isError && data?.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <FileText className="mb-2 size-10 text-muted-foreground" />
            <CardTitle>No documents yet</CardTitle>
            <CardDescription>
              Create your first document to start writing.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <CreateDocumentDialog />
          </CardFooter>
        </Card>
      ) : null}

      {!isLoading && !isError && data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((doc) => (
            <Card key={doc.id} className="flex flex-col">
              <CardHeader className="flex-1">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-lg">
                    {doc.name}
                  </CardTitle>
                  <Badge variant="secondary">Doc</Badge>
                </div>
                <CardDescription>
                  Updated {formatDate(doc.updatedAt)}
                </CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <Button asChild className="flex-1">
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: doc.id }}
                  >
                    Open
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Delete ${doc.name}`}
                  disabled={deleteDocument.isPending}
                  onClick={() => void handleDelete(doc.id, doc.name)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
