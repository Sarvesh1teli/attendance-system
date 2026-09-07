import { useState, useEffect } from 'react'
import { Plus, Pencil, Users2, Check, X, Bell, BellOff } from 'lucide-react'
import type { Batch, CourseProgram, Department, CreateBatchInput } from '@main/ipc/types'

export default function BatchPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [programs, setPrograms] = useState<CourseProgram[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Batch | null>(null)
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
        await window.api.batch.update(editing.batch_id, {
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
    try { await window.api.batch.update(b.batch_id, { active: !b.active }); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Update failed') }
  }

  const handleToggleNotifyParents = async (b: Batch) => {
    try { await window.api.batch.update(b.batch_id, { notify_parents: !b.notify_parents }); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Update failed') }
  }

  const progName = (id: string) => programs.find(p => p.program_id === id)?.program_name ?? id
  const deptName = (id: string | null) => departments.find(d => d.department_id === id)?.department_name ?? 'Multi-Department'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Batches</h1>
          <p className="text-muted-foreground text-sm">Manage student batches and cohorts</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
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

            {/* Parent Notification Toggle */}
            <div className="sm:col-span-2">
              <div className="flex items-start gap-3 border rounded-lg p-4 bg-muted/20">
                <div className="flex-1">
                  <label className="text-sm font-semibold flex items-center gap-2 cursor-pointer select-none"
                    htmlFor="notify_parents_toggle">
                    {form.notify_parents
                      ? <Bell className="h-4 w-4 text-blue-500" />
                      : <BellOff className="h-4 w-4 text-muted-foreground" />}
                    Send Parent Shortage Alerts
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.notify_parents
                      ? 'Parents/guardians will be notified when a student falls below the attendance threshold.'
                      : 'Disabled — suitable for adult programs (MBBS, BE, MCA, etc.) where parent alerts are not required.'}
                  </p>
                </div>
                <button
                  id="notify_parents_toggle"
                  type="button"
                  onClick={() => setForm(f => ({ ...f, notify_parents: !f.notify_parents }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                    form.notify_parents ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
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
        ) : batches.length === 0 ? (
          <div className="p-8 text-center">
            <Users2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">No batches yet. Add your first batch.</p>
          </div>
        ) : (
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
              {batches.map((b, i) => (
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
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {b.active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {b.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(b)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        💡 <strong>Tip:</strong> Disable "Parent Alerts" for adult programs like MBBS, BE, MCA where parent notifications are not required.
      </p>
    </div>
  )
}
