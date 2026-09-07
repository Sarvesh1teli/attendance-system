import { useState, useEffect } from 'react'
import {
  UserCheck,
  Clock,
  LogIn,
  LogOut,
  Calendar,
  Building,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

export default function FacultyDailyAttendancePage() {
  const [logs, setLogs] = useState<any[]>([])
  const [faculties, setFaculties] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [loading, setLoading] = useState(true)

  // Quick check-in state
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const loadData = async () => {
    try {
      setLoading(true)
      const [logList, facList] = await Promise.all([
        (window.api as any).facultyDailyLog.getDailyLogs(selectedDate),
        window.api.faculty.list(),
      ])
      setLogs(logList)
      setFaculties(facList)
      if (facList.length > 0 && !selectedFacultyId) {
        setSelectedFacultyId(facList[0].faculty_id)
      }
    } catch (err) {
      console.error('Failed to load faculty daily logs', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedDate])

  const handleCheckIn = async (facultyId: string) => {
    try {
      await (window.api as any).facultyDailyLog.checkIn(facultyId, 'MANUAL', notes)
      setNotes('')
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Check-in failed')
    }
  }

  const handleCheckOut = async (facultyId: string) => {
    try {
      await (window.api as any).facultyDailyLog.checkOut(facultyId)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Check-out failed')
    }
  }

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            Faculty Daily Attendance & Time Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track daily faculty campus arrivals, departures, total working hours, and verification methods.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded border bg-background text-foreground"
          />
        </div>
      </div>

      {/* Quick Check-in Banner */}
      <div className="border rounded-lg bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10 text-primary">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Record Faculty Entry</div>
            <div className="text-[11px] text-muted-foreground">Check in faculty arrival manually or via facial recognition.</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedFacultyId}
            onChange={(e) => setSelectedFacultyId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded border bg-background text-foreground"
          >
            {faculties.map((f) => (
              <option key={f.faculty_id} value={f.faculty_id}>
                {f.name} ({f.employee_id})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Optional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="px-3 py-1.5 text-xs rounded border bg-background text-foreground w-40"
          />

          <button
            onClick={() => selectedFacultyId && handleCheckIn(selectedFacultyId)}
            className="px-3.5 py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            Check In
          </button>
        </div>
      </div>

      {/* Daily Logs Table */}
      <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="p-4 border-b bg-muted/40 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">
            Attendance Log for {selectedDate} ({logs.length} checked in)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Emp ID</th>
                <th className="px-4 py-2.5 font-medium">Faculty Name</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Check In</th>
                <th className="px-4 py-2.5 font-medium">Check Out</th>
                <th className="px-4 py-2.5 font-medium">Hours</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No faculty check-ins recorded for this date.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const hasCheckedOut = !!log.check_out_time

                  return (
                    <tr key={log.log_id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {log.employee_id}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">
                        {log.faculty_name}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {log.department_name || 'General'}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-emerald-600">
                        {log.check_in_time}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-indigo-600">
                        {log.check_out_time || '--:--:--'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {hasCheckedOut ? formatHours(log.total_minutes) : 'In Progress'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block font-bold text-[10px] px-2 py-0.5 rounded ${
                            log.status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {!hasCheckedOut ? (
                          <button
                            onClick={() => handleCheckOut(log.faculty_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
                          >
                            <LogOut className="h-3 w-3" /> Check Out
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Completed</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
