import { useEffect, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { FileText, LogOut } from 'lucide-react'
import { clearToken, isAuthenticated } from '#/lib/auth'
import { Button } from '#/components/ui/button'

export function AppHeader() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    setAuthenticated(isAuthenticated())
  }, [pathname])

  function handleLogout() {
    clearToken()
    setAuthenticated(false)
    void navigate({ to: '/login' })
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          to={authenticated ? '/documents' : '/'}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <FileText className="size-5" />
          Collab Editor
        </Link>

        <nav className="flex items-center gap-2">
          {authenticated ? (
            <>
              <Button variant="ghost" asChild>
                <Link to="/documents">Documents</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="size-4" />
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
