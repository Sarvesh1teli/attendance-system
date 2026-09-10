import { useState, useEffect } from 'react'
import { Plus, Pencil, Users2, Check, X, Bell, BellOff, Search, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import type { Batch, CourseProgram, Department, CreateBatchInput } from '@main/ipc/types'

export default function BatchPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [programs, setPrograms] = useState<CourseProgram[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Batch | null>(null)
  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [form, setForm] = useState({
    batch_name: '', program_id: '', department_id: '',
    admission_year: new Date().getFullYear(),
    expected_completion_year: new Date().getFullYear() + 3,
    notify_parents: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [b, p, d] = await Promise.all([
        window.api.batch.list(), window.api.courseProgram.list(), window.api.department.list(),
      ])
      setBatches(b); setPrograms(p); setDepartments(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({
      batch_name: '', program_id: programs[0]?.program_id ?? '', department_id: '',
      admission_year: new Date().getFullYear(),
      expected_completion_year: new Date().getFullYear() + 3,
      notify_parents: true,
    })
    setError(''); setShowForm(true)
  }

  const openEdit = (b: Batch) => {
    setEditing(b)
    setForm({
      batch_name: b.batch_name, program_id: b.program_id, department_id: b.department_id ?? '',
      admission_year: b.admission_year, expected_completion_year: b.expected_completion_year,
      notify_parents: b.notify_parents,
    })
    setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.batch_name.trim()) { setError('Batch name is required'); return }
    if (!form.program_id) { setError('Program is required'); return }
    setSaving(true)
    try {
      if (editing) {
        const batchId = (editing as any).batch_id || (editing as any).id
        await window.api.batch.update(batchId, {
          batch_name: form.batch_name.trim(), program_id: form.program_id,
          department_id: form.department_id ? form.department_id : null,
          admission_year: form.admission_year,
          expected_completion_year: form.expected_completion_year,
          notify_parents: form.notify_parents,
        })
      } else {
        const input: CreateBatchInput = {
          batch_name: form.batch_name.trim(), program_id: form.program_id,
          department_id: form.department_id ? form.department_id : undefined,
          admission_year: form.admission_year,
          expected_completion_year: form.expected_completion_year,
          notify_parents: form.notify_parents,
        }
        await window.api.batch.create(input)
      }
      setShowForm(false); await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const handleToggleActive = async (b: Batch) => {
    try {
      const bid = (b as any).batch_id || (b as any).id
      const nextActive = b.active === false ? true : false
      await window.api.batch.update(bid, { ...b, active: nextActive }); await load()
    }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Update failed') }
  }

  const handleToggleNotifyParents = async (b: Batch) => {
    try {
      const bid = (b as any).batch_id || (b as any).id
      await window.api.batch.update(bid, { notify_parents: !b.notify_parents }); await load()
    }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Update failed') }
  }

  const progName = (id: string) => programs.find(p => p.program_id === id)?.program_name ?? id
  const deptName = (id: string | null) => departments.find(d => d.department_id === id)?.department_name ?? 'Multi-Department'

  const yearOptions = Array.from(
    new Set(batches.flatMap(b => [b.admission_year, b.expected_completion_year]))
  ).filter(Boolean).sort((a, b) => b - a)

  const filteredBatches = batches.filter(b => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || b.batch_name.toLowerCase().includes(q) || progName(b.program_id).toLowerCase().includes(q)
    const matchYear = !filterYear || String(b.admission_year) === filterYear || String(b.expected_completion_year) === filterYear
    return matchSearch && matchYear
  })

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / pageSize))
  const paginatedBatches = filteredBatches.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-6">
      {/* Filter Bar and Add Batch in same row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-background"
              placeholder="Search by batch name or program..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={filterYear}
            onChange={(e) => { setFilterYear(e.target.value); setPage(1) }}
          >
            <option value="">All Years</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          {(search || filterYear) && (
            <button
              onClick={() => { setSearch(''); setFilterYear(''); setPage(1) }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 whitespace-nowrap">
          <Plus className="h-4 w-4" /> Add Batch
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">{editing ? 'Edit Batch' : 'New Batch'}</h2>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Batch Name *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.batch_name} onChange={e => setForm(f => ({ ...f, batch_name: e.target.value }))}
                placeholder="e.g. 2024–27 Batch A" />
            </div>
            <div>
              <label className="text-sm font-medium">Program *</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.program_id} onChange={e => setForm(f => ({ ...f, program_id: e.target.value }))}>
                <option value="">— Select —</option>
                {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Department</span>
                <span className="text-xs font-normal text-muted-foreground">Optional</span>
              </label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                <option value="">— None / Multi-Department (e.g. MBBS) —</option>
                {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Optional for interdepartmental cohorts like MBBS batches.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Admission Year</label>
                <input type="number" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.admission_year} onChange={e => setForm(f => ({ ...f, admission_year: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Completion Year</label>
                <input type="number" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.expected_completion_year} onChange={e => setForm(f => ({ ...f, expected_completion_year: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="sm:col-span-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Parent SMS / Email Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Send automated absence notifications to parents of students in this batch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, notify_parents: !f.notify_parents }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.notify_parents ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.notify_parents ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
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
        ) : filteredBatches.length === 0 ? (
          <div className="p-8 text-center">
            <Users2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              {search || filterYear ? 'No batches match the filters.' : 'No batches yet. Add your first batch.'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Batch</th>
                  <th className="text-left px-4 py-3 font-medium">Program</th>
                  <th className="text-left px-4 py-3 font-medium">Department</th>
                  <th className="text-left px-4 py-3 font-medium">Admission</th>
                  <th className="text-left px-4 py-3 font-medium">Completion</th>
                  <th className="text-left px-4 py-3 font-medium">Parent Alerts</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginatedBatches.map((b, i) => (
                  <tr key={b.batch_id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                    <td className="px-4 py-3 font-medium">{b.batch_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{progName(b.program_id)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{deptName(b.department_id)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.admission_year}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.expected_completion_year}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleNotifyParents(b)}
                        title={b.notify_parents ? 'Click to disable parent alerts' : 'Click to enable parent alerts'}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                          b.notify_parents
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}>
                        {b.notify_parents
                          ? <><Bell className="h-3 w-3" /> Enabled</>
                          : <><BellOff className="h-3 w-3" /> Disabled</>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleActive(b)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${b.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {b.active !== false ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {b.active !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(b)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredBatches.length)} of {filteredBatches.length} batches
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded border text-xs disabled:opacity-40 hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-xs font-medium">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded border text-xs disabled:opacity-40 hover:bg-muted"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        💡 <strong>Tip:</strong> Disable "Parent Alerts" for adult programs like MBBS, BE, MCA where parent notifications are not required.
      </p>
    </div>
  )
}
