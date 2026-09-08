import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, Calendar, ClipboardCheck, History, User, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { usePwaAuth } from '../../context/PwaAuthContext'
import { cn } from '../../lib/utils'

export function PwaLayout() {
  const { teacher, isOnline, pendingSyncCount, triggerSync } = usePwaAuth()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSyncClick = async () => {
    try {
      setIsSyncing(true)
      const res = await triggerSync()
      if (res.error) {
        alert('Sync error: ' + res.error)
      } else {
        alert(`Cloud sync complete! Roster and classes updated.`)
      }
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background shadow-2xl border-x overflow-hidden">
      {/* Top Header */}
      <header className="h-14 bg-card border-b px-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-sm font-bold text-foreground leading-tight">
            {teacher?.name || 'Teli Teacher'}
          </h1>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            {teacher?.department || 'Medical Department'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Permanent Cloud Sync Button */}
          <button
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
            title="Sync with cloud backend"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            <span>{isSyncing ? 'Syncing...' : pendingSyncCount > 0 ? `Sync (${pendingSyncCount})` : 'Sync'}</span>
          </button>

          {/* Online/Offline status badge */}
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
              isOnline
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            )}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-16 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 z-40">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          <Home className="h-5 w-5" />
          <span className="mt-1">Home</span>
        </NavLink>

        <NavLink
          to="/schedule"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          <Calendar className="h-5 w-5" />
          <span className="mt-1">Schedule</span>
        </NavLink>

        <NavLink
          to="/attendance"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          <div className="relative">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <span className="mt-1">Attendance</span>
        </NavLink>

        <NavLink
          to="/history"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          <History className="h-5 w-5" />
          <span className="mt-1">History</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          <User className="h-5 w-5" />
          <span className="mt-1">Profile</span>
        </NavLink>
      </nav>
    </div>
  )
}
