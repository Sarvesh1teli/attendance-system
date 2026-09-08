import { useState, useEffect } from 'react'
import { db, LocalAttendanceSession, LocalAttendanceRecord } from '../db/pwa-db'
import { usePwaAuth } from '../context/PwaAuthContext'
import { Calendar, CheckCircle2, Clock, CloudUpload, BookOpen, AlertCircle } from 'lucide-react'
import { formatTo12Hour } from '../utils/time-utils'

export default function SessionHistoryPage() {
  const { isOnline, pendingSyncCount, triggerSync } = usePwaAuth()
  const [sessions, setSessions] = useState<LocalAttendanceSession[]>([])
  const [sessionRecords, setSessionRecords] = useState<Record<string, LocalAttendanceRecord[]>>({})
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadHistory = async () => {
    setLoading(true)
    try {
      const allSessions = await db.sessions.orderBy('session_date').reverse().toArray()
      setSessions(allSessions)

      const recMap: Record<string, LocalAttendanceRecord[]> = {}
      for (const s of allSessions) {
        const recs = await db.records.where('session_id').equals(s.session_id).toArray()
        recMap[s.session_id] = recs
      }
      setSessionRecords(recMap)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const handleSyncNow = async () => {
    setSyncing(true)
    const res = await triggerSync()
    if (res.error) {
      alert('Sync failed: ' + res.error)
    } else if (res.synced > 0) {
      await loadHistory()
      alert(`Successfully synced ${res.synced} session(s) to cloud!`)
    } else {
      await loadHistory()
      alert('All attendance sessions are already synced with cloud!')
    }
    setSyncing(false)
  }

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Attendance History</h2>
          <p className="text-xs text-muted-foreground">Local sessions logged on this device</p>
        </div>

        {pendingSyncCount > 0 ? (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <CloudUpload className="h-4 w-4" />
            <span>{syncing ? 'Syncing...' : `Sync (${pendingSyncCount})`}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            <span>All Synced</span>
          </div>
        )}
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading session logs...</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center bg-card border rounded-2xl text-xs text-muted-foreground">
            No attendance sessions recorded yet.
          </div>
        ) : (
          sessions.map((s) => {
            const recs = sessionRecords[s.session_id] || []
            const total = recs.length
            const present = recs.filter((r) => r.status === 'PRESENT').length
            const late = recs.filter((r) => r.status === 'LATE').length
            const absent = recs.filter((r) => r.status === 'ABSENT').length
            const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0

            return (
              <div
                key={s.session_id}
                className="bg-card border rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground font-mono">
                        {s.session_date}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          s.sync_status === 'SYNCED'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }`}
                      >
                        {s.sync_status === 'SYNCED' ? 'Cloud Synced' : 'Local Only'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTo12Hour(s.start_time)} — {formatTo12Hour(s.end_time) || 'In Progress'}</span>
                    </div>
                  </div>

                  {/* Percentage Pill */}
                  <div className="text-right">
                    <div className="text-base font-extrabold text-foreground">{pct}%</div>
                    <div className="text-[10px] text-muted-foreground">Attendance</div>
                  </div>
                </div>

                {/* Topic info */}
                {(s.topic_id || s.custom_topic) && (
                  <div className="bg-muted/40 p-2.5 rounded-xl text-xs flex items-start gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground italic">
                      {s.custom_topic || 'Syllabus Topic Covered'}
                    </span>
                  </div>
                )}

                {/* Stats Breakdown Bar */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px]">Present: </span>
                    <strong className="text-emerald-600">{present}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Late: </span>
                    <strong className="text-amber-600">{late}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Absent: </span>
                    <strong className="text-rose-600">{absent}</strong>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
