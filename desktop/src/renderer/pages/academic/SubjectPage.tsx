import { useState, useEffect } from 'react'
import { Plus, Pencil, BookOpen, Check, X, Search, RotateCcw } from 'lucide-react'
import type { Subject, Department, CourseProgram, CreateSubjectInput, SubjectType } from '@main/ipc/types'

const SUBJECT_TYPES: SubjectType[] = ['THEORY', 'PRACTICAL', 'CLINICAL', 'SEMINAR', 'LABORATORY', 'PROJECT', 'OTHER']

export default function SubjectPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<CourseProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [filterDept, setFilterDept] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    subject_name: '', subject_code: '', subject_type: 'THEORY' as SubjectType,
    department_id: '', program_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [s, d, p] = await Promise.all([
        window.api.subject.list(filterDept ? { department_id: filterDept } : undefined),
        window.api.department.list(), window.api.courseProgram.list(),
      ])
      setSubjects(s); setDepartments(d); setPrograms(p)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterDept])

  const openCreate = () => {
    setEditing(null)
    setForm({ subject_name: '', subject_code: '', subject_type: 'THEORY', department_id: '', program_id: '' })
    setError(''); setShowForm(true)
  }

  const openEdit = (s: Subject) => {
    setEditing(s)
    setForm({
      subject_name: s.subject_name, subject_code: s.subject_code,
      subject_type: s.subject_type, department_id: s.department_id ?? '', program_id: s.program_id ?? '',
    })
    setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.subject_name.trim()) { setError('Subject name is required'); return }
    if (!form.subject_code.trim()) { setError('Subject code is required'); return }
    setSaving(true)
    try {
      if (editing) {
        await window.api.subject.update(editing.subject_id, {
          subject_name: form.subject_name, subject_code: form.subject_code,
          subject_type: form.subject_type,
          department_id: form.department_id || undefined, program_id: form.program_id || undefined,
        })
      } else {
        const input: CreateSubjectInput = {
          subject_name: form.subject_name, subject_code: form.subject_code,
          subject_type: form.subject_type,
          department_id: form.department_id || undefined, program_id: form.program_id || undefined,
        }
        await window.api.subject.create(input)
      }
      setShowForm(false); await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const handleToggleActive = async (s: Subject) => {
    try {
      const nextActive = s.active === false ? true : false
      await window.api.subject.update(s.subject_id, { ...s, active: nextActive })
      await load()
    }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Update failed') }
  }

  const deptName = (id: string | null) => departments.find(d => d.department_id === id)?.department_name ?? '—'

  const filteredSubjects = subjects.filter(s => {
    const q = search.trim().toLowerCase()
    return !q || s.subject_name.toLowerCase().includes(q) || s.subject_code.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Search, Department Filter, and Add Subject in same row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-background"
              placeholder="Search subject by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.department_id} value={d.department_id}>
                {d.department_name}
              </option>
            ))}
          </select>

          {(search || filterDept) && (
            <button
              onClick={() => { setSearch(''); setFilterDept('') }}
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
          <Plus className="h-4 w-4" /> Add Subject
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">{editing ? 'Edit Subject' : 'New Subject'}</h2>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Subject Name *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))}
                placeholder="e.g. Human Anatomy" />
            </div>
            <div>
              <label className="text-sm font-medium">Subject Code *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.subject_code} onChange={e => setForm(f => ({ ...f, subject_code: e.target.value }))}
                placeholder="e.g. ANT101" />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.subject_type} onChange={e => setForm(f => ({ ...f, subject_type: e.target.value as SubjectType }))}>
                {SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Department</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Program</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.program_id} onChange={e => setForm(f => ({ ...f, program_id: e.target.value }))}>
                <option value="">— None —</option>
                {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
              </select>
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
        ) : subjects.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">No subjects yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Subject</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Department</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.map((s, i) => (
                <tr key={s.subject_id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                  <td className="px-4 py-3 font-medium">{s.subject_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.subject_code}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-muted px-2 py-1 rounded">{s.subject_type}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{deptName(s.department_id)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleActive(s)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${s.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.active !== false ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {s.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
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
