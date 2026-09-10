import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, AssignedClass, LocalAttendanceSession, isClassAssignedToTeacher } from '../db/pwa-db'
import { usePwaAuth } from '../context/PwaAuthContext'
import { Calendar, Clock, MapPin, Play, Users, AlertCircle, CalendarDays } from 'lucide-react'
import { formatTo12Hour, extractDayOfWeek, DAY_NAMES, DAY_SHORT } from '../utils/time-utils'

export default function SchedulePage() {
  const navigate = useNavigate()
  const { teacher } = usePwaAuth()
  const [classes, setClasses] = useState<AssignedClass[]>([])
  const [activeSessions, setActiveSessions] = useState<LocalAttendanceSession[]>([])
  const [loading, setLoading] = useState(true)

  // Current day of week (0 = Sunday, 1 = Monday, 2 = Tuesday, ...)
  const todayDow = new Date().getDay()
  const [selectedDay, setSelectedDay] = useState<'TODAY' | 'ALL' | number>('TODAY')

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

  const handleStartClassSession = (cls: AssignedClass) => {
    const clsDow = extractDayOfWeek(cls)
    // If the class has a scheduled day and today is NOT that day
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

  useEffect(() => {
    async function loadSchedule() {
      try {
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

        const open = await db.sessions.where('status').equals('OPEN').toArray()
        setActiveSessions(open)
      } catch (err) {
        console.error('Failed to load classes:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSchedule()
  }, [teacher?.id, teacher?.employee_id, teacher?.name])

  const handleCancelSession = async (sessionId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this in-progress session? All unsaved attendance records for this session will be discarded.'
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
      alert('Could not cancel session: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // Filter classes according to selected day tab
  const displayedClasses = classes.filter((cls) => {
    const clsDow = extractDayOfWeek(cls)
    // If no day of week is assigned, show it in Today and All
    if (clsDow === null) return true

    if (selectedDay === 'TODAY') {
      return clsDow === todayDow
    }
    if (selectedDay === 'ALL') {
      return true
    }
    return clsDow === selectedDay
  })

  // Week days order Mon (1) through Sat (6), then Sun (0)
  const filterTabs: Array<{ label: string; value: 'TODAY' | 'ALL' | number }> = [
    { label: 'Today', value: 'TODAY' },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
    { label: 'All', value: 'ALL' },
  ]

  // Count classes for each day for indicator badges
  const classCountForDay = (val: 'TODAY' | 'ALL' | number): number => {
    if (val === 'ALL') return classes.length
    if (val === 'TODAY') return classes.filter((c) => {
      const d = extractDayOfWeek(c)
      return d === null || d === todayDow
    }).length
    return classes.filter((c) => extractDayOfWeek(c) === val).length
  }

  const activeDayName =
    selectedDay === 'TODAY'
      ? DAY_NAMES[todayDow]
      : selectedDay === 'ALL'
      ? 'All Days'
      : DAY_NAMES[selectedDay]

  return (
    <div className="space-y-4">
      {/* Date banner */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
            <Calendar className="h-4 w-4" />
            <span>Schedule & Timetable</span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {DAY_NAMES[todayDow]}
          </span>
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
                <p className="text-xs font-bold text-foreground">
                  Session started at {formatTo12Hour(s.start_time)}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.session_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCancelSession(s.session_id)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10 border border-rose-300 dark:border-rose-800 transition-colors"
                  title="Cancel and discard this session"
                >
                  Cancel
                </button>
                <button
                  onClick={() => navigate(`/attendance?sessionId=${s.session_id}`)}
                  className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
                >
                  Resume
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Day Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-medium">
        {filterTabs.map((tab) => {
          const isSelected = selectedDay === tab.value
          const count = classCountForDay(tab.value)
          return (
            <button
              key={String(tab.value)}
              onClick={() => setSelectedDay(tab.value)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'bg-card border text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Class List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedDay === 'TODAY'
              ? `Today's Classes (${DAY_NAMES[todayDow]})`
              : `${activeDayName} Classes`}
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {displayedClasses.length} {displayedClasses.length === 1 ? 'class' : 'classes'}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading classes...</div>
        ) : displayedClasses.length === 0 ? (
          <div className="p-8 text-center bg-card border rounded-2xl space-y-2">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-semibold text-foreground">
              No classes scheduled for {activeDayName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Switch tabs above to view other days or tap "All" to see the full week.
            </p>
          </div>
        ) : (
          displayedClasses.map((cls) => {
            const dow = extractDayOfWeek(cls)
            const dayLabel = dow !== null ? DAY_NAMES[dow] : null

            return (
              <div
                key={cls.id}
                className="bg-card border rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                        {cls.subject_code}
                      </span>
                      {dayLabel && (selectedDay === 'ALL' || selectedDay !== dow) && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground uppercase tracking-wider">
                          {dayLabel}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-base text-foreground mt-1 leading-snug">
                      {cls.subject_name}
                    </h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>{cls.batch_name}</span>
                      {cls.group_name && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium text-foreground">
                          {cls.group_name}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">{formatTo12Hour(cls.schedule_time)}</span>
                  </div>
                  {cls.room && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{cls.room}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleStartClassSession(cls)}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl text-xs shadow-md shadow-primary/20 transition-all"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Start Attendance Session</span>
                </button>
              </div>
            )
          })
        )}
      </div>

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
                <span className="font-semibold text-foreground text-right">{offScheduleModal.cls.subject_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled Day:</span>
                <span className="font-semibold text-amber-600">{DAY_NAMES[offScheduleModal.clsDow]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Date (Today):</span>
                <span className="font-semibold text-emerald-600">{DAY_NAMES[todayDow]} ({new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              This class is scheduled on <strong>{DAY_NAMES[offScheduleModal.clsDow]}</strong>, but today is <strong>{DAY_NAMES[todayDow]}</strong>. Please select the session type:
            </p>

            <div className="space-y-2 text-xs">
              <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                offScheduleModal.sessionType === 'EXTRA'
                  ? 'bg-primary/10 border-primary text-primary font-semibold'
                  : 'bg-card border hover:bg-muted/40 text-foreground'
              }`}>
                <input
                  type="radio"
                  name="sessionType"
                  value="EXTRA"
                  checked={offScheduleModal.sessionType === 'EXTRA'}
                  onChange={() => setOffScheduleModal({ ...offScheduleModal, sessionType: 'EXTRA' })}
                  className="accent-primary"
                />
                <span>📌 Extra / Make-up Class</span>
              </label>

              <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                offScheduleModal.sessionType === 'SUBSTITUTE'
                  ? 'bg-primary/10 border-primary text-primary font-semibold'
                  : 'bg-card border hover:bg-muted/40 text-foreground'
              }`}>
                <input
                  type="radio"
                  name="sessionType"
                  value="SUBSTITUTE"
                  checked={offScheduleModal.sessionType === 'SUBSTITUTE'}
                  onChange={() => setOffScheduleModal({ ...offScheduleModal, sessionType: 'SUBSTITUTE' })}
                  className="accent-primary"
                />
                <span>🔄 Substitute / Proxy Class</span>
              </label>

              <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                offScheduleModal.sessionType === 'RESCHEDULED'
                  ? 'bg-primary/10 border-primary text-primary font-semibold'
                  : 'bg-card border hover:bg-muted/40 text-foreground'
              }`}>
                <input
                  type="radio"
                  name="sessionType"
                  value="RESCHEDULED"
                  checked={offScheduleModal.sessionType === 'RESCHEDULED'}
                  onChange={() => setOffScheduleModal({ ...offScheduleModal, sessionType: 'RESCHEDULED' })}
                  className="accent-primary"
                />
                <span>📅 Rescheduled Timetable Class</span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOffScheduleModal(null)}
                className="flex-1 py-2.5 rounded-xl border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOffSchedule}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md transition-all"
              >
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
