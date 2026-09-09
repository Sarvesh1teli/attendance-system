import { useAuth } from '../../context/AuthContext'
import { LogOut, UserCheck, Menu } from 'lucide-react'
import { SyncStatusWidget } from '../sync/SyncStatusWidget'
import { NotificationBell } from '../notifications/NotificationBell'

export function TopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { user, logout } = useAuth()

  return (
    <header className="h-14 min-h-[3.5rem] border-b bg-card flex items-center justify-between px-3 sm:px-6 flex-shrink-0 z-10">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        <button
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <SyncStatusWidget />
      </div>
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        {/* Notification Bell */}
        <NotificationBell />

        {user ? (
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                <UserCheck className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold leading-none text-foreground">
                  {user.username}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-medium uppercase tracking-wider">
                  {user.role}
                </div>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              aria-label="Sign out"
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Guest</span>
        )}
      </div>
    </header>
  )
}
