import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '../components/navigation/Sidebar'
import { TopBar } from '../components/navigation/TopBar'

export function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Automatically close mobile menu whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-background text-foreground">
      {/* Desktop Persistent Sidebar (hidden on mobile, visible on lg screens) */}
      <div className="hidden lg:flex lg:w-56 lg:flex-col shrink-0 border-r bg-card">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay (rendered only on mobile when menu is open) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Slide-out Drawer Panel */}
          <div className="relative z-50 w-72 max-w-[85vw] h-full bg-card shadow-2xl flex flex-col border-r animate-in slide-in-from-left duration-200">
            <Sidebar
              onNavigate={() => setMobileMenuOpen(false)}
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onOpenMenu={() => setMobileMenuOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto p-3.5 sm:p-6 bg-muted/20">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
