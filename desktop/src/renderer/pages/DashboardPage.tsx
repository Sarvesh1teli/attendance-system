import { useState, useEffect } from 'react'
import { GraduationCap, Users, BookOpen, ClipboardCheck, TrendingUp, AlertTriangle } from 'lucide-react'

interface Stats {
  students: number
  faculty: number
  subjects: number
  sessionsToday: number
  shortageStudents: number
  avgAttendance: number | null
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    students: 0, faculty: 0, subjects: 0, sessionsToday: 0, shortageStudents: 0, avgAttendance: null,
  })
  const [loading, setLoading] = useState(true)
  const [institutionName, setInstitutionName] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [students, faculty, subjects, inst, sessions, shortageList] = await Promise.all([
          window.api.student.list(),
          window.api.faculty.list(),
          window.api.subject.list(),
          window.api.institution.get(),
          window.api.attendance.listSessions({ date: new Date().toISOString().slice(0, 10) }),
          window.api.report.getShortageReport(undefined, undefined, 75).catch(() => []),
        ])

        setInstitutionName(inst?.name ?? '')

        // Compute average attendance from shortage report
        let avgAttendance: number | null = null
        const summaryList = await window.api.report.getStudentSummary().catch(() => [])
        if (summaryList.length > 0) {
          const total = summaryList.reduce((sum: number, r: { attendance_percentage?: number }) => sum + (r.attendance_percentage ?? 0), 0)
          avgAttendance = Math.round(total / summaryList.length)
        }

        setStats({
          students: students.length,
          faculty: faculty.length,
          subjects: subjects.length,
          sessionsToday: sessions.length,
          shortageStudents: shortageList.length,
          avgAttendance,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{institutionName ? institutionName : 'Dashboard'}</h1>
        <p className="text-muted-foreground text-sm">Welcome to Teli Attendance — {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total Students" value={loading ? '…' : String(stats.students)} color="blue"
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="Faculty" value={loading ? '…' : String(stats.faculty)} color="green"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Subjects" value={loading ? '…' : String(stats.subjects)} color="purple"
        />
        <StatCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          label="Sessions Today" value={loading ? '…' : String(stats.sessionsToday)} color="orange"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg. Attendance</p>
            <p className="text-3xl font-bold">
              {loading ? '…' : stats.avgAttendance != null ? `${stats.avgAttendance}%` : 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Across all subjects</p>
          </div>
        </div>
        <div className={`bg-card border rounded-lg p-5 flex items-center gap-4 ${stats.shortageStudents > 0 ? 'border-orange-300' : ''}`}>
          <div className={`p-3 rounded-xl ${stats.shortageStudents > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Shortage Alerts</p>
            <p className={`text-3xl font-bold ${stats.shortageStudents > 0 ? 'text-orange-600' : ''}`}>
              {loading ? '…' : stats.shortageStudents}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Students below 75% threshold</p>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <h2 className="font-semibold mb-3">Quick Start</h2>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Set up Departments, Programs, and Batches under <strong>Academic</strong></li>
          <li>Add Faculty and Students under <strong>People</strong></li>
          <li>Enroll face photos from <strong>Enrollment</strong></li>
          <li>Create an attendance session from <strong>Attendance → Class Sessions</strong></li>
          <li>Sync with cloud from the toolbar sync button</li>
        </ol>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorMap = {
    blue: 'text-blue-500 bg-blue-50', green: 'text-green-500 bg-green-50',
    purple: 'text-purple-500 bg-purple-50', orange: 'text-orange-500 bg-orange-50',
  }
  return (
    <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  )
}
