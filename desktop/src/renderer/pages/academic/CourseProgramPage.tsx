import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, GraduationCap, Check, X } from 'lucide-react'
import type { CourseProgram, Department, CreateCourseProgramInput, AcademicStructureType } from '@main/ipc/types'

const STRUCTURE_TYPES: AcademicStructureType[] = ['SEMESTER', 'YEAR', 'TERM', 'CUSTOM']

export default function CourseProgramPage() {
  const [programs, setPrograms] = useState<CourseProgram[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CourseProgram | null>(null)
  const [form, setForm] = useState({
    program_name: '', program_code: '', duration_years: 3,
    academic_structure_type: 'SEMESTER' as AcademicStructureType, department_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [p, d] = await Promise.all([window.api.courseProgram.list(), window.api.department.list()])
      setPrograms(p); setDepartments(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ program_name: '', program_code: '', duration_years: 5, academic_structure_type: 'YEAR', department_id: '' })
    setError(''); setShowForm(true)
  }

  const openEdit = (p: CourseProgram) => {
    setEditing(p)
    setForm({
      program_name: p.program_name, program_code: p.program_code,
      duration_years: p.duration_years, academic_structure_type: p.academic_structure_type,
      department_id: p.department_id ?? '',
    })
    setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.program_name.trim()) { setError('Program name is required'); return }
    if (!form.program_code.trim()) { setError('Program code is required'); return }
    setSaving(true)
    try {
      if (editing) {
        await window.api.courseProgram.update(editing.program_id, {
          program_name: form.program_name.trim(), program_code: form.program_code.trim(),
          duration_years: form.duration_years, academic_structure_type: form.academic_structure_type,
          department_id: form.department_id ? form.department_id : null,
        })
      } else {
        const input: CreateCourseProgramInput = {
          program_name: form.program_name.trim(), program_code: form.program_code.trim(),
          duration_years: form.duration_years, academic_structure_type: form.academic_structure_type,
          department_id: form.department_id ? form.department_id : undefined,
        }
        await window.api.courseProgram.create(input)
      }
      setShowForm(false); await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (p: CourseProgram) => {
    if (!confirm(`Delete program "${p.program_name}"?`)) return
    try { await window.api.courseProgram.delete(p.program_id); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed') }
  }

  const handleToggleActive = async (p: CourseProgram) => {
    try { await window.api.courseProgram.update(p.program_id, { active: !p.active }); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Update failed') }
  }

  const deptName = (id: string | null) => departments.find(d => d.department_id === id)?.department_name ?? 'Multi-Department'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-muted-foreground text-sm">Manage courses and academic programs</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Add Program
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">{editing ? 'Edit Program' : 'New Program'}</h2>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Program Name *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.program_name} onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))}
                placeholder="e.g. Bachelor of Science" />
            </div>
            <div>
              <label className="text-sm font-medium">Code *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.program_code} onChange={e => setForm(f => ({ ...f, program_code: e.target.value }))}
                placeholder="e.g. BSC" />
            </div>
            <div>
              <label className="text-sm font-medium">Duration (years)</label>
              <input type="number" min={1} max={10} className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.duration_years} onChange={e => setForm(f => ({ ...f, duration_years: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Academic Structure Type</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background font-medium"
                value={form.academic_structure_type} onChange={e => setForm(f => ({ ...f, academic_structure_type: e.target.value as AcademicStructureType }))}>
                <option value="YEAR">YEAR (Annual / Professional Years — e.g. MBBS 1st, 2nd, 3rd, 4th Year)</option>
                <option value="SEMESTER">SEMESTER (Standard Semesters — e.g. B.Tech / BE / BCA)</option>
                <option value="TERM">TERM (Trimesters / Terms)</option>
                <option value="CUSTOM">CUSTOM (Flexible structure)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Department</span>
                <span className="text-xs text-muted-foreground font-normal">Optional</span>
              </label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                <option value="">— None / Multi-Department (e.g. MBBS) —</option>
                {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Leave unselected for MBBS or multi-department courses. Departments connect naturally at the Subject & Faculty level.
              </p>
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
        ) : programs.length === 0 ? (
          <div className="p-8 text-center">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">No programs yet. Add your first program.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Program</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Duration</th>
                <th className="text-left px-4 py-3 font-medium">Structure</th>
                <th className="text-left px-4 py-3 font-medium">Department</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {programs.map((p, i) => (
                <tr key={p.program_id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                  <td className="px-4 py-3 font-medium">{p.program_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.program_code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.duration_years}y</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.academic_structure_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{deptName(p.department_id)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleActive(p)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {p.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
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
