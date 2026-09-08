import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  db,
  AssignedClass,
  CachedStudent,
  CachedTopic,
  LocalAttendanceSession,
  LocalAttendanceRecord,
} from '../db/pwa-db'
import { usePwaAuth } from '../context/PwaAuthContext'
import { v4 as uuidv4 } from 'uuid'
import {
  Check,
  Clock,
  X,
  User,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  ArrowLeft,
  Save,
  Search,
  ScanFace,
  Camera,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react'
import { PwaFaceScanner } from '../components/face/PwaFaceScanner'

export default function TakeAttendancePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { teacher, refreshSyncCount, triggerSync, clearAllData } = usePwaAuth()

  const classIdParam = searchParams.get('classId')
  const sessionIdParam = searchParams.get('sessionId')

  const [classes, setClasses] = useState<AssignedClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>(classIdParam || '')
  const [currentSession, setCurrentSession] = useState<LocalAttendanceSession | null>(null)
  const [students, setStudents] = useState<CachedStudent[]>([])
  const [records, setRecords] = useState<Record<string, LocalAttendanceRecord>>({})
  const [topics, setTopics] = useState<CachedTopic[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [customTopic, setCustomTopic] = useState<string>('')
  const [filter, setFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [syncingRoster, setSyncingRoster] = useState(false)

  // 1. Load classes & resume or initialize
  useEffect(() => {
    async function loadData() {
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
      }))
      setClasses(assigned)

      if (sessionIdParam) {
        const foundSession = await db.sessions.where('session_id').equals(sessionIdParam).first()
        if (foundSession) {
          setCurrentSession(foundSession)
          setSelectedClassId(foundSession.batch_id) // or match class
          setSelectedTopicId(foundSession.topic_id || '')
          setCustomTopic(foundSession.custom_topic || '')

          // Load records
          const recs = await db.records.where('session_id').equals(foundSession.session_id).toArray()
          const map: Record<string, LocalAttendanceRecord> = {}
          recs.forEach((r) => {
            map[r.student_id] = r
          })
          setRecords(map)

          // Load students
          const stus = await db.students.toArray()
          setStudents(stus)
        }
      } else if (classIdParam && assigned.some((c) => c.id === classIdParam)) {
        setSelectedClassId(classIdParam)
      } else if (assigned.length > 0) {
        setSelectedClassId(assigned[0].id)
      }
    }

    loadData()
  }, [classIdParam, sessionIdParam])

  // 2. Load topics and students when class changes
  useEffect(() => {
    if (!selectedClassId) return

    async function loadClassDetails() {
      const rawCls = await db.classes.get(selectedClassId)
      if (rawCls) {
        const cls: AssignedClass = {
          ...rawCls,
          batch_id: rawCls.batch_id || (rawCls as any).batchId || '',
          batch_name: rawCls.batch_name || (rawCls as any).batchName || '',
          subject_id: rawCls.subject_id || (rawCls as any).subjectId || '',
          subject_name: rawCls.subject_name || (rawCls as any).subjectName || '',
          subject_code: rawCls.subject_code || (rawCls as any).subjectCode || '',
          program_name: rawCls.program_name || (rawCls as any).programName || '',
          academic_year_id: rawCls.academic_year_id || (rawCls as any).academicYearId || '',
        }
        const classTopics = await db.topics.where('subject_id').equals(cls.subject_id).toArray()
        setTopics(classTopics)

        // Try lookup by class_id or cls.batch_id
        let classStudents = await db.students.where('class_id').equals(selectedClassId).toArray()
        if (classStudents.length === 0 && cls.batch_id) {
          classStudents = await db.students.where('class_id').equals(cls.batch_id).toArray()
        }
        if (classStudents.length === 0 && (cls as any).batchId) {
          classStudents = await db.students.where('class_id').equals((cls as any).batchId).toArray()
        }

        if (classStudents.length > 0) {
          setStudents(classStudents)
        } else {
          const allStudents = await db.students.toArray()
          setStudents(allStudents)
        }
      }
    }

    if (!sessionIdParam) {
      loadClassDetails()
    }
  }, [selectedClassId, sessionIdParam])

  // 3. Open Attendance Session (Option A Rule for Absences)
  const handleStartSession = async () => {
    if (!selectedClassId) return
    const cls = await db.classes.get(selectedClassId)
    if (!cls) return

    const now = new Date()
    const sessionId = uuidv4()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().split(' ')[0]

    const newSession: LocalAttendanceSession = {
      id: sessionId,
      session_id: sessionId,
      institution_id: teacher?.institution_id || 'inst-001',
      faculty_id: cls.faculty_id || teacher?.id || 'fac-001',
      subject_id: cls.subject_id,
      batch_id: cls.batch_id,
      academic_year_id: cls.academic_year_id,
      student_group_id: cls.group_id,
      session_date: dateStr,
      start_time: timeStr,
      status: 'OPEN',
      sync_status: 'LOCAL_ONLY',
      created_at: now.toISOString(),
    }

    // Option A: Pre-populate attendance records for ALL eligible students as ABSENT
    const initialRecords: LocalAttendanceRecord[] = students.map((s) => {
      const recordId = uuidv4()
      return {
        id: recordId,
        record_id: recordId,
        session_id: sessionId,
        student_id: s.student_id,
        status: 'ABSENT',
        recognition_method: 'SYSTEM_DEFAULT',
        marked_at: now.toISOString(),
        sync_status: 'LOCAL_ONLY',
      }
    })

    await db.transaction('rw', db.sessions, db.records, async () => {
      await db.sessions.put(newSession)
      await db.records.bulkPut(initialRecords)
    })

    const map: Record<string, LocalAttendanceRecord> = {}
    initialRecords.forEach((r) => {
      map[r.student_id] = r
    })

    setCurrentSession(newSession)
    setRecords(map)
  }

  // 4. Toggle attendance status for a student
  const handleSetStatus = async (
    studentId: string,
    newStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
  ) => {
    if (!currentSession) return

    const existing = records[studentId]
    const now = new Date().toISOString()

    const updatedRecord: LocalAttendanceRecord = existing
      ? {
          ...existing,
          status: newStatus,
          recognition_method: 'MANUAL_TEACHER',
          marked_at: now,
        }
      : {
          id: uuidv4(),
          record_id: uuidv4(),
          session_id: currentSession.session_id,
          student_id: studentId,
          status: newStatus,
          recognition_method: 'MANUAL_TEACHER',
          marked_at: now,
          sync_status: 'LOCAL_ONLY',
        }

    await db.records.put(updatedRecord)

    setRecords((prev) => ({
      ...prev,
      [studentId]: updatedRecord,
    }))
  }

  // Handle auto-attendance from Camera Face Recognition Scanner
  const handleFaceRecognized = async (studentId: string, confidence: number) => {
    if (!currentSession) return

    const existing = records[studentId]
    const now = new Date().toISOString()

    const updatedRecord: LocalAttendanceRecord = existing
      ? {
          ...existing,
          status: 'PRESENT',
          recognition_method: 'FACE_RECOGNITION',
          confidence_score: confidence,
          marked_at: now,
          sync_status: 'LOCAL_ONLY',
        }
      : {
          id: uuidv4(),
          record_id: uuidv4(),
          session_id: currentSession.session_id,
          student_id: studentId,
          status: 'PRESENT',
          recognition_method: 'FACE_RECOGNITION',
          confidence_score: confidence,
          marked_at: now,
          sync_status: 'LOCAL_ONLY',
        }

    await db.records.put(updatedRecord)
    setRecords((prev) => ({
      ...prev,
      [studentId]: updatedRecord,
    }))
  }

  // Quick pull to refresh student roster & face descriptors from cloud
  const handleQuickSyncRoster = async () => {
    try {
      setSyncingRoster(true)
      await triggerSync()
      if (selectedClassId) {
        const classStudents = await db.students.where('class_id').equals(selectedClassId).toArray()
        if (classStudents.length > 0) {
          setStudents(classStudents)
        } else {
          const allStudents = await db.students.toArray()
          setStudents(allStudents)
        }
      }
    } finally {
      setSyncingRoster(false)
    }
  }

  // Drop all local data from Teacher App so fresh data can be pushed from desktop
  const handleDropAllData = async () => {
    if (
      !confirm(
        'Drop all local data from Teacher App? All cached students, classes, and attendance records will be wiped clean.'
      )
    )
      return
    await clearAllData()
    setStudents([])
    setRecords({})
    setTopics([])
    setClasses([])
    setSelectedClassId('')
    alert('All Teacher App data has been wiped clean! Push master data from Desktop, then tap 🔄 Sync.')
  }

  // 5. Complete and Lock Attendance Session
  const handleFinishSession = async () => {
    if (!currentSession) return
    if (!selectedTopicId && !customTopic.trim()) {
      alert('Please select or specify the topic covered during this session.')
      return
    }

    // Confirmation before submitting
    const totalStudents = students.length
    const presentNow = Object.values(records).filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length
    const absentNow = totalStudents - presentNow
    const confirmed = window.confirm(
      `Submit Attendance?\n\n` +
      `✅ Present / Late : ${presentNow} student${presentNow !== 1 ? 's' : ''}\n` +
      `❌ Absent          : ${absentNow} student${absentNow !== 1 ? 's' : ''}\n` +
      `📋 Total           : ${totalStudents} student${totalStudents !== 1 ? 's' : ''}\n\n` +
      `Once submitted, attendance will be synced to the server.\nDo you want to proceed?`
    )
    if (!confirmed) return

    setSaving(true)
    const now = new Date()
    const endTimeStr = now.toTimeString().split(' ')[0]

    const completedSession: LocalAttendanceSession = {
      ...currentSession,
      status: 'COMPLETED',
      end_time: endTimeStr,
      topic_id: selectedTopicId || undefined,
      custom_topic: customTopic.trim() || undefined,
      sync_status: 'LOCAL_ONLY',
    }

    const allSessionRecords = Object.values(records)

    await db.transaction('rw', db.sessions, db.records, db.syncQueue, async () => {
      await db.sessions.put(completedSession)

      // Add to outbox sync queue
      await db.syncQueue.put({
        action: 'SUBMIT_ATTENDANCE',
        entity_type: 'ATTENDANCE_SESSION',
        entity_id: completedSession.session_id,
        payload: {
          session: completedSession,
          records: allSessionRecords,
        },
        created_at: now.toISOString(),
        attempts: 0,
      })
    })

    await refreshSyncCount()
    try {
      await triggerSync()
    } catch (syncErr) {
      console.warn('Auto-sync deferred:', syncErr)
    }
    setSaving(false)
    setSessionCompleted(true)
  }

  // Counts
  const recordList = Object.values(records)
  const totalCount = students.length
  const presentCount = recordList.filter((r) => r.status === 'PRESENT').length
  const lateCount = recordList.filter((r) => r.status === 'LATE').length
  const absentCount = recordList.filter((r) => r.status === 'ABSENT').length

  const filteredStudents = students.filter((s) => {
    const r = records[s.student_id]
    const matchesFilter = filter === 'ALL' || (r && r.status === filter)
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // If no active session, show setup / launcher screen
  if (!currentSession) {
    const selectedClass = classes.find((c) => c.id === selectedClassId)

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/schedule')} className="p-1 rounded-lg hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold">New Attendance Session</h2>
        </div>

        <div className="bg-card border rounded-2xl p-5 space-y-4 shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Select Class / Batch
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full border rounded-xl p-3 text-sm bg-background font-medium focus:ring-2 focus:ring-primary"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.subject_code || (c as any).subjectCode || 'CLASS')} — {(c.batch_name || (c as any).batchName || 'Batch')}
                </option>
              ))}
            </select>
          </div>

          {selectedClass && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 space-y-1 text-xs">
              <div className="font-bold text-primary">{selectedClass.subject_name || (selectedClass as any).subjectName}</div>
              <div className="text-muted-foreground">{selectedClass.program_name || (selectedClass as any).programName}</div>
              <div className="text-muted-foreground font-medium pt-1">
                Enrolled Students: <span className="text-foreground font-bold">{students.length}</span>
              </div>
            </div>
          )}

          <div className="bg-muted/40 rounded-xl p-3 text-[11px] text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Option A Absences Applied</span>
            </div>
            <p>
              When opened, all eligible students default to <strong>ABSENT</strong>. Recognition updates them to PRESENT.
            </p>
          </div>

          <button
            onClick={handleStartSession}
            disabled={students.length === 0}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl text-sm shadow-md transition-all disabled:opacity-50"
          >
            Open Attendance Session
          </button>
        </div>
      </div>
    )
  }

  // Session Completed Screen
  if (sessionCompleted) {
    return (
      <div className="py-10 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Attendance Locked & Saved</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Session has been safely recorded in local Dexie storage and queued for synchronization.
          </p>
        </div>

        {/* Stats card */}
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          <div className="bg-card border rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Present</div>
            <div className="text-xl font-bold text-emerald-600">{presentCount}</div>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Late</div>
            <div className="text-xl font-bold text-amber-600">{lateCount}</div>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Absent</div>
            <div className="text-xl font-bold text-rose-600">{absentCount}</div>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2 max-w-xs mx-auto">
          <button
            onClick={() => navigate('/schedule')}
            className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl text-sm shadow-md"
          >
            Return to Schedule
          </button>
          <button
            onClick={() => navigate('/history')}
            className="w-full border bg-card text-foreground font-semibold py-2.5 rounded-xl text-sm"
          >
            View Session History
          </button>
        </div>
      </div>
    )
  }

  // Active Session Classroom Mode
  return (
    <div className="space-y-4">
      {/* Session Top Bar */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Session Active
          </span>
          <span className="text-xs text-muted-foreground font-mono">Started: {currentSession.start_time}</span>
        </div>

        {/* Counter Pills */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
            <div className="text-[10px] font-semibold text-emerald-600 uppercase">Present</div>
            <div className="text-lg font-bold text-emerald-700">{presentCount}</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
            <div className="text-[10px] font-semibold text-amber-600 uppercase">Late</div>
            <div className="text-lg font-bold text-amber-700">{lateCount}</div>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2 text-center">
            <div className="text-[10px] font-semibold text-rose-600 uppercase">Absent</div>
            <div className="text-lg font-bold text-rose-700">{absentCount}</div>
          </div>
        </div>

        {/* Topic Covered Section (Mandatory Rule) */}
        <div className="pt-2 border-t space-y-2">
          <label className="block text-xs font-semibold text-foreground flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span>Topic Covered *</span>
          </label>
          {topics.length > 0 ? (
            <select
              value={selectedTopicId}
              onChange={(e) => {
                setSelectedTopicId(e.target.value)
                if (e.target.value !== '__custom__') setCustomTopic('')
              }}
              className="w-full border rounded-lg p-2 text-xs bg-background focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select Syllabus Topic --</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic_name}
                </option>
              ))}
              <option value="__custom__">+ Enter Custom Topic...</option>
            </select>
          ) : null}

          {(topics.length === 0 || selectedTopicId === '__custom__') && (
            <input
              type="text"
              placeholder="Enter topic / chapter title covered..."
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-xs bg-background focus:ring-2 focus:ring-primary"
            />
          )}
        </div>

        {/* Face Recognition Camera Scanner Trigger */}
        <div className="pt-2 border-t flex items-center gap-2">
          <button
            onClick={() => setShowScanner((v) => !v)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm ${
              showScanner
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95'
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>{showScanner ? 'Hide Camera Scanner' : '📷 Open Face Scanner'}</span>
          </button>
          <button
            onClick={handleQuickSyncRoster}
            disabled={syncingRoster}
            title="Pull latest students and face descriptors from cloud"
            className="p-2.5 rounded-xl border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${syncingRoster ? 'animate-spin text-primary' : ''}`} />
          </button>
          <button
            onClick={handleDropAllData}
            title="Drop all local data from Teacher App"
            className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Drop All Data</span>
          </button>
        </div>
      </div>

      {/* Live Camera Face Scanner */}
      {showScanner && (
        <PwaFaceScanner
          students={students}
          alreadyPresentIds={
            new Set(
              Object.values(records)
                .filter((r) => r.status === 'PRESENT')
                .map((r) => r.student_id)
            )
          }
          onRecognized={handleFaceRecognized}
          onStudentEnrolled={(studentId, descriptor) => {
            setStudents((prev) =>
              prev.map((s) =>
                s.student_id === studentId
                  ? { ...s, face_enrolled: true, face_descriptor: descriptor }
                  : s
              )
            )
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Filter and Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search student or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {(['ALL', 'PRESENT', 'ABSENT', 'LATE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full font-medium transition-all text-xs ${
                filter === f
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-card border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Student Roster List with Quick Status Toggles */}
      <div className="space-y-2">
        {filteredStudents.length === 0 ? (
          <div className="p-8 border border-dashed rounded-2xl text-center bg-card/40 space-y-3">
            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">No students in roster</p>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                Teacher App local data is cleared. Push fresh master data from Desktop, then tap <strong>🔄 Sync</strong> above to pull.
              </p>
            </div>
          </div>
        ) : (
          filteredStudents.map((s) => {
          const r = records[s.student_id]
          const status = r ? r.status : 'ABSENT'

          return (
            <div
              key={s.student_id}
              className="bg-card border rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    status === 'PRESENT'
                      ? 'bg-emerald-500 text-white'
                      : status === 'LATE'
                      ? 'bg-amber-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-foreground truncate">{s.name}</h4>
                  <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                    <span>{s.admission_number}</span>
                    {s.face_enrolled && (
                      <span className="text-primary font-semibold flex items-center gap-0.5">
                        <ScanFace className="h-2.5 w-2.5" />
                        Face ID
                      </span>
                    )}
                    {r && r.status === 'PRESENT' && (
                      <span className={`px-1.5 py-0.5 rounded font-semibold text-[9px] ${
                        r.recognition_method === 'FACE_RECOGNITION'
                          ? 'bg-emerald-500/15 text-emerald-700 font-bold border border-emerald-500/30'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {r.recognition_method === 'FACE_RECOGNITION' ? '✓ Marked (Face)' : 'Marked (Manual)'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleSetStatus(s.student_id, 'PRESENT')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    status === 'PRESENT'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  P
                </button>
                <button
                  onClick={() => handleSetStatus(s.student_id, 'LATE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    status === 'LATE'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  L
                </button>
                <button
                  onClick={() => handleSetStatus(s.student_id, 'ABSENT')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    status === 'ABSENT'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  A
                </button>
              </div>
            </div>
          )
        }))}
      </div>

      {/* Finish and Lock Session Button */}
      <div className="pt-2">
        <button
          onClick={handleFinishSession}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Finalizing Session...' : 'Finish & Lock Attendance'}</span>
        </button>
      </div>
    </div>
  )
}
