import { useState, useEffect } from 'react'
import { Plus, Pencil, GraduationCap, Search, KeyRound, UserCheck, ShieldCheck } from 'lucide-react'
import type { Faculty, Department, CreateFacultyInput, Gender, FacultyStatus, AppUser } from '@main/ipc/types'

const STATUS_COLORS: Record<FacultyStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  LEFT: 'bg-red-100 text-red-600',
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Faculty | null>(null)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [form, setForm] = useState<{
    employee_id: string; name: string; gender: string; designation: string;
    department_id: string; phone: string; email: string; joining_date: string; status: FacultyStatus;
    username: string; password: string
  }>({
    employee_id: '', name: '', gender: '', designation: '', department_id: '',
    phone: '', email: '', joining_date: '', status: 'ACTIVE', username: '', password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [f, d, u] = await Promise.all([
        window.api.faculty.list(filterDept ? { department_id: filterDept } : undefined),
        window.api.department.list(),
        window.api.appUser.list(),
      ])
      setFaculty(f); setDepartments(d); setUsers(u)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterDept])

  const filtered = faculty.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.employee_id.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditing(null)
    setForm({
      employee_id: '', name: '', gender: '', designation: '', department_id: '',
      phone: '', email: '', joining_date: '', status: 'ACTIVE', username: '', password: '',
    })
    setError(''); setShowForm(true)
  }

  const openEdit = (f: Faculty) => {
    setEditing(f)
    const existingUser = users.find(u => u.faculty_id === f.faculty_id)
    setForm({
      employee_id: f.employee_id, name: f.name, gender: f.gender ?? '', designation: f.designation ?? '',
      department_id: f.department_id ?? '', phone: f.phone ?? '', email: f.email ?? '',
      joining_date: f.joining_date ?? '', status: f.status,
      username: existingUser?.username ?? f.employee_id,
      password: '',
    })
    setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.employee_id.trim()) { setError('Employee ID is required'); return }
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      if (editing) {
        await window.api.faculty.update(editing.faculty_id, {
          name: form.name, gender: (form.gender as Gender) || undefined,
          designation: form.designation || undefined, department_id: form.department_id || undefined,
          phone: form.phone || undefined, email: form.email || undefined,
          joining_date: form.joining_date || undefined, status: form.status,
        })

        if (form.username.trim()) {
          const existingUser = users.find(u => u.faculty_id === editing.faculty_id)
          if (existingUser) {
            await window.api.appUser.update(existingUser.user_id, {
              username: form.username.trim(),
              new_password: form.password.trim() ? form.password.trim() : undefined,
            })
          } else if (form.password.trim()) {
            await window.api.appUser.create({
              faculty_id: editing.faculty_id,
              username: form.username.trim(),
              password: form.password.trim(),
              role: 'FACULTY',
            })
          }
        }
      } else {
        const input: CreateFacultyInput = {
          employee_id: form.employee_id, name: form.name,
          gender: (form.gender as Gender) || undefined, designation: form.designation || undefined,
          department_id: form.department_id || undefined, phone: form.phone || undefined,
          email: form.email || undefined, joining_date: form.joining_date || undefined,
        }
        const created = await window.api.faculty.create(input)

        const finalUsername = form.username.trim() || form.employee_id.trim()
        const finalPassword = form.password.trim() || 'teacher123'
        if (finalUsername && finalPassword) {
          try {
            await window.api.appUser.create({
              faculty_id: created.faculty_id,
              username: finalUsername,
              password: finalPassword,
              role: 'FACULTY',
            })
          } catch (userErr) {
            console.warn('Could not auto-create app user:', userErr)
          }
        }
      }
      setShowForm(false); await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const deptName = (id: string | null) => departments.find(d => d.department_id === id)?.department_name ?? '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Faculty</h1>
          <p className="text-muted-foreground text-sm">Manage faculty members and assignments</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Add Faculty
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-background"
            placeholder="Search name or employee ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">{editing ? 'Edit Faculty' : 'New Faculty'}</h2>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Employee ID *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.employee_id} disabled={!!editing}
                onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} placeholder="e.g. EMP001" />
            </div>
            <div>
              <label className="text-sm font-medium">Full Name *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Jane Smith" />
            </div>
            <div>
              <label className="text-sm font-medium">Gender</label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Designation</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Professor" />
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
              <label className="text-sm font-medium">Joining Date</label>
              <input type="date" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            {editing && (
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as FacultyStatus }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="LEFT">Left</option>
                </select>
              </div>
            )}

            <div className="col-span-1 sm:col-span-2 border-t pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Teacher Mobile App / Portal Login</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Login Username</label>
                  <input
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder={form.employee_id || 'e.g. FAC001'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Username to sign in to Teacher PWA</p>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {editing ? 'New Password (blank to keep unchanged)' : 'Login Password'}
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editing ? '••••••••' : 'Default: teacher123'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Password for this faculty account</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Faculty'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">{faculty.length === 0 ? 'No faculty yet.' : 'No results match your search.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Emp ID</th>
                <th className="text-left px-4 py-3 font-medium">Designation</th>
                <th className="text-left px-4 py-3 font-medium">Department</th>
                <th className="text-left px-4 py-3 font-medium">Teacher App Login</th>
                <th className="text-left px-4 py-3 font-medium">Face</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const user = users.find(u => u.faculty_id === f.faculty_id)
                return (
                  <tr key={f.faculty_id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.employee_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.designation ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{deptName(f.department_id)}</td>
                    <td className="px-4 py-3">
                      {user ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <UserCheck className="h-3 w-3" />
                          <span>{user.username}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground bg-muted">
                          Emp ID: {f.employee_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${f.face_enrolled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        {f.face_enrolled ? 'Enrolled' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[f.status]}`}>{f.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(f)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Total: {filtered.length} faculty members {filtered.length !== faculty.length ? `(filtered from ${faculty.length})` : ''}
      </p>
    </div>
  )
}
