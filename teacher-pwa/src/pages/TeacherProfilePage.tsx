import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/pwa-db'
import { usePwaAuth } from '../context/PwaAuthContext'
import { User, Building2, HardDrive, CloudUpload, LogOut, CheckCircle, RefreshCw } from 'lucide-react'

export default function TeacherProfilePage() {
  const navigate = useNavigate()
  const { teacher, isOnline, pendingSyncCount, triggerSync, logout, clearAllData } = usePwaAuth()
  const [stats, setStats] = useState({
    classes: 0,
    students: 0,
    sessions: 0,
    queue: 0,
  })
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    async function loadStats() {
      const classes = await db.classes.count()
      const students = await db.students.count()
      const sessions = await db.sessions.count()
      const queue = await db.syncQueue.count()
      setStats({ classes, students, sessions, queue })
    }
    loadStats()
  }, [pendingSyncCount])

  const handleSync = async () => {
    setSyncing(true)
    const res = await triggerSync()
    if (res.error) {
      alert('Sync failed: ' + res.error)
    } else if (res.synced > 0) {
      alert(`Successfully synced ${res.synced} attendance session(s) with cloud!`)
    } else {
      alert('All attendance records and roster are up to date with cloud.')
    }
    setSyncing(false)
  }

  const handleLogout = async () => {
    if (pendingSyncCount > 0) {
      if (!confirm('You have unsynced attendance records. Are you sure you want to log out?')) return
    }
    await logout()
    navigate('/login')
  }

  const handleResetData = async () => {
    if (!confirm('This will completely wipe all local cached classes, students, and attendance records from this browser. Proceed?')) return
    await clearAllData()
    navigate('/login')
  }

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl mx-auto ring-8 ring-primary/5">
          {teacher?.name.charAt(0) || 'T'}
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{teacher?.name || 'Teacher Profile'}</h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{teacher?.employee_id}</p>
        </div>

        <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground space-y-1 text-left">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{teacher?.institution_name}</span>
          </div>
          <div className="text-[11px] pl-5.5">{teacher?.department}</div>
        </div>
      </div>

      {/* Local Storage & Offline Status */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <HardDrive className="h-4 w-4 text-primary" />
          <span>Local Storage Metrics</span>
        </h3>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/30 p-2.5 rounded-xl">
            <div className="text-muted-foreground text-[11px]">Cached Classes</div>
            <div className="text-base font-bold text-foreground">{stats.classes}</div>
          </div>
          <div className="bg-muted/30 p-2.5 rounded-xl">
            <div className="text-muted-foreground text-[11px]">Enrolled Students</div>
            <div className="text-base font-bold text-foreground">{stats.students}</div>
          </div>
          <div className="bg-muted/30 p-2.5 rounded-xl">
            <div className="text-muted-foreground text-[11px]">Offline Sessions</div>
            <div className="text-base font-bold text-foreground">{stats.sessions}</div>
          </div>
          <div className="bg-muted/30 p-2.5 rounded-xl">
            <div className="text-muted-foreground text-[11px]">Pending Sync Outbox</div>
            <div className={`text-base font-bold ${stats.queue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {stats.queue}
            </div>
          </div>
        </div>

        {stats.queue > 0 && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
          >
            {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
            <span>Sync Outbox to Cloud ({stats.queue})</span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-foreground border bg-card hover:bg-accent py-3 rounded-xl text-xs font-semibold transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out of PWA</span>
        </button>

        <button
          onClick={handleResetData}
          className="w-full flex items-center justify-center gap-2 text-rose-600 border border-rose-200 bg-rose-50/50 hover:bg-rose-100 py-3 rounded-xl text-xs font-semibold transition-colors"
        >
          <HardDrive className="h-4 w-4" />
          <span>Reset / Wipe All Local Data</span>
        </button>
      </div>
    </div>
  )
}
