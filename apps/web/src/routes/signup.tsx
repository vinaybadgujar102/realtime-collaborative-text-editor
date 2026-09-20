import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignupForm } from '#/components/auth/SignupForm'
import { isAuthenticated } from '#/lib/auth'

export const Route = createFileRoute('/signup')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && isAuthenticated()) {
      throw redirect({ to: '/documents' })
    }
  },
  component: SignupPage,
  head: () => ({
    meta: [{ title: 'Sign up · Collab Editor' }],
  }),
})

function SignupPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl items-center justify-center px-4 py-10">
      <SignupForm />
    </main>
  )
}
