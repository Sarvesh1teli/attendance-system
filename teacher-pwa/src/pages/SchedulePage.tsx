import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, AssignedClass, LocalAttendanceSession } from '../db/pwa-db'
import { Calendar, Clock, MapPin, Play, BookOpen, Users, AlertCircle } from 'lucide-react'

export default function SchedulePage() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState<AssignedClass[]>([])
  const [activeSessions, setActiveSessions] = useState<LocalAttendanceSession[]>([])
  const [loading, setLoading] = useState(true)

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  useEffect(() => {
    async function loadSchedule() {
      try {
        const rawAssigned = await db.classes.toArray()
        const assigned = rawAssigned.map((c: any) => ({
          ...c,
          batch_id: c.batch_id || c.batchId || '',
          batch_name: c.batch_name || c.batchName || '',
          subject_id: c.subject_id || c.subjectId || '',
          subject_name: c.subject_name || c.subjectName || '',
          subject_code: c.subject_code || c.subjectCode || '',
          program_name: c.program_name || c.programName || '',
          academic_year_id: c.academic_year_id || c.academicYearId || '',
          schedule_time: c.schedule_time || c.scheduleTime || '09:00 AM - 10:30 AM',
          room: c.room || 'Lecture Hall 1',
        }))
        setClasses(assigned)

        const open = await db.sessions.where('status').equals('OPEN').toArray()
        setActiveSessions(open)
      } catch (err) {
        console.error('Failed to load classes:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSchedule()
  }, [])

  return (
    <div className="space-y-4">
      {/* Date banner */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
          <Calendar className="h-4 w-4" />
          <span>Today's Classes</span>
        </div>
        <h2 className="text-xl font-bold text-foreground mt-1">{todayFormatted}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a class to initiate attendance capture.
        </p>
      </div>

      {/* Active uncompleted sessions alert */}
      {activeSessions.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>Active Session In Progress</span>
          </div>
          {activeSessions.map((s) => (
            <div
              key={s.session_id}
              className="flex items-center justify-between bg-card p-3 rounded-xl border"
            >
              <div>
                <p className="text-xs font-bold text-foreground">Session started at {s.start_time}</p>
                <p className="text-[11px] text-muted-foreground">{s.session_date}</p>
              </div>
              <button
                onClick={() => navigate(`/attendance?sessionId=${s.session_id}`)}
                className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
              >
                Resume
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Class List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Assigned Lecture & Lab Schedule
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading classes...</div>
        ) : classes.length === 0 ? (
          <div className="p-8 text-center bg-card border rounded-2xl text-xs text-muted-foreground">
            No classes assigned for today.
          </div>
        ) : (
          classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-card border rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                    {cls.subject_code}
                  </span>
                  <h4 className="font-bold text-base text-foreground mt-1 leading-snug">
                    {cls.subject_name}
                  </h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>{cls.batch_name}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>{cls.schedule_time}</span>
                </div>
                {cls.room && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{cls.room}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate(`/attendance?classId=${cls.id}`)}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl text-xs shadow-md shadow-primary/20 transition-all"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Start Attendance Session</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
