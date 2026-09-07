import { useState, useEffect } from 'react'
import { Bell, AlertTriangle, Download, RefreshCw, Trash2, Check, CheckCheck, Info, XCircle, Zap, Filter } from 'lucide-react'
import type { AppNotificationData, NotificationTypeEnum, NotificationSeverity } from '@main/ipc/types'

const SEVERITY_STYLES: Record<NotificationSeverity, { icon: typeof Info; dot: string; badge: string }> = {
  INFO:     { icon: Info,          dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  WARNING:  { icon: AlertTriangle, dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  ERROR:    { icon: XCircle,       dot: 'bg-red-400',    badge: 'bg-red-100 text-red-600' },
  CRITICAL: { icon: Zap,           dot: 'bg-red-600',    badge: 'bg-red-200 text-red-800 font-bold' },
}

const TYPE_LABELS: Record<NotificationTypeEnum, string> = {
  SHORTAGE_ALERT:   'Shortage',
  SESSION_REMINDER: 'Session',
  SYNC_SUCCESS:     'Sync OK',
  SYNC_FAILED:      'Sync Fail',
  PARENT_ALERT:     'Parent',
  SYSTEM:           'System',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotificationData[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [filterType, setFilterType] = useState<NotificationTypeEnum | ''>('')
  const [scanning, setScanning] = useState(false)
  const [threshold, setThreshold] = useState(75)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const list = await window.api.notification.list({
        unread_only: unreadOnly || undefined,
        type: filterType || undefined,
        limit: 500,
      })
      setNotifications(list)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [unreadOnly, filterType])

  const handleMarkRead = async (id: string) => {
    await window.api.notification.markRead(id)
    setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n))
  }

  const handleMarkAllRead = async () => {
    await window.api.notification.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const handleDelete = async (id: string) => {
    await window.api.notification.delete(id)
    setNotifications(prev => prev.filter(n => n.notification_id !== id))
  }

  const handleDeleteAll = async () => {
    if (!confirm('Delete all notifications?')) return
    await window.api.notification.deleteAll()
    setNotifications([])
  }

  const handleScanShortage = async () => {
    setScanning(true)
    try {
      const count = await window.api.notification.scanShortage(threshold)
      await load()
      alert(count === 0
        ? `No new alerts — all students meet the ${threshold}% threshold.`
        : `${count} new shortage alert(s) created.`
      )
    } finally { setScanning(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try { await window.api.notification.exportShortageLetters(threshold) }
    finally { setExporting(false) }
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm">{unreadCount} unread · {notifications.length} total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Shortage scan */}
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5">
            <label className="text-xs text-muted-foreground">Threshold:</label>
            <input type="number" min={50} max={100} step={5}
              value={threshold} onChange={e => setThreshold(Number(e.target.value))}
              className="w-14 text-xs border rounded px-1.5 py-0.5 bg-background text-center" />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <button onClick={handleScanShortage} disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-60">
            {scanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            Scan Shortage
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-60">
            {exporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export Letters
          </button>
          <button onClick={load} className="p-1.5 rounded-lg border hover:bg-muted" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}
              className="rounded" />
            Unread only
          </label>
        </div>
        <select className="border rounded-md px-3 py-1.5 text-sm bg-background"
          value={filterType} onChange={e => setFilterType(e.target.value as NotificationTypeEnum | '')}>
          <option value="">All Types</option>
          {(Object.keys(TYPE_LABELS) as NotificationTypeEnum[]).map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
        {notifications.length > 0 && (
          <button onClick={handleDeleteAll}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive ml-auto">
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm">No notifications match your filters.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click <strong>Scan Shortage</strong> to check for attendance alerts.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map(n => {
              const style = SEVERITY_STYLES[n.severity]
              const Icon = style.icon
              return (
                <div key={n.notification_id}
                  className={`flex gap-4 px-5 py-4 hover:bg-muted/20 transition-colors ${!n.is_read ? 'bg-muted/10' : ''}`}>
                  {/* Unread dot */}
                  <div className="flex flex-col items-center pt-1.5">
                    {!n.is_read
                      ? <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                      : <span className="w-2 h-2" />}
                  </div>
                  <div className={`mt-0.5 flex-shrink-0 ${n.severity === 'CRITICAL' ? 'text-red-600' : n.severity === 'ERROR' ? 'text-red-500' : n.severity === 'WARNING' ? 'text-amber-600' : 'text-blue-500'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${!n.is_read ? '' : 'text-muted-foreground'}`}>{n.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${style.badge}`}>
                        {TYPE_LABELS[n.type]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.is_read && (
                      <button onClick={() => handleMarkRead(n.notification_id)}
                        title="Mark read"
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(n.notification_id)}
                      title="Delete"
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {notifications.length > 0 && (
          <div className="px-5 py-2.5 border-t text-xs text-muted-foreground bg-muted/10">
            Showing {notifications.length} notifications
          </div>
        )}
      </div>
    </div>
  )
}
