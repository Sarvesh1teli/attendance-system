import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  db,
  AssignedClass,
  CachedStudent,
  LocalAttendanceSession,
  LocalAttendanceRecord,
} from '../db/pwa-db'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Play,
  Search,
  Users,
  AlertCircle,
  Sparkles,
  Camera,
  CalendarDays,
  Check,
  X,
} from 'lucide-react'
import { formatTo12Hour, extractDayOfWeek, DAY_NAMES } from '../utils/time-utils'

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()

  const [cls, setCls] = useState<AssignedClass | null>(null)
  const [students, setStudents] = useState<CachedStudent[]>([])
  const [sessions, setSessions] = useState<LocalAttendanceSession[]>([])
  const [sessionRecords, setSessionRecords] = useState<Record<string, LocalAttendanceRecord[]>>({})
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'STUDENTS' | 'HISTORY' | 'SCHEDULE'>('STUDENTS')
  const [searchQuery, setSearchQuery] = useState('')

  const todayDow = new Date().getDay()

  // Off-schedule confirmation modal state
  const [offScheduleModal, setOffScheduleModal] = useState<{
    clsDow: number
    sessionType: 'EXTRA' | 'SUBSTITUTE' | 'RESCHEDULED'
  } | null>(null)

  useEffect(() => {
    async function loadClassDetails() {
      if (!classId) return
      try {
        setLoading(true)

        // 1. Find assigned class
        const allCls = await db.classes.toArray()
        const target = allCls.find((c: any) => c.id === classId)
        if (!target) {
          setCls(null)
          return
        }

        const dow = extractDayOfWeek(target)
        const rawTime = target.schedule_time || (target as any).scheduleTime || '09:00 AM - 10:30 AM'
        const mappedCls: AssignedClass = {
          ...target,
          batch_id: target.batch_id || (target as any).batchId || '',
          batch_name: target.batch_name || (target as any).batchName || '',
          subject_id: target.subject_id || (target as any).subjectId || '',
          subject_name: target.subject_name || (target as any).subjectName || '',
          subject_code: target.subject_code || (target as any).subjectCode || '',
          program_name: target.program_name || (target as any).programName || '',
          academic_year_id: target.academic_year_id || (target as any).academicYearId || '',
          day_of_week: dow !== null ? dow : undefined,
          schedule_time: formatTo12Hour(rawTime),
          room: target.room || 'Lecture Hall 1',
        }
        setCls(mappedCls)

        // 2. Load enrolled students
        let stus = await db.students.where('class_id').equals(mappedCls.id).toArray()
        if (stus.length === 0 && mappedCls.batch_id) {
          stus = await db.students.where('class_id').equals(mappedCls.batch_id).toArray()
        }
        if (stus.length === 0) {
          const allStus = await db.students.toArray()
          stus = allStus.filter(
            (s) => s.class_id === mappedCls.id || s.class_id === mappedCls.batch_id
          )
        }
        setStudents(stus)

        // 3. Load completed sessions for this class
        const allSessions = await db.sessions
          .where('subject_id')
          .equals(mappedCls.subject_id)
          .toArray()
        const classSessions = allSessions.filter(
          (s) => s.batch_id === mappedCls.batch_id && s.status === 'COMPLETED'
        )
        // Sort descending by date
        classSessions.sort(
          (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
        )
        setSessions(classSessions)

        // 4. Load records for stats
        const recMap: Record<string, LocalAttendanceRecord[]> = {}
        for (const s of classSessions) {
          const r = await db.records.where('session_id').equals(s.session_id).toArray()
          recMap[s.session_id] = r
        }
        setSessionRecords(recMap)
      } catch (err) {
        console.error('Failed to load class details:', err)
      } finally {
        setLoading(false)
      }
    }

    loadClassDetails()
  }, [classId])

  const handleStartAttendance = () => {
    if (!cls) return
    const clsDow = extractDayOfWeek(cls)
    if (clsDow !== null && clsDow !== todayDow) {
      setOffScheduleModal({
        clsDow,
        sessionType: 'EXTRA',
      })
    } else {
      navigate(`/attendance?classId=${cls.id}`)
    }
  }

  const handleConfirmOffSchedule = () => {
    if (!offScheduleModal || !cls) return
    const { sessionType } = offScheduleModal
    setOffScheduleModal(null)
    navigate(`/attendance?classId=${cls.id}&sessionType=${sessionType}`)
  }

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = searchQuery.toLowerCase().trim()
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.admission_number && s.admission_number.toLowerCase().includes(q))
    )
  }, [students, searchQuery])

  // Face enrolled metrics
  const faceEnrolledCount = useMemo(() => {
    return students.filter((s) => s.face_enrolled).length
  }, [students])

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">Loading class details...</div>
    )
  }

  if (!cls) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>
        <div className="p-8 text-center bg-card border rounded-2xl space-y-2">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
          <p className="text-sm font-bold text-foreground">Class Not Found</p>
          <p className="text-xs text-muted-foreground">
            The selected class could not be loaded from offline storage.
          </p>
        </div>
      </div>
    )
  }

  const dow = extractDayOfWeek(cls)

  return (
    <div className="space-y-4">
      {/* Top Navigation Strip */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-full transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Dashboard</span>
        </button>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">
          {cls.program_name || 'Class Details'}
        </span>
      </div>

      {/* Class Overview Header Card */}
      <div className="bg-card border rounded-3xl p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground uppercase tracking-wider">
                {cls.subject_code}
              </span>
              {dow !== null && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                  {DAY_NAMES[dow]}
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-foreground mt-1 leading-tight">
              {cls.subject_name}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>{cls.batch_name}</span>
              {cls.group_name && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-semibold text-foreground">
                  {cls.group_name}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60 text-muted-foreground">
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>{cls.schedule_time}</span>
          </div>
          {cls.room && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{cls.room}</span>
            </div>
          )}
        </div>

        {/* Big Start Attendance Action Button */}
        <button
          onClick={handleStartAttendance}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold py-3 rounded-2xl text-xs shadow-md shadow-primary/25 transition-all"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Start Attendance Session</span>
        </button>
      </div>

      {/* 3 Interactive Sub-Tabs */}
      <div className="flex items-center bg-muted/50 p-1 rounded-2xl border text-xs font-bold">
        <button
          onClick={() => setActiveTab('STUDENTS')}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'STUDENTS'
              ? 'bg-card text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Students ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'HISTORY'
              ? 'bg-card text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>History ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SCHEDULE')}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'SCHEDULE'
              ? 'bg-card text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Schedule</span>
        </button>
      </div>

      {/* TAB 1: Enrolled Students Roster */}
      {activeTab === 'STUDENTS' && (
        <div className="space-y-3">
          {/* Biometric Summary Pill */}
          <div className="flex items-center justify-between p-3 bg-card border rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">Biometric Enrollment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                ✓ {faceEnrolledCount} Ready
              </span>
              {students.length - faceEnrolledCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  {students.length - faceEnrolledCount} Pending
                </span>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search student by name or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border rounded-2xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Student List */}
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center bg-card border rounded-2xl space-y-1">
              <p className="text-xs font-bold text-foreground">No students found</p>
              <p className="text-[11px] text-muted-foreground">
                {searchQuery ? 'Try a different search query' : 'No students enrolled in this batch'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((stu, index) => (
                <div
                  key={stu.id || stu.student_id}
                  className="bg-card border rounded-2xl p-3.5 flex items-center justify-between shadow-sm hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {stu.name ? stu.name.charAt(0).toUpperCase() : '#'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground leading-tight">{stu.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        Roll: {stu.admission_number || 'N/A'}
                        {stu.gender && <span> · {stu.gender}</span>}
                      </p>
                    </div>
                  </div>

                  <div>
                    {stu.face_enrolled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <Check className="h-3 w-3" /> Face Enrolled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        <X className="h-3 w-3" /> No Face
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Class Attendance History */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="p-8 text-center bg-card border rounded-2xl space-y-2">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-bold text-foreground">No sessions recorded yet</p>
              <p className="text-[11px] text-muted-foreground">
                Sessions conducted for this class will appear here with attendance percentages.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((sess) => {
                const recs = sessionRecords[sess.session_id] || []
                const presentCount = recs.filter((r) => r.status === 'PRESENT').length
                const totalMarked = recs.length
                const percentage =
                  totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0

                return (
                  <div
                    key={sess.session_id}
                    className="bg-card border rounded-2xl p-4 shadow-sm space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {sess.custom_topic || 'Class Session'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{sess.session_date}</span>
                          <span>·</span>
                          <span>{formatTo12Hour(sess.start_time)}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                            percentage >= 75
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                          }`}
                        >
                          {percentage}% Present
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {presentCount} of {totalMarked || students.length} students
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Timetable Schedule */}
      {activeTab === 'SCHEDULE' && (
        <div className="space-y-3">
          <div className="bg-card border rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Weekly Scheduled Slot</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Day of the Week:</span>
                <span className="font-bold text-foreground">
                  {dow !== null ? DAY_NAMES[dow] : 'Not specified'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Class Timings:</span>
                <span className="font-bold text-primary font-mono">{cls.schedule_time}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Room / Venue:</span>
                <span className="font-bold text-foreground">{cls.room || 'Lecture Hall 1'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Batch:</span>
                <span className="font-bold text-foreground">{cls.batch_name}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Enrolled Students:</span>
                <span className="font-bold text-foreground">{students.length} Students</span>
              </div>
            </div>
          </div>
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
                <span className="font-semibold text-foreground text-right">{cls.subject_name}</span>
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
