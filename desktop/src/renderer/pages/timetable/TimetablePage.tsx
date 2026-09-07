import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Calendar, Play, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, X, Clock } from 'lucide-react'
import type {
  TimetableSlot, CreateTimetableSlotInput,
  Subject, Batch, Faculty, StudentGroup
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
  subject_id: '', batch_id: '', group_id: '', faculty_id: '',
  room: '', day_of_week: dayOfWeek,
  start_time: '09:00', end_time: '10:00',
  effective_from: '', effective_until: '',
})

export default function TimetablePage() {
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])
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

  const todayDow = new Date().getDay()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, b, f, sl, g] = await Promise.allSettled([
        window.api.subject.list(),
        window.api.batch.list(),
        window.api.faculty.list(),
        window.api.timetable.list({ active_only: activeOnly }),
        window.api.studentGroup.list(),
      ])
      if (s.status === 'fulfilled') setSubjects(s.value)
      if (b.status === 'fulfilled') setBatches(b.value)
      if (f.status === 'fulfilled') setFaculties(f.value)
      if (sl.status === 'fulfilled') setSlots(sl.value)
      if (g.status === 'fulfilled') setGroups(g.value)
    } finally { setLoading(false) }
  }, [activeOnly])

  useEffect(() => { load() }, [load])

  const openCreate = (dayOfWeek: number) => {
    setEditing(null)
    setForm(defaultForm(dayOfWeek))
    setFormError(''); setShowForm(true)
  }

  const openEdit = (slot: TimetableSlot) => {
    setEditing(slot)
    setForm({
      subject_id: slot.subject_id, batch_id: slot.batch_id,
      group_id: slot.group_id ?? '', faculty_id: slot.faculty_id ?? '',
      room: slot.room ?? '', day_of_week: slot.day_of_week,
      start_time: slot.start_time, end_time: slot.end_time,
      effective_from: slot.effective_from ?? '', effective_until: slot.effective_until ?? '',
    })
    setFormError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.subject_id) { setFormError('Subject is required'); return }
    if (!form.batch_id) { setFormError('Batch is required'); return }
    if (!form.start_time || !form.end_time) { setFormError('Start and end time required'); return }
    if (form.start_time >= form.end_time) { setFormError('End time must be after start time'); return }

    setSaving(true)
    try {
      const input: CreateTimetableSlotInput = {
        subject_id: form.subject_id, batch_id: form.batch_id,
        group_id: form.group_id || undefined, faculty_id: form.faculty_id || undefined,
        room: form.room || undefined, day_of_week: form.day_of_week,
        start_time: form.start_time, end_time: form.end_time,
        effective_from: form.effective_from || undefined,
        effective_until: form.effective_until || undefined,
      }
      if (editing) await window.api.timetable.update(editing.slot_id, input)
      else await window.api.timetable.create(input)
      setShowForm(false); await load()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (slot: TimetableSlot) => {
    if (!confirm(`Delete slot: ${slot.subject_name} on ${DAYS[slot.day_of_week]} (${format12Hour(slot.start_time)} – ${format12Hour(slot.end_time)})?`)) return
    await window.api.timetable.delete(slot.slot_id)
    await load()
  }

  const handleToggleActive = async (slot: TimetableSlot) => {
    await window.api.timetable.update(slot.slot_id, { active: !slot.active })
    await load()
  }

  const handleGenerate = async () => {
    setGenerating(true); setGenerateResult(null)
    try {
      const result = await window.api.timetable.generateTodaySessions()
      setGenerateResult(result)
    } finally { setGenerating(false) }
  }

  // Group slots by day_of_week
  const slotsByDay = WEEK_DAYS.map(dow => ({
    dow,
    label: DAYS[dow],
    short: DAYS_SHORT[dow],
    isToday: dow === todayDow,
    slots: slots.filter(s => s.day_of_week === dow).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> Timetable
          </h1>
          <p className="text-muted-foreground text-sm">
            Weekly recurring class schedule (12-hour AM/PM) · {slots.length} slot{slots.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none text-muted-foreground">
            <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
            Active only
          </label>
          <button onClick={load} className="p-1.5 rounded border hover:bg-muted" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
            {generating
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Play className="h-4 w-4" />}
            Generate Today's Sessions
          </button>
          <button onClick={() => openCreate(todayDow)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 shadow-sm">
            <Plus className="h-4 w-4" /> Add Slot
          </button>
        </div>
      </div>

      {/* Generate Result Banner */}
      {generateResult && (
        <div className={`rounded-lg border p-4 flex items-start gap-3 ${generateResult.created > 0 ? 'bg-green-50 border-green-200' : 'bg-muted border-border'}`}>
          <CheckCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${generateResult.created > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {generateResult.created} session{generateResult.created !== 1 ? 's' : ''} created
              · {generateResult.skipped} skipped (already exist)
            </p>
            <div className="mt-2 space-y-0.5">
              {generateResult.details.map((d: any, i: number) => (
                <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {d.result === 'CREATED'
                    ? <CheckCircle className="h-3 w-3 text-green-500" />
                    : d.result === 'ERROR'
                    ? <AlertTriangle className="h-3 w-3 text-red-500" />
                    : <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />}
                  {d.subject_name} – {d.batch_name} at {format12Hour(d.start_time)}
                  {d.reason && <span className="text-muted-foreground"> ({d.reason})</span>}
                </p>
              ))}
            </div>
          </div>
          <button onClick={() => setGenerateResult(null)} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Slot Form */}
      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-semibold text-base">{editing ? 'Edit Timetable Slot' : 'Add Timetable Slot'}</h2>
            <button onClick={() => setShowForm(false)} className="p-1 rounded text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && <p className="text-destructive text-sm bg-destructive/10 p-2.5 rounded-md">{formError}</p>}

          {subjects.length === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-md text-xs">
              ⚠️ No subjects found in the database. Please add subjects in Academic → Subjects first.
            </div>
          )}
          {batches.length === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-md text-xs">
              ⚠️ No batches found in the database. Please add batches in Academic → Batches first.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Day */}
            <div>
              <label className="text-sm font-medium">Day of the Week *</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}>
                {WEEK_DAYS.map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
              </select>
            </div>
            {/* Start time */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Start Time *
                </label>
                {form.start_time && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {format12Hour(form.start_time)}
                  </span>
                )}
              </div>
              <input type="time" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            {/* End time */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> End Time *
                </label>
                {form.end_time && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {format12Hour(form.end_time)}
                  </span>
                )}
              </div>
              <input type="time" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>

            {/* Quick 12-hour AM/PM presets */}
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-1.5 p-2 bg-muted/20 border rounded-lg">
              <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Quick Presets:
              </span>
              {[
                { start: '09:00', end: '10:00', label: '9:00 AM – 10:00 AM' },
                { start: '10:00', end: '11:00', label: '10:00 AM – 11:00 AM' },
                { start: '11:30', end: '12:30', label: '11:30 AM – 12:30 PM' },
                { start: '13:30', end: '14:30', label: '1:30 PM – 2:30 PM' },
                { start: '14:30', end: '15:30', label: '2:30 PM – 3:30 PM' },
                { start: '15:30', end: '16:30', label: '3:30 PM – 4:30 PM' },
              ].map(preset => (
                <button
                  key={preset.start}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, start_time: preset.start, end_time: preset.end }))}
                  className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                    form.start_time === preset.start && form.end_time === preset.end
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* Subject */}
            <div>
              <label className="text-sm font-medium">Subject *</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
                <option value="">{subjects.length > 0 ? `— Select Subject (${subjects.length} available) —` : '— No Subjects Available —'}</option>
                {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name} ({s.subject_code})</option>)}
              </select>
            </div>
            {/* Batch */}
            <div>
              <label className="text-sm font-medium">Batch *</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.batch_id} onChange={e => setForm(f => ({ ...f, batch_id: e.target.value }))}>
                <option value="">{batches.length > 0 ? `— Select Batch (${batches.length} available) —` : '— No Batches Available —'}</option>
                {batches.map(b => <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>)}
              </select>
            </div>
            {/* Faculty */}
            <div>
              <label className="text-sm font-medium">Faculty <span className="text-muted-foreground">(optional)</span></label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.faculty_id} onChange={e => setForm(f => ({ ...f, faculty_id: e.target.value }))}>
                <option value="">{faculties.length > 0 ? `— Select Faculty (${faculties.length} available) —` : '— None —'}</option>
                {faculties.map(f => <option key={f.faculty_id} value={f.faculty_id}>{f.name} {f.designation ? `(${f.designation})` : ''}</option>)}
              </select>
            </div>
            {/* Student Group (Optional) */}
            <div>
              <label className="text-sm font-medium">Student Group / Sub-batch <span className="text-muted-foreground">(optional)</span></label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                <option value="">— Entire Batch —</option>
                {groups.map(g => <option key={g.student_group_id} value={g.student_group_id}>{g.group_name} ({g.group_type})</option>)}
              </select>
            </div>
            {/* Room */}
            <div>
              <label className="text-sm font-medium">Room / Hall <span className="text-muted-foreground">(optional)</span></label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                placeholder="e.g. Lecture Hall 1, Lab 3" />
            </div>
            {/* Effective from */}
            <div>
              <label className="text-sm font-medium">Effective From <span className="text-muted-foreground">(optional)</span></label>
              <input type="date" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
            </div>
            {/* Effective until */}
            <div>
              <label className="text-sm font-medium">Effective Until <span className="text-muted-foreground">(optional)</span></label>
              <input type="date" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.effective_until} onChange={e => setForm(f => ({ ...f, effective_until: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Slot'}
            </button>
          </div>
        </div>
      )}

      {/* Weekly Grid */}
      {loading ? (
        <div className="p-10 text-center text-muted-foreground text-sm">Loading timetable…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {slotsByDay.filter(d => d.dow !== 0).concat(slotsByDay.filter(d => d.dow === 0)).map(day => (
            <div key={day.dow}
              className={`bg-card border rounded-lg overflow-hidden flex flex-col ${day.isToday ? 'ring-2 ring-primary' : ''}`}>
              {/* Day header */}
              <div className={`px-4 py-2.5 flex items-center justify-between ${day.isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/30 border-b'}`}>
                <span className={`text-sm font-semibold ${day.isToday ? '' : ''}`}>
                  {day.label}
                  {day.isToday && <span className="ml-2 text-xs opacity-75">Today</span>}
                </span>
                <button onClick={() => openCreate(day.dow)}
                  className={`p-1 rounded hover:bg-white/20 transition-colors ${day.isToday ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  title={`Add slot on ${day.label}`}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Slots */}
              <div className="flex-1 p-2 space-y-2 min-h-[80px]">
                {day.slots.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4 opacity-50">No classes</p>
                ) : (
                  day.slots.map(slot => (
                    <div key={slot.slot_id}
                      className={`border rounded-md px-2.5 py-2 text-xs space-y-0.5 ${slotColor(slot.subject_id)} ${!slot.active ? 'opacity-40' : ''}`}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold leading-tight truncate">{slot.subject_name}</p>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <button onClick={() => openEdit(slot)} className="p-0.5 rounded hover:bg-black/10" title="Edit">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDelete(slot)} className="p-0.5 rounded hover:bg-black/10" title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-[11px] opacity-90">
                        <Clock className="h-3 w-3 inline text-primary/80 shrink-0" />
                        <span>{format12Hour(slot.start_time)} – {format12Hour(slot.end_time)}</span>
                      </div>
                      <p className="opacity-70 truncate">{slot.batch_name}</p>
                      {slot.faculty_name && <p className="opacity-60 truncate">{slot.faculty_name}</p>}
                      {slot.room && <p className="opacity-60">📍 {slot.room}</p>}
                      {!slot.active && (
                        <button onClick={() => handleToggleActive(slot)}
                          className="text-[10px] underline opacity-70">Activate</button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Day footer — total count */}
              <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground text-right">
                {day.slots.length} slot{day.slots.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 <strong>Generate Today's Sessions</strong> reads today's ({DAYS[todayDow]}) timetable and creates attendance sessions for all slots. Already-existing sessions are skipped.
      </p>
    </div>
  )
}
