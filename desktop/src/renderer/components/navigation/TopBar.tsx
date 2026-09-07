import { useAuth } from '../../context/AuthContext'
import { LogOut, UserCheck } from 'lucide-react'
import { SyncStatusWidget } from '../sync/SyncStatusWidget'
import { NotificationBell } from '../notifications/NotificationBell'

export function TopBar() {
  const { user, logout } = useAuth()

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <SyncStatusWidget />
      </div>
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <NotificationBell />

        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
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
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
