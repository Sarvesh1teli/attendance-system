import { useState, useEffect, useRef } from 'react'
import { Bell, BellDot, Check, CheckCheck, Trash2, AlertTriangle, Info, XCircle, Zap } from 'lucide-react'
import type { AppNotificationData, NotificationSeverity } from '@main/ipc/types'
import { useNavigate } from 'react-router-dom'

const SEVERITY_STYLES: Record<NotificationSeverity, { icon: typeof Info; color: string; bg: string }> = {
  INFO:     { icon: Info,          color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/30' },
  WARNING:  { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950/30' },
  ERROR:    { icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950/30' },
  CRITICAL: { icon: Zap,           color: 'text-red-700',    bg: 'bg-red-100 dark:bg-red-900/40' },
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotificationData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [scanning, setScanning] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const loadNotifications = async () => {
    const [list, count] = await Promise.all([
      window.api.notification.list({ limit: 50 }),
      window.api.notification.getUnreadCount(),
    ])
    setNotifications(list)
    setUnreadCount(count)
  }

  useEffect(() => {
    loadNotifications()
    // Poll unread count every 60s
    const interval = setInterval(() => {
      window.api.notification.getUnreadCount().then(setUnreadCount)
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = async () => {
    setOpen(o => !o)
    if (!open) await loadNotifications()
  }

  const handleMarkRead = async (id: string) => {
    await window.api.notification.markRead(id)
    setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  const handleMarkAllRead = async () => {
    await window.api.notification.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const handleDelete = async (id: string) => {
    const n = notifications.find(x => x.notification_id === id)
    await window.api.notification.delete(id)
    setNotifications(prev => prev.filter(x => x.notification_id !== id))
    if (n && !n.is_read) setUnreadCount(c => Math.max(0, c - 1))
  }

  const handleScanShortage = async () => {
    setScanning(true)
    try {
      const count = await window.api.notification.scanShortage(75)
      await loadNotifications()
      if (count === 0) alert('No new shortage alerts — all students meet the 75% threshold.')
      else alert(`${count} new shortage alert(s) created.`)
    } finally {
      setScanning(false)
    }
  }

  const handleNavigate = async (n: AppNotificationData) => {
    if (!n.is_read) await handleMarkRead(n.notification_id)
    if (n.action_url) { navigate(n.action_url); setOpen(false) }
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button onClick={handleOpen} aria-label="Notifications" aria-expanded={open}
        className="relative p-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        {unreadCount > 0
          ? <BellDot className="h-5 w-5 text-amber-500" />
          : <Bell className="h-5 w-5" />}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 w-auto sm:w-96 max-h-[min(520px,75dvh)] bg-card border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <div>
              <h3 className="text-sm font-semibold">Notifications</h3>
              <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleScanShortage} disabled={scanning}
                title="Scan for shortage alerts"
                className="p-1.5 rounded text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">
                {scanning ? <span className="text-[10px]">Scanning…</span> : <AlertTriangle className="h-3.5 w-3.5" />}
              </button>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} title="Mark all read"
                  className="p-1.5 rounded text-muted-foreground hover:bg-muted">
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const style = SEVERITY_STYLES[n.severity]
                const Icon = style.icon
                return (
                  <div key={n.notification_id}
                    className={`flex gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${!n.is_read ? style.bg : ''}`}>
                    <div className={`mt-0.5 flex-shrink-0 ${style.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div
                      className={`flex-1 min-w-0 ${n.action_url ? 'cursor-pointer' : ''}`}
                      onClick={() => handleNavigate(n)}
                    >
                      <p className={`text-sm font-medium leading-tight ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {!n.is_read && (
                        <button onClick={() => handleMarkRead(n.notification_id)} title="Mark read"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(n.notification_id)} title="Delete"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t bg-muted/10 flex items-center justify-between">
            <button onClick={() => { navigate('/notifications'); setOpen(false) }}
              className="text-xs text-primary hover:underline font-medium">
              View all notifications
            </button>
            {notifications.length > 0 && (
              <button onClick={async () => { await window.api.notification.deleteAll(); await loadNotifications() }}
                className="text-xs text-muted-foreground hover:text-destructive">
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
