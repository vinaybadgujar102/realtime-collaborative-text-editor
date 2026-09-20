import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '#/lib/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && isAuthenticated()) {
      throw redirect({ to: '/documents' })
    }
    throw redirect({ to: '/login' })
  },
})
