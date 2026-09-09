import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X,
  Clock,
  LayoutList,
  LayoutGrid,
  Building2,
  UserCheck,
  MapPin,
  CalendarDays,
  Filter,
} from 'lucide-react'
import type {
  TimetableSlot,
  CreateTimetableSlotInput,
  Subject,
  Batch,
  Faculty,
  StudentGroup,
  Department,
} from '@main/ipc/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] // Mon-Sat-Sun display order

export function format12Hour(timeStr?: string): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hour = parseInt(parts[0], 10)
  const minute = parts[1]
  if (isNaN(hour)) return timeStr
  const period = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${period}`
}

function formatDuration(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return ''
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return ''
  const diffMins = eh * 60 + em - (sh * 60 + sm)
  if (diffMins <= 0) return ''
  const hrs = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`
  if (hrs > 0) return `${hrs} hr`
  return `${mins} min`
}

const SLOT_COLORS = [
  'bg-blue-100 border-blue-300 text-blue-800',
  'bg-green-100 border-green-300 text-green-800',
  'bg-purple-100 border-purple-300 text-purple-800',
  'bg-amber-100 border-amber-300 text-amber-800',
  'bg-rose-100 border-rose-300 text-rose-800',
  'bg-cyan-100 border-cyan-300 text-cyan-800',
  'bg-indigo-100 border-indigo-300 text-indigo-800',
  'bg-orange-100 border-orange-300 text-orange-800',
]

function slotColor(subjectId: string) {
  let hash = 0
  for (let i = 0; i < subjectId.length; i++) hash = subjectId.charCodeAt(i) + ((hash << 5) - hash)
  return SLOT_COLORS[Math.abs(hash) % SLOT_COLORS.length]
}

interface SlotFormData {
  department_id: string
  subject_id: string
  batch_id: string
  group_id: string
  faculty_id: string
  room: string
  day_of_week: number
  start_time: string
  end_time: string
  effective_from: string
  effective_until: string
}

const defaultForm = (dayOfWeek = 1): SlotFormData => ({
  department_id: '',
  subject_id: '',
  batch_id: '',
  group_id: '',
  faculty_id: '',
  room: '',
  day_of_week: dayOfWeek,
  start_time: '09:00',
  end_time: '10:00',
  effective_from: '',
  effective_until: '',
})

export default function TimetablePage() {
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [groups, setGroups] = useState<StudentGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TimetableSlot | null>(null)
  const [form, setForm] = useState<SlotFormData>(defaultForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<any | null>(null)
  const [activeOnly, setActiveOnly] = useState(true)

  const [viewMode, setViewMode] = useState<'ROW_WISE' | 'GRID'>('ROW_WISE')
  const [filterDay, setFilterDay] = useState<'ALL' | 'TODAY' | number>('ALL')
  const [filterBatchId, setFilterBatchId] = useState<string>('')

  const todayDow = new Date().getDay()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, b, f, sl, g, d] = await Promise.allSettled([
        window.api.subject.list(),
        window.api.batch.list(),
        window.api.faculty.list(),
        window.api.timetable.list({ active_only: activeOnly }),
        window.api.studentGroup.list(),
        window.api.department.list(),
      ])
      if (s.status === 'fulfilled') setSubjects(s.value)
      if (b.status === 'fulfilled') setBatches(b.value)
      if (f.status === 'fulfilled') setFaculties(f.value)
      if (sl.status === 'fulfilled') setSlots(sl.value)
      if (g.status === 'fulfilled') setGroups(g.value)
      if (d.status === 'fulfilled') setDepartments(d.value)
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showForm) {
        setShowForm(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showForm])

  const deptMap = useMemo(() => {
    const map = new Map<string, Department>()
    departments.forEach((d) => map.set(d.department_id, d))
    return map
  }, [departments])

  const facultyMap = useMemo(() => {
    const map = new Map<string, Faculty>()
    faculties.forEach((f) => map.set(f.faculty_id, f))
    return map
  }, [faculties])

  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>()
    subjects.forEach((s) => map.set(s.subject_id, s))
    return map
  }, [subjects])

  const batchMap = useMemo(() => {
    const map = new Map<string, Batch>()
    batches.forEach((b) => map.set(b.batch_id, b))
    return map
  }, [batches])

  const groupMap = useMemo(() => {
    const map = new Map<string, StudentGroup>()
    groups.forEach((g) => map.set(g.student_group_id, g))
    return map
  }, [groups])

  const availableFaculties = useMemo(() => {
    if (!form.department_id) return faculties
    return faculties.filter((f) => f.department_id === form.department_id)
  }, [faculties, form.department_id])

  const openCreate = (dayOfWeek: number) => {
    setEditing(null)
    setForm(defaultForm(dayOfWeek))
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (slot: TimetableSlot) => {
    setEditing(slot)
    const fac = faculties.find((f) => f.faculty_id === slot.faculty_id)
    const subj = subjects.find((s) => s.subject_id === slot.subject_id)
    const deptId = fac?.department_id || subj?.department_id || ''

    setForm({
      department_id: deptId,
      subject_id: slot.subject_id,
      batch_id: slot.batch_id,
      group_id: slot.group_id ?? '',
      faculty_id: slot.faculty_id ?? '',
      room: slot.room ?? '',
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      effective_from: slot.effective_from ?? '',
      effective_until: slot.effective_until ?? '',
    })
    setFormError('')
    setShowForm(true)
  }

  const handleDepartmentChange = (deptId: string) => {
    setForm((prev) => {
      let newFacultyId = prev.faculty_id
      if (deptId && newFacultyId) {
        const currentFac = faculties.find((f) => f.faculty_id === newFacultyId)
        if (currentFac && currentFac.department_id !== deptId) {
          newFacultyId = ''
        }
      }
      const inDept = faculties.filter((f) => f.department_id === deptId)
      if (inDept.length === 1 && !newFacultyId) {
        newFacultyId = inDept[0].faculty_id
      }

      return {
        ...prev,
        department_id: deptId,
        faculty_id: newFacultyId,
      }
    })
  }

  const handleSubjectChange = (subjId: string) => {
    const subj = subjects.find((s) => s.subject_id === subjId)
    setForm((prev) => {
      let nextDeptId = prev.department_id
      if (subj?.department_id) {
        nextDeptId = subj.department_id
      }
      return {
        ...prev,
        subject_id: subjId,
        department_id: nextDeptId,
      }
    })
  }

  const handleSave = async () => {
    if (!form.subject_id) {
      setFormError('Subject is required')
      return
    }
    if (!form.batch_id) {
      setFormError('Batch is required')
      return
    }
    if (!form.start_time || !form.end_time) {
      setFormError('Start and end time required')
      return
    }
    if (form.start_time >= form.end_time) {
      setFormError('End time must be after start time')
      return
    }

    setSaving(true)
    try {
      const subj = subjects.find((s) => s.subject_id === form.subject_id)
      const batch = batches.find((b) => b.batch_id === form.batch_id)
      const fac = faculties.find((f) => f.faculty_id === form.faculty_id)
      const grp = groups.find((g) => g.student_group_id === form.group_id)

      const input: any = {
        subject_id: form.subject_id,
        subject_name: subj?.subject_name,
        subject_code: subj?.subject_code,
        batch_id: form.batch_id,
        batch_name: batch?.batch_name,
        group_id: form.group_id || undefined,
        group_name: grp?.group_name,
        faculty_id: form.faculty_id || undefined,
        faculty_name: fac?.name,
        room: form.room || undefined,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        effective_from: form.effective_from || undefined,
        effective_until: form.effective_until || undefined,
        active: editing ? (editing.active !== false) : true,
      }
      if (editing) await window.api.timetable.update(editing.slot_id, input)
      else await window.api.timetable.create(input)
      setShowForm(false)
      await load()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (slot: TimetableSlot) => {
    if (
      !confirm(
        `Delete slot: ${slot.subject_name || 'Class'} on ${DAYS[slot.day_of_week]} (${format12Hour(
          slot.start_time
        )} – ${format12Hour(slot.end_time)})?`
      )
    )
      return
    await window.api.timetable.delete(slot.slot_id)
    await load()
  }

  const handleToggleActive = async (slot: TimetableSlot) => {
    const nextActive = slot.active === false ? true : false
    await window.api.timetable.update(slot.slot_id, { active: nextActive })
    await load()
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateResult(null)
    try {
      const result = await window.api.timetable.generateTodaySessions()
      setGenerateResult(result)
    } finally {
      setGenerating(false)
    }
  }

  const enrichedSlots = useMemo(() => {
    return slots.map((slot) => {
      const subj = subjectMap.get(slot.subject_id || '') || subjects.find((s) => s.subject_id === slot.subject_id)
      const batch = batchMap.get(slot.batch_id || '') || batches.find((b) => b.batch_id === slot.batch_id)
      const fac = facultyMap.get(slot.faculty_id || '') || faculties.find((f) => f.faculty_id === slot.faculty_id)
      const grp = groupMap.get(slot.group_id || '') || groups.find((g) => g.student_group_id === slot.group_id)

      return {
        ...slot,
        active: slot.active !== false,
        subject_name: slot.subject_name || subj?.subject_name || '—',
        subject_code: slot.subject_code || subj?.subject_code || '',
        batch_name: slot.batch_name || batch?.batch_name || '—',
        faculty_name: slot.faculty_name || fac?.name || undefined,
        group_name: slot.group_name || grp?.group_name || undefined,
      }
    })
  }, [slots, subjectMap, batchMap, facultyMap, groupMap, subjects, batches, faculties, groups])

  const filteredSlots = useMemo(() => {
    if (!filterBatchId) return enrichedSlots
    return enrichedSlots.filter((s) => s.batch_id === filterBatchId)
  }, [enrichedSlots, filterBatchId])

  const slotsByDay = useMemo(() => {
    return WEEK_DAYS.map((dow) => ({
      dow,
      label: DAYS[dow],
      short: DAYS_SHORT[dow],
      isToday: dow === todayDow,
      slots: filteredSlots
        .filter((s) => s.day_of_week === dow)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }))
  }, [filteredSlots, todayDow])

  const displayedDays = useMemo(() => {
    if (filterDay === 'TODAY') {
      return slotsByDay.filter((d) => d.dow === todayDow)
    }
    if (typeof filterDay === 'number') {
      return slotsByDay.filter((d) => d.dow === filterDay)
    }
    return slotsByDay
  }, [slotsByDay, filterDay, todayDow])

  const totalSlotsCount = filteredSlots.length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> Timetable
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('ROW_WISE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'ROW_WISE'
                  ? 'bg-card text-primary shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Row-Wise List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'GRID'
                  ? 'bg-card text-primary shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Weekly Grid</span>
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none text-muted-foreground">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Active only
          </label>

          <button onClick={load} className="p-1.5 rounded border hover:bg-muted" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 shadow-sm"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Generate Today's Sessions
          </button>

          <button
            onClick={() => openCreate(todayDow)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Slot
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap p-2.5 bg-card border rounded-xl">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-medium">
          <button
            onClick={() => setFilterDay('ALL')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              filterDay === 'ALL'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'border bg-muted/20 text-muted-foreground hover:text-foreground'
            }`}
          >
            All Days ({totalSlotsCount})
          </button>

          <button
            onClick={() => setFilterDay('TODAY')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              filterDay === 'TODAY'
                ? 'bg-blue-600 text-white font-bold shadow-sm'
                : 'border bg-muted/20 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Today ({DAYS_SHORT[todayDow]})</span>
            <span className="text-[10px] px-1.5 rounded-full bg-white/20">
              {slots.filter((s) => s.day_of_week === todayDow).length}
            </span>
          </button>

          {WEEK_DAYS.map((dow) => {
            const count = slots.filter((s) => s.day_of_week === dow).length
            const isSelected = filterDay === dow
            return (
              <button
                key={dow}
                onClick={() => setFilterDay(dow)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'border bg-muted/20 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{DAYS_SHORT[dow]}</span>
                {count > 0 && (
                  <span className="text-[10px] px-1 rounded-full bg-muted font-bold text-foreground">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {batches.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterBatchId}
              onChange={(e) => setFilterBatchId(e.target.value)}
              className="bg-background border rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="">All Batches ({batches.length})</option>
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {generateResult && (
        <div
          className={`rounded-lg border p-4 flex items-start gap-3 ${
            (generateResult.created || 0) > 0 ? 'bg-green-50 border-green-200' : 'bg-muted border-border'
          }`}
        >
          <CheckCircle
            className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              (generateResult.created || 0) > 0 ? 'text-green-600' : 'text-muted-foreground'
            }`}
          />
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {generateResult.created || 0} session{generateResult.created !== 1 ? 's' : ''} created ·{' '}
              {generateResult.skipped || 0} skipped (already exist)
            </p>
            {generateResult.details && generateResult.details.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {generateResult.details.map((d: any, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {d.result === 'CREATED' ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : d.result === 'ERROR' ? (
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
                    )}
                    {d.subject_name || 'Subject'} – {d.batch_name || 'Batch'} at {format12Hour(d.start_time || '09:00')}
                    {d.reason && <span className="text-muted-foreground"> ({d.reason})</span>}
                  </p>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setGenerateResult(null)} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Add / Edit Slot Popup Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false)
          }}
        >
          <div className="bg-card border rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
              <div>
                <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span>{editing ? 'Edit Timetable Slot' : 'Add Timetable Class Slot'}</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure class timings, batch, and assign professor by department
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {formError && (
                <p className="text-destructive text-sm bg-destructive/10 p-2.5 rounded-xl font-medium border border-destructive/20">
                  {formError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground">Day of the Week *</label>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background"
                    value={form.day_of_week}
                    onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
                  >
                    {WEEK_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {DAYS[d]} {d === todayDow ? '(Today)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Start Time *
                    </label>
                    {form.start_time && (
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {format12Hour(form.start_time)}
                      </span>
                    )}
                  </div>
                  <input
                    type="time"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background font-mono"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" /> End Time *
                    </label>
                    {form.end_time && (
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {format12Hour(form.end_time)}
                      </span>
                    )}
                  </div>
                  <input
                    type="time"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background font-mono"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-1.5 p-2.5 bg-muted/30 border rounded-xl">
                  <span className="text-xs text-muted-foreground font-semibold mr-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Presets:
                  </span>
                  {[
                    { start: '09:00', end: '10:00', label: '9:00 AM – 10:00 AM' },
                    { start: '10:00', end: '11:00', label: '10:00 AM – 11:00 AM' },
                    { start: '11:30', end: '12:30', label: '11:30 AM – 12:30 PM' },
                    { start: '13:30', end: '14:30', label: '1:30 PM – 2:30 PM' },
                    { start: '14:30', end: '15:30', label: '2:30 PM – 3:30 PM' },
                    { start: '15:30', end: '16:30', label: '3:30 PM – 4:30 PM' },
                  ].map((preset) => (
                    <button
                      key={preset.start}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, start_time: preset.start, end_time: preset.end }))
                      }
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                        form.start_time === preset.start && form.end_time === preset.end
                          ? 'bg-primary text-primary-foreground border-primary font-bold shadow-sm'
                          : 'bg-background hover:bg-muted text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Subject *</label>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background"
                    value={form.subject_id}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                  >
                    <option value="">
                      {subjects.length > 0
                        ? `— Select Subject (${subjects.length} available) —`
                        : '— No Subjects Available —'}
                    </option>
                    {subjects.map((s) => (
                      <option key={s.subject_id} value={s.subject_id}>
                        {s.subject_name} ({s.subject_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Batch *</label>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background"
                    value={form.batch_id}
                    onChange={(e) => setForm((f) => ({ ...f, batch_id: e.target.value }))}
                  >
                    <option value="">
                      {batches.length > 0
                        ? `— Select Batch (${batches.length} available) —`
                        : '— No Batches Available —'}
                    </option>
                    {batches.map((b) => (
                      <option key={b.batch_id} value={b.batch_id}>
                        {b.batch_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Group <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background"
                    value={form.group_id}
                    onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))}
                  >
                    <option value="">— Entire Batch (No Group) —</option>
                    {groups.map((g) => (
                      <option key={g.student_group_id} value={g.student_group_id}>
                        {g.group_name} ({g.group_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 space-y-1">
                  <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>1. Select Department *</span>
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background font-medium"
                    value={form.department_id}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                  >
                    <option value="">— Filter by Department ({departments.length}) —</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>
                        {d.department_name} ({d.department_code || 'DEPT'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Filtering ensures only professors in this department are shown below.
                  </p>
                </div>

                <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 space-y-1">
                  <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>2. Professor / Faculty</span>
                    {form.department_id && (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        ({availableFaculties.length} in{' '}
                        {deptMap.get(form.department_id)?.department_name || 'dept'})
                      </span>
                    )}
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background font-medium"
                    value={form.faculty_id}
                    onChange={(e) => setForm((f) => ({ ...f, faculty_id: e.target.value }))}
                  >
                    <option value="">
                      {availableFaculties.length > 0
                        ? `— Select Professor (${availableFaculties.length} available) —`
                        : form.department_id
                        ? '— No Professors in this Department —'
                        : '— Select Professor —'}
                    </option>
                    {availableFaculties.map((f) => {
                      const dept = deptMap.get(f.department_id || '')
                      return (
                        <option key={f.faculty_id} value={f.faculty_id}>
                          {f.name} {f.designation ? `· ${f.designation}` : ''}{' '}
                          {dept && !form.department_id ? `(${dept.department_name})` : ''}
                        </option>
                      )
                    })}
                  </select>
                  {availableFaculties.length === 0 && form.department_id && (
                    <p className="text-[10px] text-amber-600">
                      No professors registered under this department yet. Add in People → Faculty.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Room / Venue <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lecture Hall 1, Lab 3"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background"
                    value={form.room}
                    onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Effective From <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background"
                    value={form.effective_from}
                    onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Effective Until <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background"
                    value={form.effective_until}
                    onChange={(e) => setForm((f) => ({ ...f, effective_until: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2.5 bg-muted/20">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-md hover:opacity-95 disabled:opacity-60 transition-opacity"
              >
                {saving ? 'Saving…' : editing ? 'Update Slot' : 'Save Slot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'ROW_WISE' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Loading timetable schedule…
            </div>
          ) : displayedDays.every((d) => d.slots.length === 0) ? (
            <div className="p-12 text-center bg-card border rounded-2xl space-y-3">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="font-bold text-foreground">No timetable slots found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No classes match the selected filter. Tap <strong>+ Add Slot</strong> above to schedule classes.
              </p>
            </div>
          ) : (
            displayedDays.map((day) => {
              if (filterDay === 'ALL' && day.slots.length === 0) {
                return (
                  <div
                    key={day.dow}
                    className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border border-dashed rounded-xl text-xs text-muted-foreground"
                  >
                    <span className="font-semibold text-foreground/70">{day.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] italic">No classes scheduled</span>
                      <button
                        onClick={() => openCreate(day.dow)}
                        className="text-primary font-bold hover:underline"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={day.dow}
                  className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${
                    day.isToday ? 'ring-2 ring-primary/60 border-primary' : ''
                  }`}
                >
                  <div
                    className={`px-5 py-3 flex items-center justify-between ${
                      day.isToday
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/40 border-b'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-base">{day.label}</h3>
                      {day.isToday && (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-white text-primary uppercase tracking-wider">
                          Today
                        </span>
                      )}
                      <span
                        className={`text-xs ${
                          day.isToday ? 'text-white/80' : 'text-muted-foreground'
                        }`}
                      >
                        ({day.slots.length} {day.slots.length === 1 ? 'class' : 'classes'})
                      </span>
                    </div>

                    <button
                      onClick={() => openCreate(day.dow)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                        day.isToday
                          ? 'bg-white/20 hover:bg-white/30 text-white'
                          : 'bg-card border hover:bg-muted text-foreground'
                      }`}
                      title={`Add class on ${day.label}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Class</span>
                    </button>
                  </div>

                  {day.slots.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No classes scheduled for {day.label}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b bg-muted/20 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <th className="px-4 py-2.5 min-w-[140px]">Time Slot</th>
                            <th className="px-4 py-2.5 min-w-[180px]">Subject</th>
                            <th className="px-4 py-2.5 min-w-[130px]">Batch / Group</th>
                            <th className="px-4 py-2.5 min-w-[180px]">Professor / Faculty</th>
                            <th className="px-4 py-2.5 min-w-[120px]">Room</th>
                            <th className="px-3 py-2.5 min-w-[90px] text-center">Status</th>
                            <th className="px-4 py-2.5 min-w-[100px] text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y">
                          {day.slots.map((slot) => {
                            const fac = facultyMap.get(slot.faculty_id || '') || faculties.find((f) => f.faculty_id === slot.faculty_id)
                            const facultyDisplayName = slot.faculty_name || fac?.name
                            const dept = fac?.department_id ? deptMap.get(fac.department_id) : null
                            const duration = formatDuration(slot.start_time, slot.end_time)
                            const isActive = slot.active !== false

                            return (
                              <tr
                                key={slot.slot_id}
                                className={`hover:bg-muted/30 transition-colors ${
                                  !isActive ? 'opacity-40' : ''
                                }`}
                              >
                                <td className="px-4 py-3 align-middle font-mono whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>
                                      {format12Hour(slot.start_time)} – {format12Hour(slot.end_time)}
                                    </span>
                                  </div>
                                  {duration && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5 pl-6 font-sans">
                                      Duration: {duration}
                                    </div>
                                  )}
                                </td>

                                <td className="px-4 py-3 align-middle">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {slot.subject_code && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-foreground font-mono">
                                        {slot.subject_code}
                                      </span>
                                    )}
                                    <span className="font-bold text-foreground text-sm">
                                      {slot.subject_name}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-3 align-middle">
                                  <div className="font-semibold text-foreground">
                                    {slot.batch_name}
                                  </div>
                                  {slot.group_name && (
                                    <div className="text-[10px] text-muted-foreground font-medium">
                                      Group: {slot.group_name}
                                    </div>
                                  )}
                                </td>

                                <td className="px-4 py-3 align-middle">
                                  {facultyDisplayName ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                                        {facultyDisplayName.charAt(0)}
                                      </div>
                                      <div>
                                        <div className="font-semibold text-foreground">
                                          {facultyDisplayName}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                          {fac?.designation && <span>{fac.designation}</span>}
                                          {dept && (
                                            <span className="text-primary/80 font-medium">
                                              · {dept.department_name}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">
                                      Unassigned
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 align-middle text-muted-foreground whitespace-nowrap">
                                  {slot.room ? (
                                    <div className="flex items-center gap-1 text-foreground font-medium">
                                      <MapPin className="h-3.5 w-3.5 text-primary" />
                                      <span>{slot.room}</span>
                                    </div>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </td>

                                <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
                                  <button
                                    onClick={() => handleToggleActive(slot)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                      isActive
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                    }`}
                                    title="Click to toggle active status"
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isActive ? 'bg-emerald-500' : 'bg-muted-foreground'
                                      }`}
                                    />
                                    <span>{isActive ? 'Active' : 'Inactive'}</span>
                                  </button>
                                </td>

                                <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => openEdit(slot)}
                                      className="p-1.5 rounded-lg border hover:bg-accent text-foreground transition-colors"
                                      title="Edit class slot"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(slot)}
                                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                                      title="Delete class slot"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {viewMode === 'GRID' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedDays.map((day) => (
            <div
              key={day.dow}
              className={`bg-card border rounded-2xl overflow-hidden flex flex-col shadow-sm ${
                day.isToday ? 'ring-2 ring-primary border-primary' : ''
              }`}
            >
              <div
                className={`px-4 py-2.5 flex items-center justify-between ${
                  day.isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/30 border-b'
                }`}
              >
                <span className="text-sm font-bold flex items-center gap-2">
                  <span>{day.label}</span>
                  {day.isToday && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-white text-primary uppercase">
                      Today
                    </span>
                  )}
                </span>
                <button
                  onClick={() => openCreate(day.dow)}
                  className={`p-1 rounded-lg hover:bg-white/20 transition-colors ${
                    day.isToday
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={`Add slot on ${day.label}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 p-2.5 space-y-2 min-h-[90px]">
                {day.slots.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6 opacity-60">
                    No classes
                  </p>
                ) : (
                  day.slots.map((slot) => {
                    const fac = facultyMap.get(slot.faculty_id || '') || faculties.find((f) => f.faculty_id === slot.faculty_id)
                    const facultyDisplayName = slot.faculty_name || fac?.name
                    const isActive = slot.active !== false

                    return (
                      <div
                        key={slot.slot_id}
                        className={`border rounded-xl p-2.5 text-xs space-y-1 ${slotColor(
                          slot.subject_id
                        )} ${!isActive ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-bold leading-tight truncate text-sm">
                            {slot.subject_name}
                          </p>
                          <div className="flex gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => openEdit(slot)}
                              className="p-1 rounded hover:bg-black/10"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(slot)}
                              className="p-1 rounded hover:bg-black/10"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-[11px] opacity-90 font-mono">
                          <Clock className="h-3 w-3 inline text-primary/80 shrink-0" />
                          <span>
                            {format12Hour(slot.start_time)} – {format12Hour(slot.end_time)}
                          </span>
                        </div>
                        <p className="opacity-80 font-medium truncate">{slot.batch_name}</p>
                        {facultyDisplayName && (
                          <p className="opacity-70 truncate text-[11px]">👨‍🏫 {facultyDisplayName}</p>
                        )}
                        {slot.room && <p className="opacity-70 text-[11px]">📍 {slot.room}</p>}
                        {!isActive && (
                          <button
                            onClick={() => handleToggleActive(slot)}
                            className="text-[10px] underline opacity-70"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground text-right bg-muted/10">
                {day.slots.length} slot{day.slots.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 <strong>Generate Today's Sessions</strong> reads today's ({DAYS[todayDow]}) timetable and
        creates attendance sessions for all active slots. Already-existing sessions are skipped.
      </p>
    </div>
  )
}
