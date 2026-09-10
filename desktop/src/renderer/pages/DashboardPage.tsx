import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Users,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  CalendarDays,
  ArrowRight,
} from 'lucide-react'

interface Stats {
  students: number
  faculty: number
  subjects: number
  sessionsToday: number
  shortageStudents: number
  avgAttendance: number | null
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    students: 0,
    faculty: 0,
    subjects: 0,
    sessionsToday: 0,
    shortageStudents: 0,
    avgAttendance: null,
  })
  const [loading, setLoading] = useState(true)
  const [institutionName, setInstitutionName] = useState('')
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('ALL')
  const [rawSessions, setRawSessions] = useState<any[]>([])
  const [rawStudents, setRawStudents] = useState<any[]>([])
  const [rawFaculty, setRawFaculty] = useState<any[]>([])
  const [rawSubjects, setRawSubjects] = useState<any[]>([])
  const [rawBatches, setRawBatches] = useState<any[]>([])
  const [rawTimetable, setRawTimetable] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sRes, fRes, subRes, instRes, sessRes, ayRes, bRes, ttRes] = await Promise.allSettled([
          window.api.student.list(),
          window.api.faculty.list(),
          window.api.subject.list(),
          window.api.institution.get(),
          window.api.attendance.listSessions(),
          window.api.academicYear.list(),
          window.api.batch.list(),
          window.api.timetable ? window.api.timetable.list({ active_only: true }) : Promise.resolve([]),
        ])

        const students = sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value : []
        const faculty = fRes.status === 'fulfilled' && Array.isArray(fRes.value) ? fRes.value : []
        const subjects = subRes.status === 'fulfilled' && Array.isArray(subRes.value) ? subRes.value : []
        const inst = instRes.status === 'fulfilled' ? instRes.value : null
        const sessions = sessRes.status === 'fulfilled' && Array.isArray(sessRes.value) ? sessRes.value : []
        const ays = ayRes.status === 'fulfilled' && Array.isArray(ayRes.value) ? ayRes.value : []
        const batches = bRes.status === 'fulfilled' && Array.isArray(bRes.value) ? bRes.value : []
        const timetable = ttRes.status === 'fulfilled' && Array.isArray(ttRes.value) ? ttRes.value : []

        setRawSessions(sessions)
        setRawStudents(students)
        setRawFaculty(faculty)
        setRawSubjects(subjects)
        setRawBatches(batches)
        setAcademicYears(ays)
        setRawTimetable(timetable)

        const fallbackName = (localStorage.getItem('saas_institute_id') || 'SGJM').toUpperCase()
        setInstitutionName(inst?.name || fallbackName)
      } catch (err) {
        console.error('Failed to load dashboard stats:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Recalculate stats whenever selectedYear, rawSessions, rawStudents, rawFaculty, rawSubjects, or rawTimetable changes
  useEffect(() => {
    let filteredSessions = rawSessions
    if (selectedYear !== 'ALL') {
      filteredSessions = rawSessions.filter((s: any) => {
        if (s.academic_year_id === selectedYear) return true
        const ay = academicYears.find((a) => a.academic_year_id === selectedYear || a.year_label === selectedYear)
        if (ay?.year_label && s.session_date) {
          const matchLabel = s.session_date.startsWith(ay.year_label.slice(0, 4))
          if (matchLabel) return true
        }
        return false
      })
    }

    let avgAttendance: number | null = null
    if (filteredSessions.length > 0) {
      const valid = filteredSessions.filter((s: any) => (s.total_students || s.totalStudents || 0) > 0)
      if (valid.length > 0) {
        const sumPct = valid.reduce((sum: number, s: any) => {
          const tot = s.total_students || s.totalStudents || 1
          const pres = s.present_count ?? s.presentCount ?? 0
          return sum + (pres / tot) * 100
        }, 0)
        avgAttendance = Math.round(sumPct / valid.length)
      }
    }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const todaySessions = filteredSessions.filter((s: any) => {
      const d = s.session_date || s.sessionDate || ''
      return d.startsWith(todayStr) || d.startsWith(localToday)
    })

    const todayDow = now.getDay() === 0 ? 7 : now.getDay()
    const todaySlots = rawTimetable.filter((s: any) => s.day_of_week === todayDow && s.active !== false)

    // Today's session count: prioritize actual sessions, otherwise scheduled timetable slots
    const sessionsTodayCount = todaySessions.length > 0 ? todaySessions.length : todaySlots.length

    setStats({
      students: rawStudents.length,
      faculty: rawFaculty.length,
      subjects: rawSubjects.length,
      sessionsToday: sessionsTodayCount,
      shortageStudents: 0,
      avgAttendance,
    })
  }, [selectedYear, rawSessions, rawStudents, rawFaculty, rawSubjects, rawTimetable, academicYears])

  // Get today's scheduled classes for quick overview
  const todayClasses = useMemo(() => {
    const now = new Date()
    const todayDow = now.getDay() === 0 ? 7 : now.getDay()
    const todaySlots = rawTimetable.filter((s: any) => s.day_of_week === todayDow && s.active !== false)

    const todayStr = now.toISOString().slice(0, 10)
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    return todaySlots.map((slot: any) => {
      const matchedSession = rawSessions.find(
        (s: any) =>
          ((s.session_date || s.sessionDate || '').startsWith(todayStr) ||
            (s.session_date || s.sessionDate || '').startsWith(localToday)) &&
          (s.subject_id === slot.subject_id || s.subjectId === slot.subject_id) &&
          (s.batch_id === slot.batch_id || s.batchId === slot.batch_id)
      )
      return {
        ...slot,
        session: matchedSession || null,
        status: matchedSession ? matchedSession.status || 'OPEN' : 'SCHEDULED',
      }
    })
  }, [rawTimetable, rawSessions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{institutionName ? institutionName : 'Dashboard'}</h1>
          <p className="text-muted-foreground text-sm">
            Welcome to Teli Attendance —{' '}
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Year wise filter - right side */}
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5 shadow-sm">
          <Calendar className="h-4 w-4 text-primary" />
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-xs font-medium bg-transparent border-0 focus:ring-0 cursor-pointer pr-2 text-foreground"
          >
            <option value="ALL">All Academic Years</option>
            {academicYears.map((ay: any) => (
              <option key={ay.academic_year_id || ay.year_label} value={ay.academic_year_id || ay.year_label}>
                {ay.year_label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 Summary Cards - Compact, Theme-tinted, Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
          label="Total Students"
          value={loading ? '…' : stats.students}
          subtext="View directory"
          color="blue"
          onClick={() => navigate('/people/students')}
        />
        <StatCard
          icon={<GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />}
          label="Faculty"
          value={loading ? '…' : stats.faculty}
          subtext="Manage teachers"
          color="emerald"
          onClick={() => navigate('/people/faculty')}
        />
        <StatCard
          icon={<BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />}
          label="Subjects"
          value={loading ? '…' : stats.subjects}
          subtext="Curriculum list"
          color="purple"
          onClick={() => navigate('/academic/subjects')}
        />
        <StatCard
          icon={<ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5" />}
          label="Sessions Today"
          value={loading ? '…' : stats.sessionsToday}
          subtext="Class attendance"
          color="amber"
          onClick={() => navigate('/attendance')}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          label="Avg Attendance"
          value={loading ? '…' : stats.avgAttendance != null ? `${stats.avgAttendance}%` : 'N/A'}
          subtext="Reports & trends"
          color="indigo"
          onClick={() => navigate('/reports')}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />}
          label="Shortage Alerts"
          value={loading ? '…' : stats.shortageStudents}
          subtext="Below 75%"
          color="rose"
          onClick={() => navigate('/reports')}
        />
      </div>

      {/* Today's Schedule & Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's Schedule Section */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-base">Today&apos;s Class Schedule</h2>
            </div>
            <button
              onClick={() => navigate('/timetable')}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Full Timetable <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {todayClasses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
              No classes scheduled for today ({new Date().toLocaleDateString('en-IN', { weekday: 'long' })}).
            </div>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {todayClasses.map((item: any, idx: number) => (
                <div
                  key={item.slot_id || item.id || idx}
                  onClick={() => navigate('/attendance')}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5 sm:mt-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.subject_name}</span>
                        {item.subject_code && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                            {item.subject_code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.batch_name || 'MBBS'} • Faculty: <span className="font-medium text-foreground">{item.faculty_name}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted">
                      {item.start_time} - {item.end_time}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : item.status === 'OPEN'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Start Guide */}
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-base">Quick Start Guide</h2>
          <ol className="text-xs text-muted-foreground space-y-2.5 list-decimal list-inside">
            <li className="leading-relaxed">
              Set up Departments, Programs, and Batches under{' '}
              <button
                onClick={() => navigate('/academic/batches')}
                className="font-medium text-primary hover:underline"
              >
                Academic
              </button>
            </li>
            <li className="leading-relaxed">
              Add Faculty and Students under{' '}
              <button
                onClick={() => navigate('/people/students')}
                className="font-medium text-primary hover:underline"
              >
                People
              </button>
            </li>
            <li className="leading-relaxed">
              Enroll student face photos from{' '}
              <button
                onClick={() => navigate('/face/students')}
                className="font-medium text-primary hover:underline"
              >
                Face Enrollment
              </button>
            </li>
            <li className="leading-relaxed">
              Configure weekly schedule in{' '}
              <button
                onClick={() => navigate('/timetable')}
                className="font-medium text-primary hover:underline"
              >
                Timetable
              </button>
            </li>
            <li className="leading-relaxed">
              Manage class attendance sessions in{' '}
              <button
                onClick={() => navigate('/attendance')}
                className="font-medium text-primary hover:underline"
              >
                Attendance Sessions
              </button>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  subtext?: string
  color: 'blue' | 'emerald' | 'purple' | 'amber' | 'indigo' | 'rose'
  onClick?: () => void
}

function StatCard({ icon, label, value, subtext, color, onClick }: StatCardProps) {
  const colorMap = {
    blue: {
      panel: 'bg-blue-50/60 hover:bg-blue-100/60 border-blue-200/90 hover:border-blue-400 dark:bg-blue-950/20 dark:border-blue-900/50',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
      value: 'text-blue-950 dark:text-blue-100',
      sub: 'text-blue-600/80 dark:text-blue-400',
    },
    emerald: {
      panel: 'bg-emerald-50/60 hover:bg-emerald-100/60 border-emerald-200/90 hover:border-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/50',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
      value: 'text-emerald-950 dark:text-emerald-100',
      sub: 'text-emerald-600/80 dark:text-emerald-400',
    },
    purple: {
      panel: 'bg-purple-50/60 hover:bg-purple-100/60 border-purple-200/90 hover:border-purple-400 dark:bg-purple-950/20 dark:border-purple-900/50',
      badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
      value: 'text-purple-950 dark:text-purple-100',
      sub: 'text-purple-600/80 dark:text-purple-400',
    },
    amber: {
      panel: 'bg-amber-50/60 hover:bg-amber-100/60 border-amber-200/90 hover:border-amber-400 dark:bg-amber-950/20 dark:border-amber-900/50',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
      value: 'text-amber-950 dark:text-amber-100',
      sub: 'text-amber-600/80 dark:text-amber-400',
    },
    indigo: {
      panel: 'bg-indigo-50/60 hover:bg-indigo-100/60 border-indigo-200/90 hover:border-indigo-400 dark:bg-indigo-950/20 dark:border-indigo-900/50',
      badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
      value: 'text-indigo-950 dark:text-indigo-100',
      sub: 'text-indigo-600/80 dark:text-indigo-400',
    },
    rose: {
      panel: 'bg-rose-50/60 hover:bg-rose-100/60 border-rose-200/90 hover:border-rose-400 dark:bg-rose-950/20 dark:border-rose-900/50',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
      value: 'text-rose-950 dark:text-rose-100',
      sub: 'text-rose-600/80 dark:text-rose-400',
    },
  }

  const theme = colorMap[color]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={`group relative rounded-xl border p-3.5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 select-none ${theme.panel}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`p-1.5 rounded-lg ${theme.badge} shadow-xs`}>
          {icon}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground/70 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">{label}</p>
        <p className={`text-2xl font-bold tracking-tight mt-0.5 ${theme.value}`}>{value}</p>
        {subtext && (
          <p className={`text-[11px] font-medium mt-0.5 truncate ${theme.sub}`}>{subtext}</p>
        )}
      </div>
    </div>
  )
}

