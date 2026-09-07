import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  ScanFace,
  Lock,
  Edit3,
  Calendar,
  AlertTriangle
} from 'lucide-react'

export default function LiveAttendanceSessionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Manual edit modal state
  const [selectedRecord, setSelectedRecord] = useState<any>(null)
  const [overrideStatus, setOverrideStatus] = useState<string>('PRESENT')
  const [overrideReason, setOverrideReason] = useState<string>('')

  const fetchSessionData = async () => {
    if (!id) return
    try {
      const data = await (window.api as any).attendance.getSession(id)
      setSession(data)
    } catch (err) {
      console.error('Failed to load session details', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessionData()
  }, [id])

  const handleQuickStatus = async (recordId: string, newStatus: string) => {
    try {
      await (window.api as any).attendance.updateRecord(
        recordId,
        newStatus,
        'Quick toggle from live desktop monitor'
      )
      await fetchSessionData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRecord) return
    try {
      await (window.api as any).attendance.updateRecord(
        selectedRecord.record_id,
        overrideStatus,
        overrideReason || 'Manual adjustment by admin'
      )
      setSelectedRecord(null)
      setOverrideReason('')
      await fetchSessionData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Override failed')
    }
  }

  const handleCloseSession = async () => {
    if (!id || !confirm('Are you sure you want to finish and lock this session?')) return
    try {
      await (window.api as any).attendance.closeSession(id)
      await fetchSessionData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to lock session')
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Loading session roster...</div>
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <h2 className="text-base font-bold text-foreground">Session not found</h2>
        <button
          onClick={() => navigate('/attendance')}
          className="mt-3 text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Attendance
        </button>
      </div>
    )
  }

  const records = session.records || []
  const filteredRecords = records.filter((r: any) => {
    const matchesSearch =
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.admission_number.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const presentCount = records.filter((r: any) => r.status === 'PRESENT').length
  const absentCount = records.filter((r: any) => r.status === 'ABSENT').length
  const lateCount = records.filter((r: any) => r.status === 'LATE').length
  const isLocked = session.status === 'SUBMITTED' || session.status === 'LOCKED'

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/attendance')}
              className="p-1 rounded hover:bg-muted text-muted-foreground transition"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-bold text-foreground">
              {session.subject_name} ({session.subject_code})
            </h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                isLocked
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
              }`}
            >
              {session.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground ml-6">
            <span><strong>Batch:</strong> {session.batch_name}</span>
            <span><strong>Faculty:</strong> {session.faculty_name}</span>
            <span><strong>Date:</strong> {session.session_date} ({session.start_time})</span>
            {session.topic_name && <span><strong>Topic:</strong> {session.topic_name}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isLocked && (
            <>
              <button
                onClick={() => navigate(`/attendance/session/${id}/recognize`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
              >
                <ScanFace className="h-3.5 w-3.5" />
                Face Recognition Mode
              </button>
              <button
                onClick={handleCloseSession}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition shadow-sm"
              >
                <Lock className="h-3.5 w-3.5" />
                Lock Session
              </button>
            </>
          )}
        </div>
      </div>

      {/* Option A Rule Banner */}
      <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 rounded-lg p-3 text-xs text-sky-800 dark:text-sky-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanFace className="h-4 w-4 text-sky-600 flex-shrink-0" />
          <span>
            <strong>Option A Rule Active:</strong> All {records.length} eligible students are snapshotted and pre-marked as <strong>ABSENT</strong>. Verified face match or manual entry transitions the record to <strong>PRESENT</strong>.
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-lg bg-card p-3 text-center">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Total Roster</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{records.length}</div>
        </div>
        <div className="border rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 p-3 text-center">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Present</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{presentCount}</div>
        </div>
        <div className="border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 p-3 text-center">
          <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Late</div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">{lateCount}</div>
        </div>
        <div className="border rounded-lg bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 p-3 text-center">
          <div className="text-[11px] font-semibold text-destructive uppercase">Absent</div>
          <div className="text-xl font-bold text-destructive mt-0.5">{absentCount}</div>
        </div>
      </div>

      {/* Roster Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search student or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded border bg-background text-foreground"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', 'PRESENT', 'ABSENT', 'LATE'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                statusFilter === filter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Roll No</th>
                <th className="px-4 py-2.5 font-medium">Student Name</th>
                <th className="px-4 py-2.5 font-medium">Biometric</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Method</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-muted-foreground">
                    No students match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r: any) => {
                  const isP = r.status === 'PRESENT'
                  const isA = r.status === 'ABSENT'
                  const isL = r.status === 'LATE'

                  return (
                    <tr key={r.record_id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {r.admission_number}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">
                        {r.student_name}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.face_enrolled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                            <CheckCircle className="h-3 w-3" /> Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block font-bold text-[10px] px-2 py-0.5 rounded ${
                            isP
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : isA
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-[11px]">
                        {r.recognition_method}
                        {r.manually_corrected ? (
                          <span className="ml-1 text-amber-600 dark:text-amber-400" title={r.correction_reason}>
                            (Edited)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1">
                        {!isLocked ? (
                          <>
                            <button
                              onClick={() => handleQuickStatus(r.record_id, isP ? 'ABSENT' : 'PRESENT')}
                              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                                isP
                                  ? 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {isP ? 'Mark Absent' : 'Mark Present'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRecord(r)
                                setOverrideStatus(r.status)
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Manual Override & Reason"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Locked</span>
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

      {/* Manual Override Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg max-w-sm w-full p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-foreground">
              Manual Override: {selectedRecord.student_name}
            </h3>
            <p className="text-xs text-muted-foreground">
              Roll No: {selectedRecord.admission_number}
            </p>

            <form onSubmit={handleSaveOverride} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Attendance Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="EXCUSED">EXCUSED</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Reason for Override <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Camera angle issue, student late permission..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save & Audit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
