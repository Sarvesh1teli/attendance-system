import { useState, useEffect } from 'react'
import { Shield, RefreshCw } from 'lucide-react'
import type { AuditLog } from '@main/ipc/types'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-600',
  LOGIN: 'bg-purple-100 text-purple-700',
  LOGOUT: 'bg-gray-100 text-gray-600',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await window.api.audit.list({
        action: filterAction || undefined,
        entity_type: filterEntity || undefined,
        from_date: filterFrom || undefined,
        to_date: filterTo || undefined,
        limit: 500,
      })
      setLogs(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterAction, filterEntity, filterFrom, filterTo])

  const actionColor = (action: string) => ACTION_COLORS[action.toUpperCase()] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground text-sm">View system audit trail and change history</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-muted disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="">All Actions</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input className="border rounded-md px-3 py-2 text-sm bg-background"
          placeholder="Filter by entity type…" value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)} />
        <div className="flex items-center gap-2">
          <input type="date" className="border rounded-md px-3 py-2 text-sm bg-background"
            value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From date" />
          <span className="text-muted-foreground text-sm">to</span>
          <input type="date" className="border rounded-md px-3 py-2 text-sm bg-background"
            value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To date" />
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">No audit logs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.audit_id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.entity_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{log.user_id ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {log.new_value ? (
                        <span title={log.new_value} className="cursor-help">{log.new_value.slice(0, 80)}{log.new_value.length > 80 ? '…' : ''}</span>
                      ) : log.reason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logs.length > 0 && (
          <div className="px-4 py-3 border-t text-xs text-muted-foreground">
            Showing {logs.length} entries (max 500)
          </div>
        )}
      </div>
    </div>
  )
}
