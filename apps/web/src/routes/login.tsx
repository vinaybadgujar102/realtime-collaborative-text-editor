import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginForm } from '#/components/auth/LoginForm'
import { isAuthenticated } from '#/lib/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && isAuthenticated()) {
      throw redirect({ to: '/documents' })
    }
  },
  component: LoginPage,
  head: () => ({
    meta: [{ title: 'Sign in · Collab Editor' }],
  }),
})

function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl items-center justify-center px-4 py-10">
      <LoginForm />
    </main>
  )
}
