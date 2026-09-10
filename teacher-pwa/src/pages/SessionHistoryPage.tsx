import { useState, useEffect, useMemo } from 'react'
import {
  db,
  LocalAttendanceSession,
  LocalAttendanceRecord,
  AssignedClass,
  CachedStudent,
  isClassAssignedToTeacher,
} from '../db/pwa-db'
import { usePwaAuth } from '../context/PwaAuthContext'
import {
  Calendar,
  CheckCircle2,
  Clock,
  CloudUpload,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  CalendarDays,
  FileSpreadsheet,
  List,
} from 'lucide-react'
import { formatTo12Hour, DAY_SHORT } from '../utils/time-utils'

const SESSIONS_PER_PAGE = 10
const STUDENTS_PER_PAGE = 15

export default function SessionHistoryPage() {
  const { teacher, pendingSyncCount, triggerSync } = usePwaAuth()

  // Tab switcher state: 'SESSIONS' (Daily Logs) or 'MONTHLY' (1-31 Days Register)
  const [activeTab, setActiveTab] = useState<'SESSIONS' | 'MONTHLY'>('SESSIONS')

  const [sessions, setSessions] = useState<LocalAttendanceSession[]>([])
  const [classes, setClasses] = useState<AssignedClass[]>([])
  const [students, setStudents] = useState<CachedStudent[]>([])
  const [sessionRecords, setSessionRecords] = useState<Record<string, LocalAttendanceRecord[]>>({})
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  // ─── Pagination & Filter for Session Logs ──────────────────────────────────
  const [sessionPage, setSessionPage] = useState(1)

  // ─── Filters & State for Monthly Register ──────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [studentPage, setStudentPage] = useState(1)

  // Load all necessary data from local IndexedDB
  const loadHistoryData = async () => {
    setLoading(true)
    try {
      const [allSessions, allClasses, allStudents, allRecords] = await Promise.all([
        db.sessions.toArray(),
        db.classes.toArray(),
        db.students.toArray(),
        db.records.toArray(),
      ])

      // Sort sessions strictly latest first: date DESC, start_time DESC, created_at DESC
      allSessions.sort((a, b) => {
        const dateDiff = b.session_date.localeCompare(a.session_date)
        if (dateDiff !== 0) return dateDiff
        const timeDiff = (b.start_time || '').localeCompare(a.start_time || '')
        if (timeDiff !== 0) return timeDiff
        return (b.created_at || '').localeCompare(a.created_at || '')
      })

      // Normalize classes
      const normalizedClasses: AssignedClass[] = allClasses.map((c: any) => ({
        ...c,
        batch_id: c.batch_id || c.batchId || '',
        batch_name: c.batch_name || c.batchName || '',
        subject_id: c.subject_id || c.subjectId || '',
        subject_name: c.subject_name || c.subjectName || '',
        subject_code: c.subject_code || c.subjectCode || '',
      }))

      const myClasses = normalizedClasses.filter((c: any) => isClassAssignedToTeacher(c, teacher))
      const availableClasses = myClasses.length > 0 ? myClasses : normalizedClasses

      setSessions(allSessions)
      setClasses(availableClasses)
      setStudents(allStudents)

      if (availableClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(availableClasses[0].id)
      }

      // Group records by session_id
      const recMap: Record<string, LocalAttendanceRecord[]> = {}
      for (const r of allRecords) {
        if (!recMap[r.session_id]) recMap[r.session_id] = []
        recMap[r.session_id].push(r)
      }
      setSessionRecords(recMap)
    } catch (err) {
      console.error('Failed to load history data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistoryData()
  }, [teacher?.id, teacher?.employee_id, teacher?.name])

  const handleSyncNow = async () => {
    setSyncing(true)
    const res = await triggerSync()
    if (res.error) {
      alert('Sync failed: ' + res.error)
    } else if (res.synced > 0) {
      await loadHistoryData()
      alert(`Successfully synced ${res.synced} session(s) to cloud!`)
    } else {
      await loadHistoryData()
      alert('All attendance sessions are up to date with cloud.')
    }
    setSyncing(false)
  }

  // Lookup map for student names
  const studentMap = useMemo(() => {
    const map = new Map<string, CachedStudent>()
    students.forEach((s) => map.set(s.student_id, s))
    return map
  }, [students])

  // Lookup map for classes
  const classMap = useMemo(() => {
    const map = new Map<string, AssignedClass>()
    classes.forEach((c) => {
      map.set(c.id, c)
      if (c.batch_id) map.set(c.batch_id, c)
    })
    return map
  }, [classes])

  // ─── Session Logs Computations & Pagination ────────────────────────────────
  const totalSessionPages = Math.max(1, Math.ceil(sessions.length / SESSIONS_PER_PAGE))
  const currentSessions = useMemo(() => {
    const start = (sessionPage - 1) * SESSIONS_PER_PAGE
    return sessions.slice(start, start + SESSIONS_PER_PAGE)
  }, [sessions, sessionPage])

  // ─── Monthly Register Computations ─────────────────────────────────────────
  const year = selectedMonth.getFullYear()
  const monthIdx = selectedMonth.getMonth() // 0-11
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const monthDays = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [daysInMonth])

  const monthLabel = selectedMonth.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() - 1)
      return next
    })
    setStudentPage(1)
  }

  const handleNextMonth = () => {
    setSelectedMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + 1)
      return next
    })
    setStudentPage(1)
  }

  // Selected class object
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0] || null
  }, [classes, selectedClassId])

  // Students enrolled in selected class (strict batch isolation)
  const classStudents = useMemo(() => {
    if (!currentClass) return []
    return students.filter(
      (s) => s.class_id === currentClass.batch_id || s.class_id === currentClass.id
    )
  }, [students, currentClass])

  const totalStudentPages = Math.max(1, Math.ceil(classStudents.length / STUDENTS_PER_PAGE))
  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * STUDENTS_PER_PAGE
    return classStudents.slice(start, start + STUDENTS_PER_PAGE)
  }, [classStudents, studentPage])

  // Sessions for this class in this month: Map of dayOfMonth -> session
  const monthDateSessions = useMemo(() => {
    const monthPrefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}-`
    const map: Record<number, LocalAttendanceSession> = {}

    sessions.forEach((s) => {
      if (s.session_date.startsWith(monthPrefix)) {
        // Match class/batch/subject if possible
        const isClassMatch =
          !currentClass ||
          s.batch_id === currentClass.batch_id ||
          s.subject_id === currentClass.subject_id

        if (isClassMatch) {
          const dayNum = parseInt(s.session_date.split('-')[2], 10)
          if (!map[dayNum]) {
            map[dayNum] = s
          }
        }
      }
    })
    return map
  }, [sessions, year, monthIdx, currentClass])

  // Compute stats per student for the selected month
  const studentMonthlyStats = useMemo(() => {
    const stats: Record<string, { present: number; absent: number; total: number; pct: number }> = {}
    const sessionDays = Object.keys(monthDateSessions).map(Number)
    const totalClassDays = sessionDays.length

    classStudents.forEach((stu) => {
      let p = 0
      let a = 0

      sessionDays.forEach((day) => {
        const sess = monthDateSessions[day]
        if (!sess) return
        const recs = sessionRecords[sess.session_id] || []
        const rec = recs.find((r) => r.student_id === stu.student_id)
        if (rec) {
          if (rec.status === 'PRESENT' || rec.status === 'LATE') {
            p++
          } else {
            a++
          }
        }
      })

      const total = p + a
      const pct = total > 0 ? Math.round((p / total) * 100) : 0
      stats[stu.student_id] = { present: p, absent: a, total, pct }
    })

    return { stats, totalClassDays }
  }, [classStudents, monthDateSessions, sessionRecords])

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Attendance Records</h2>
          <p className="text-xs text-muted-foreground">Session logs & monthly register</p>
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

      {/* Two Sub-Menus / Tabs Switcher */}
      <div className="grid grid-cols-2 p-1 bg-muted/60 border rounded-2xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab('SESSIONS')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
            activeTab === 'SESSIONS'
              ? 'bg-card text-primary font-bold shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <List className="h-4 w-4" />
          <span>Session Logs ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MONTHLY')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
            activeTab === 'MONTHLY'
              ? 'bg-card text-primary font-bold shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Monthly Register (1–31)</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: SESSION LOGS (DAILY SESSIONS WITH PAGINATION)                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'SESSIONS' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading session logs...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center bg-card border rounded-2xl text-xs text-muted-foreground space-y-2">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="font-semibold text-foreground">No attendance sessions recorded yet.</p>
              <p className="text-[11px]">Completed sessions will appear here sorted by latest date.</p>
            </div>
          ) : (
            <>
              {/* Pagination Top Summary */}
              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>
                  Showing {(sessionPage - 1) * SESSIONS_PER_PAGE + 1}–
                  {Math.min(sessionPage * SESSIONS_PER_PAGE, sessions.length)} of {sessions.length} sessions
                </span>
                <span className="font-semibold text-foreground">
                  Page {sessionPage} of {totalSessionPages}
                </span>
              </div>

              {/* Sessions List */}
              {currentSessions.map((s) => {
                const recs = sessionRecords[s.session_id] || []
                const total = recs.length
                const present = recs.filter((r) => r.status === 'PRESENT').length
                const late = recs.filter((r) => r.status === 'LATE').length
                const absent = recs.filter((r) => r.status === 'ABSENT').length
                const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0

                const clsInfo = classMap.get(s.batch_id) || classMap.get(s.subject_id)
                const isExpanded = expandedSessionId === s.session_id

                // Format session date nicely (e.g., Wed, 09 Sep 2026)
                const dateObj = new Date(s.session_date + 'T00:00:00')
                const formattedDate = dateObj.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })

                return (
                  <div
                    key={s.session_id}
                    className="bg-card border rounded-2xl p-4 shadow-sm hover:border-primary/30 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground font-mono">
                            {formattedDate}
                          </span>

                          {/* Class type badge */}
                          {s.session_type === 'SUBSTITUTE' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              🔄 Substitute
                            </span>
                          )}
                          {s.session_type === 'EXTRA' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              📌 Extra Class
                            </span>
                          )}
                          {s.session_type === 'RESCHEDULED' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              📅 Rescheduled
                            </span>
                          )}

                          {/* Sync status badge */}
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

                        {clsInfo && (
                          <div className="text-xs font-semibold text-foreground">
                            {clsInfo.subject_name}{' '}
                            <span className="text-muted-foreground font-normal">
                              ({clsInfo.batch_name})
                            </span>
                          </div>
                        )}

                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatTo12Hour(s.start_time)} — {formatTo12Hour(s.end_time) || 'In Progress'}
                          </span>
                        </div>
                      </div>

                      {/* Percentage Pill */}
                      <div className="text-right flex-shrink-0">
                        <div
                          className={`text-lg font-extrabold ${
                            pct >= 75 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'
                          }`}
                        >
                          {pct}%
                        </div>
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
                      <div className="bg-emerald-500/5 rounded-lg py-1">
                        <span className="text-muted-foreground text-[10px]">Present: </span>
                        <strong className="text-emerald-600 font-bold">{present}</strong>
                      </div>
                      <div className="bg-amber-500/5 rounded-lg py-1">
                        <span className="text-muted-foreground text-[10px]">Late: </span>
                        <strong className="text-amber-600 font-bold">{late}</strong>
                      </div>
                      <div className="bg-rose-500/5 rounded-lg py-1">
                        <span className="text-muted-foreground text-[10px]">Absent: </span>
                        <strong className="text-rose-600 font-bold">{absent}</strong>
                      </div>
                    </div>

                    {/* Expandable Student List Accordion */}
                    <div className="pt-1">
                      <button
                        onClick={() => setExpandedSessionId(isExpanded ? null : s.session_id)}
                        className="w-full flex items-center justify-between text-[11px] font-semibold text-primary hover:underline py-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span>{isExpanded ? 'Hide Student List' : `View Student Breakdown (${total})`}</span>
                        </span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border bg-muted/20 p-2 space-y-1.5 text-xs">
                          {recs.map((r) => {
                            const stu = studentMap.get(r.student_id)
                            const isPres = r.status === 'PRESENT' || r.status === 'LATE'
                            return (
                              <div
                                key={r.record_id}
                                className="flex items-center justify-between p-1.5 rounded-lg bg-card border"
                              >
                                <div className="truncate pr-2">
                                  <span className="font-semibold text-foreground">
                                    {stu?.name || r.student_id}
                                  </span>
                                  {stu?.admission_number && (
                                    <span className="text-[10px] text-muted-foreground font-mono ml-1.5">
                                      ({stu.admission_number})
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isPres
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : 'bg-rose-500/10 text-rose-600'
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Pagination Controls */}
              {totalSessionPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                    disabled={sessionPage === 1}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border bg-card text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-accent transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>

                  <span className="text-xs font-bold text-muted-foreground">
                    Page {sessionPage} of {totalSessionPages}
                  </span>

                  <button
                    onClick={() => setSessionPage((p) => Math.min(totalSessionPages, p + 1))}
                    disabled={sessionPage === totalSessionPages}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border bg-card text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-accent transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: MONTHLY REGISTER (1 TO 31 DAYS MATRIX WITH STUDENT PAGINATION) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'MONTHLY' && (
        <div className="space-y-3">
          {/* Controls: Month Selector & Class Picker */}
          <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
            {/* Month & Year Navigator */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl border bg-muted/30 hover:bg-muted text-foreground transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-center">
                <div className="text-sm font-bold text-foreground">{monthLabel}</div>
                <div className="text-[11px] text-muted-foreground">
                  {studentMonthlyStats.totalClassDays} class session(s) held
                </div>
              </div>

              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl border bg-muted/30 hover:bg-muted text-foreground transition-colors"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Class / Subject Dropdown Selector */}
            {classes.length > 0 && (
              <div className="pt-2 border-t space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Select Class / Subject
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value)
                    setStudentPage(1)
                  }}
                  className="w-full bg-background border text-foreground rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject_name} ({c.batch_name})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Legend & Summary Bar */}
          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground flex-wrap gap-2">
            <div className="flex items-center gap-2 font-mono">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> P = Present
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> A = Absent
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> — = No Class
              </span>
            </div>
            <span className="font-semibold text-foreground">
              Students {(studentPage - 1) * STUDENTS_PER_PAGE + 1}–
              {Math.min(studentPage * STUDENTS_PER_PAGE, classStudents.length)} of {classStudents.length}
            </span>
          </div>

          {/* 1 to 31 Days Matrix Table */}
          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50 text-[11px] font-bold text-muted-foreground">
                    {/* Sticky Left Column: Student */}
                    <th className="sticky left-0 z-20 bg-muted px-3 py-2.5 min-w-[140px] shadow-sm font-bold text-foreground">
                      Student Name
                    </th>

                    {/* 1 to 31 Day Header Columns */}
                    {monthDays.map((day) => {
                      const hasClass = Boolean(monthDateSessions[day])
                      const dateObj = new Date(year, monthIdx, day)
                      const dow = DAY_SHORT[dateObj.getDay()]
                      return (
                        <th
                          key={day}
                          className={`text-center px-1.5 py-2 min-w-[32px] border-r border-border/40 ${
                            hasClass ? 'bg-primary/10 text-primary font-bold' : ''
                          }`}
                        >
                          <div className="text-[9px] uppercase leading-tight">{dow}</div>
                          <div className="text-[11px] leading-tight">{day}</div>
                        </th>
                      )
                    })}

                    {/* Summary Columns */}
                    <th className="text-center px-2.5 py-2 min-w-[40px] text-emerald-600 font-bold bg-muted/40">
                      P
                    </th>
                    <th className="text-center px-2.5 py-2 min-w-[40px] text-rose-600 font-bold bg-muted/40">
                      A
                    </th>
                    <th className="text-center px-3 py-2 min-w-[48px] font-bold text-foreground bg-muted/40">
                      %
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={daysInMonth + 4}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        No enrolled students found for this class.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((stu, rowIdx) => {
                      const stats = studentMonthlyStats.stats[stu.student_id] || {
                        present: 0,
                        absent: 0,
                        total: 0,
                        pct: 0,
                      }

                      return (
                        <tr
                          key={stu.student_id}
                          className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                            rowIdx % 2 === 0 ? 'bg-card' : 'bg-muted/10'
                          }`}
                        >
                          {/* Sticky Student Name & Roll */}
                          <td className="sticky left-0 z-10 bg-inherit px-3 py-2 shadow-sm truncate max-w-[140px]">
                            <div className="font-bold text-foreground truncate text-xs">
                              {stu.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate">
                              {stu.admission_number || 'Roll N/A'}
                            </div>
                          </td>

                          {/* 1 to 31 Day Cells */}
                          {monthDays.map((day) => {
                            const sess = monthDateSessions[day]
                            if (!sess) {
                              return (
                                <td
                                  key={day}
                                  className="text-center px-1.5 py-2 text-muted-foreground/30 font-mono text-[11px] border-r border-border/30"
                                >
                                  —
                                </td>
                              )
                            }

                            const recs = sessionRecords[sess.session_id] || []
                            const rec = recs.find((r) => r.student_id === stu.student_id)
                            const isPresent = rec?.status === 'PRESENT' || rec?.status === 'LATE'
                            const isAbsent = rec?.status === 'ABSENT'

                            return (
                              <td
                                key={day}
                                className="text-center px-1.5 py-2 border-r border-border/30 font-bold text-[11px]"
                              >
                                {isPresent ? (
                                  <span className="inline-block w-6 h-6 leading-6 rounded-full bg-emerald-500/15 text-emerald-600">
                                    P
                                  </span>
                                ) : isAbsent ? (
                                  <span className="inline-block w-6 h-6 leading-6 rounded-full bg-rose-500/15 text-rose-600">
                                    A
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/30 font-mono">—</span>
                                )}
                              </td>
                            )
                          })}

                          {/* Summary Stats */}
                          <td className="text-center px-2 py-2 font-bold text-emerald-600 bg-emerald-500/5">
                            {stats.present}
                          </td>
                          <td className="text-center px-2 py-2 font-bold text-rose-600 bg-rose-500/5">
                            {stats.absent}
                          </td>
                          <td
                            className={`text-center px-2 py-2 font-extrabold ${
                              stats.pct >= 75
                                ? 'text-emerald-600'
                                : stats.pct >= 60
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {stats.pct}%
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Pagination Controls */}
          {totalStudentPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                disabled={studentPage === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border bg-card text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous Students</span>
              </button>

              <span className="text-xs font-bold text-muted-foreground">
                Page {studentPage} of {totalStudentPages}
              </span>

              <button
                onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
                disabled={studentPage === totalStudentPages}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border bg-card text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-accent transition-colors"
              >
                <span>Next Students</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
