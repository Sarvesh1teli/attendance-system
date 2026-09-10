import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePwaAuth } from '../context/PwaAuthContext'
import { db, AssignedClass, LocalAttendanceSession, CachedStudent, isClassAssignedToTeacher } from '../db/pwa-db'
import {
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  Play,
  Users,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  History,
  GraduationCap,
  PlusCircle,
} from 'lucide-react'
import { formatTo12Hour, extractDayOfWeek, DAY_NAMES } from '../utils/time-utils'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { teacher } = usePwaAuth()

  const [classes, setClasses] = useState<AssignedClass[]>([])
  const [activeSessions, setActiveSessions] = useState<LocalAttendanceSession[]>([])
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [totalUniqueStudents, setTotalUniqueStudents] = useState<number>(0)
  const [todayCompletedSessionsCount, setTodayCompletedSessionsCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [showExtraPicker, setShowExtraPicker] = useState(false)

  const todayDow = new Date().getDay()
  const todayIso = new Date().toISOString().split('T')[0]

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // Off-schedule confirmation modal state
  const [offScheduleModal, setOffScheduleModal] = useState<{
    cls: AssignedClass
    clsDow: number
    sessionType: 'EXTRA' | 'SUBSTITUTE' | 'RESCHEDULED'
  } | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true)

        // 1. Load classes
        const rawAssigned = await db.classes.toArray()
        const assigned: AssignedClass[] = rawAssigned.map((c: any) => {
          const dow = extractDayOfWeek(c)
          const rawTime = c.schedule_time || c.scheduleTime || '09:00 AM - 10:30 AM'
          return {
            ...c,
            batch_id: c.batch_id || c.batchId || '',
            batch_name: c.batch_name || c.batchName || '',
            subject_id: c.subject_id || c.subjectId || '',
            subject_name: c.subject_name || c.subjectName || '',
            subject_code: c.subject_code || c.subjectCode || '',
            program_name: c.program_name || c.programName || '',
            academic_year_id: c.academic_year_id || c.academicYearId || '',
            day_of_week: dow !== null ? dow : undefined,
            schedule_time: formatTo12Hour(rawTime),
            room: c.room || 'Lecture Hall 1',
          }
        })
        const myClasses = assigned.filter((c) => isClassAssignedToTeacher(c, teacher))
        setClasses(myClasses)

        // 2. Load student counts for each class
        const counts: Record<string, number> = {}
        const allStudents = await db.students.toArray()
        const uniqueStudentIds = new Set<string>()

        for (const cls of myClasses) {
          const matching = allStudents.filter(
            (s) => s.class_id === cls.id || (cls.batch_id && s.class_id === cls.batch_id)
          )
          counts[cls.id] = matching.length
          matching.forEach((s) => uniqueStudentIds.add(s.student_id))
        }
        setStudentCounts(counts)
        setTotalUniqueStudents(uniqueStudentIds.size)

        // 3. Load active & today's completed sessions
        const openSessions = await db.sessions.where('status').equals('OPEN').toArray()
        setActiveSessions(openSessions)

        const todaySessions = await db.sessions
          .where('session_date')
          .equals(todayIso)
          .and((s) => s.status === 'COMPLETED')
          .toArray()
        setTodayCompletedSessionsCount(todaySessions.length)
      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [teacher?.id, teacher?.employee_id, teacher?.name, todayIso])

  const handleStartClassSession = (cls: AssignedClass, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const clsDow = extractDayOfWeek(cls)
    if (clsDow !== null && clsDow !== todayDow) {
      setOffScheduleModal({
        cls,
        clsDow,
        sessionType: 'EXTRA',
      })
    } else {
      navigate(`/attendance?classId=${cls.id}`)
    }
  }

  const handleConfirmOffSchedule = () => {
    if (!offScheduleModal) return
    const { cls, sessionType } = offScheduleModal
    setOffScheduleModal(null)
    navigate(`/attendance?classId=${cls.id}&sessionType=${sessionType}`)
  }

  const handleCancelSession = async (sessionId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this in-progress session? Unsaved attendance will be discarded.'
      )
    ) {
      return
    }
    try {
      await db.records.where('session_id').equals(sessionId).delete()
      await db.sessions.delete(sessionId)
      await db.syncQueue.where('entity_id').equals(sessionId).delete()
      setActiveSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
    } catch (err) {
      console.error('Failed to cancel session:', err)
    }
  }

  // Classes scheduled for today
  const todayClasses = classes.filter((cls) => {
    const clsDow = extractDayOfWeek(cls)
    return clsDow === null || clsDow === todayDow
  })

  // Greeting based on current hour
  const currentHour = new Date().getHours()
  const greeting =
    currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="space-y-4">
      {/* Welcome Banner Card */}
      <div className="bg-gradient-to-br from-primary/15 via-card to-card border border-primary/20 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Teacher Dashboard</span>
          </div>
          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground shadow-sm">
            {DAY_NAMES[todayDow]}
          </span>
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight">
            {greeting}, {teacher?.name || 'Professor'} 👋
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 font-medium">
            <Calendar className="h-3.5 w-3.5 text-primary/80" />
            <span>{todayFormatted}</span>
            {teacher?.department && (
              <>
                <span>·</span>
                <span className="text-primary font-semibold">{teacher.department}</span>
              </>
            )}
          </p>
        </div>

        {/* Quick Stats Matrix */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="bg-card/90 border rounded-2xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Assigned
              </p>
              <p className="text-lg font-bold text-foreground leading-none mt-0.5">
                {classes.length}{' '}
                <span className="text-xs font-normal text-muted-foreground">Classes</span>
              </p>
            </div>
          </div>

          <div className="bg-card/90 border rounded-2xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Today
              </p>
              <p className="text-lg font-bold text-foreground leading-none mt-0.5">
                {todayClasses.length}{' '}
                <span className="text-xs font-normal text-muted-foreground">Scheduled</span>
              </p>
            </div>
          </div>

          <div className="bg-card/90 border rounded-2xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Students
              </p>
              <p className="text-lg font-bold text-foreground leading-none mt-0.5">
                {totalUniqueStudents}{' '}
                <span className="text-xs font-normal text-muted-foreground">Total</span>
              </p>
            </div>
          </div>

          <div className="bg-card/90 border rounded-2xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Taken Today
              </p>
              <p className="text-lg font-bold text-foreground leading-none mt-0.5">
                {todayCompletedSessionsCount}{' '}
                <span className="text-xs font-normal text-muted-foreground">Sessions</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Action Pills */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate('/schedule')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-card border rounded-2xl text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shadow-sm"
        >
          <CalendarDays className="h-4 w-4 text-primary" />
          <span>Weekly Timetable</span>
        </button>
        <button
          onClick={() => navigate('/history')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-card border rounded-2xl text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shadow-sm"
        >
          <History className="h-4 w-4 text-primary" />
          <span>Session History</span>
        </button>
      </div>

      {/* In-Progress Session Alert */}
      {activeSessions.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2.5 animate-pulse-subtle">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Attendance Session In Progress</span>
          </div>
          {activeSessions.map((s) => (
            <div
              key={s.session_id}
              className="flex items-center justify-between bg-card p-3 rounded-xl border shadow-sm"
            >
              <div>
                <p className="text-xs font-bold text-foreground">
                  Session started at {formatTo12Hour(s.start_time)}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.session_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCancelSession(s.session_id)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10 border border-rose-300 dark:border-rose-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => navigate(`/attendance?sessionId=${s.session_id}`)}
                  className="bg-amber-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors shadow-sm"
                >
                  Resume
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today's Schedule Section */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="h-4 w-4 text-primary" />
            <span>Today's Classes ({todayClasses.length})</span>
          </h3>
          <button
            onClick={() => navigate('/schedule')}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            Full Week <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground bg-card border rounded-2xl">
            Loading today's schedule...
          </div>
        ) : todayClasses.length === 0 ? (
          <div className="p-6 text-center bg-card border rounded-2xl space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No classes scheduled for today</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Check your weekly timetable or launch an extra attendance session below.
              </p>
            </div>
            <div className="pt-1 flex items-center justify-center gap-2">
              <button
                onClick={() => navigate('/schedule')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                View Weekly Schedule
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {todayClasses.map((cls) => {
              const studentCount = studentCounts[cls.id] ?? 0
              return (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/class/${cls.id}`)}
                  className="group bg-card border rounded-2xl p-4 shadow-sm hover:border-primary/50 transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                          {cls.subject_code}
                        </span>
                        {cls.program_name && (
                          <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {cls.program_name}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                        {cls.subject_name}
                      </h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-primary/70" />
                        <span>{cls.batch_name}</span>
                        {cls.group_name && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium text-foreground">
                            {cls.group_name}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-foreground font-semibold">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span>{formatTo12Hour(cls.schedule_time)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {studentCount} Students
                      </span>
                      {cls.room && (
                        <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                          <MapPin className="h-3 w-3" />
                          <span>{cls.room}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleStartClassSession(cls, e)}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all active:scale-[0.99]"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Take Attendance</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Extra Session Quick Picker */}
      {classes.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowExtraPicker(!showExtraPicker)}
            className="w-full flex items-center justify-between p-3.5 bg-card border rounded-2xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors shadow-sm"
          >
            <span className="flex items-center gap-2 text-foreground font-bold">
              <PlusCircle className="h-4 w-4 text-primary" />
              <span>Launch Extra / Substitute Class</span>
            </span>
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${
                showExtraPicker ? 'rotate-90' : ''
              }`}
            />
          </button>

          {showExtraPicker && (
            <div className="mt-2 space-y-2 p-3 bg-muted/20 border rounded-2xl animate-in fade-in-50">
              <p className="text-[11px] text-muted-foreground px-1 font-medium">
                Choose any assigned class to launch an extra or rescheduled session:
              </p>
              <div className="space-y-1.5">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleStartClassSession(c)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-card border hover:border-primary/50 text-left transition-colors text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-foreground truncate">{c.subject_name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {c.batch_name} • {c.subject_code}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-primary shrink-0">Start ➜</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Off-Schedule Confirmation Modal */}
      {offScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h3 className="font-bold text-sm text-foreground">Off-Schedule Session</h3>
            </div>

            <div className="text-xs space-y-2 bg-muted/40 p-3 rounded-xl border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Class:</span>
                <span className="font-semibold text-foreground text-right">
                  {offScheduleModal.cls.subject_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled Day:</span>
                <span className="font-semibold text-amber-600">
                  {DAY_NAMES[offScheduleModal.clsDow]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Date (Today):</span>
                <span className="font-semibold text-emerald-600">
                  {DAY_NAMES[todayDow]} (
                  {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Select Session Type:
              </label>
              <select
                value={offScheduleModal.sessionType}
                onChange={(e) =>
                  setOffScheduleModal({
                    ...offScheduleModal,
                    sessionType: e.target.value as any,
                  })
                }
                className="w-full text-xs border rounded-xl p-2.5 bg-background font-medium focus:ring-1 focus:ring-primary"
              >
                <option value="EXTRA">Extra Class / Revision</option>
                <option value="SUBSTITUTE">Substitute Class</option>
                <option value="RESCHEDULED">Rescheduled Class</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setOffScheduleModal(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOffSchedule}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
