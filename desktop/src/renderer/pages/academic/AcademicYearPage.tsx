import { useState, useEffect } from 'react'
import { Plus, Pencil, CalendarDays, Star, Search, RotateCcw } from 'lucide-react'
import type { AcademicYear, CreateAcademicYearInput } from '@main/ipc/types'

export default function AcademicYearPage() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)
  const [search, setSearch] = useState('')
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

  const [filterYear, setFilterYear] = useState('')

  const yearOptions = Array.from(
    new Set(
      years.flatMap((y) => {
        const matches = y.year_label.match(/\d{4}/g)
        return matches || []
      })
    )
  ).sort()

  const filteredYears = years.filter(y => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || y.year_label.toLowerCase().includes(q) || y.start_date.includes(q) || y.end_date.includes(q)
    const matchYear = !filterYear || y.year_label.includes(filterYear)
    return matchSearch && matchYear
  })

  return (
    <div className="space-y-6">
      {/* Search, Year Filter, and Add Year in same row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-background"
              placeholder="Search academic year (e.g. 2026)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            <option value="">All Years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {(search || filterYear) && (
            <button
              onClick={() => { setSearch(''); setFilterYear('') }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 whitespace-nowrap"
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
        ) : filteredYears.length === 0 ? (
          <div className="p-8 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              {search ? 'No academic years match your filter.' : 'No academic years yet.'}
            </p>
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
              {filteredYears.map((y, i) => (
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
