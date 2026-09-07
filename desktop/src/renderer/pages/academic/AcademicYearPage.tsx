import { useState, useEffect } from 'react'
import { Plus, Pencil, CalendarDays, Star } from 'lucide-react'
import type { AcademicYear, CreateAcademicYearInput } from '@main/ipc/types'

export default function AcademicYearPage() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)
  const [form, setForm] = useState({ year_label: '', start_date: '', end_date: '', is_current: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try { setYears(await window.api.academicYear.list()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ year_label: '', start_date: '', end_date: '', is_current: false })
    setError(''); setShowForm(true)
  }

  const openEdit = (y: AcademicYear) => {
    setEditing(y)
    setForm({ year_label: y.year_label, start_date: y.start_date, end_date: y.end_date, is_current: !!y.is_current })
    setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.year_label.trim()) { setError('Year label is required'); return }
    if (!form.start_date || !form.end_date) { setError('Start and end dates are required'); return }
    setSaving(true)
    try {
      if (editing) {
        await window.api.academicYear.update(editing.academic_year_id, {
          year_label: form.year_label, start_date: form.start_date,
          end_date: form.end_date, is_current: form.is_current,
        })
      } else {
        const input: CreateAcademicYearInput = {
          year_label: form.year_label, start_date: form.start_date,
          end_date: form.end_date, is_current: form.is_current,
        }
        await window.api.academicYear.create(input)
      }
      setShowForm(false); await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Academic Years</h1>
          <p className="text-muted-foreground text-sm">Manage academic years and semesters</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Year
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">{editing ? 'Edit Academic Year' : 'New Academic Year'}</h2>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Year Label *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.year_label} onChange={e => setForm(f => ({ ...f, year_label: e.target.value }))}
                placeholder="e.g. 2024–25" />
            </div>
            <div>
              <label className="text-sm font-medium">Start Date *</label>
              <input type="date" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">End Date *</label>
              <input type="date" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_current}
              onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} />
            Mark as current academic year
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : years.length === 0 ? (
          <div className="p-8 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">No academic years yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Year</th>
                <th className="text-left px-4 py-3 font-medium">Start</th>
                <th className="text-left px-4 py-3 font-medium">End</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {years.map((y, i) => (
                <tr key={y.academic_year_id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    {y.is_current && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                    {y.year_label}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{y.start_date}</td>
                  <td className="px-4 py-3 text-muted-foreground">{y.end_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${y.is_current ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {y.is_current ? 'Current' : 'Past'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(y)} className="p-1.5 rounded hover:bg-muted" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
