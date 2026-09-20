import { createFileRoute, redirect } from '@tanstack/react-router'
import { DocumentList } from '#/components/documents/DocumentList'
import { isAuthenticated } from '#/lib/auth'

export const Route = createFileRoute('/documents/')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: DocumentsPage,
  head: () => ({
    meta: [{ title: 'Documents · Collab Editor' }],
  }),
})

function DocumentsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <DocumentList />
    </main>
  )
}
