import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Building2, Check, X, Search, Filter, AlertTriangle } from 'lucide-react'
import type { Department, CreateDepartmentInput } from '@main/ipc/types'

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({ department_name: '', department_code: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Filter & Search states
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [sortBy, setSortBy] = useState<'NAME_ASC' | 'NAME_DESC' | 'CODE_ASC'>('NAME_ASC')

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await window.api.department.list()
      setDepartments(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ department_name: '', department_code: '' })
    setError('')
    setShowForm(true)
  }

  const openEdit = (d: Department) => {
    setEditing(d)
    setForm({ department_name: d.department_name, department_code: d.department_code ?? '' })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.department_name.trim()) { setError('Department name is required'); return }
    setSaving(true)
    try {
      if (editing) {
        await window.api.department.update(editing.department_id, {
          department_name: form.department_name.trim(),
          department_code: form.department_code.trim() || undefined,
        })
      } else {
        const input: CreateDepartmentInput = {
          department_name: form.department_name.trim(),
          department_code: form.department_code.trim() || undefined,
        }
        await window.api.department.create(input)
      }
      setShowForm(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (d: Department) => {
    setDeleteTarget(d)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await window.api.department.delete(deleteTarget.department_id)
      setDeleteTarget(null)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (d: Department) => {
    try {
      const nextActive = d.active === false ? true : false
      await window.api.department.update(d.department_id, { ...d, active: nextActive })
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed')
    }
  }

  // Filtering & Sorting
  const filteredDepartments = departments
    .filter((d) => {
      // 1. Search by name or code
      const matchesSearch =
        !search ||
        d.department_name.toLowerCase().includes(search.toLowerCase()) ||
        (d.department_code && d.department_code.toLowerCase().includes(search.toLowerCase()))
      // 2. Status filter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && d.active !== false) ||
        (statusFilter === 'INACTIVE' && d.active === false)
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === 'NAME_ASC') return a.department_name.localeCompare(b.department_name)
      if (sortBy === 'NAME_DESC') return b.department_name.localeCompare(a.department_name)
      if (sortBy === 'CODE_ASC') return (a.department_code || '').localeCompare(b.department_code || '')
      return 0
    })

  const activeCount = departments.filter((d) => d.active !== false).length
  const inactiveCount = departments.length - activeCount
  const hasActiveFilters = search !== '' || statusFilter !== 'ALL' || sortBy !== 'NAME_ASC'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground text-sm">Manage institution departments</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Department
        </button>
      </div>

      {/* Metrics Badges */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted border text-foreground">
          Total: {departments.length}
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-700 border border-green-500/20">
          Active: {activeCount}
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-600 border border-gray-500/20">
          Inactive: {inactiveCount}
        </span>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full border rounded-md pl-9 pr-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search by department name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            className="border rounded-md px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        <select
          className="border rounded-md px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="NAME_ASC">Sort: Name (A to Z)</option>
          <option value="NAME_DESC">Sort: Name (Z to A)</option>
          <option value="CODE_ASC">Sort: Code (A to Z)</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatusFilter('ALL')
              setSortBy('NAME_ASC')
            }}
            className="text-xs text-primary hover:underline font-medium px-1"
          >
            Clear Filters
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4 shadow-sm animate-in fade-in-50">
          <h2 className="font-semibold text-base">{editing ? 'Edit Department' : 'New Department'}</h2>
          {error && <p className="text-destructive text-sm bg-destructive/10 p-2 rounded">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Department Name *</label>
              <input
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.department_name}
                onChange={(e) => setForm((f) => ({ ...f, department_name: e.target.value }))}
                placeholder="e.g. Computer Science"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Department Code</label>
              <input
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.department_code}
                onChange={(e) => setForm((f) => ({ ...f, department_code: e.target.value }))}
                placeholder="e.g. CS"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filteredDepartments.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              {departments.length === 0
                ? 'No departments yet. Add your first department.'
                : 'No departments match your filter criteria.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDepartments.map((d, i) => (
                <tr
                  key={d.department_id}
                  className={`hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{d.department_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.department_code ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(d)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                        d.active !== false ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title="Click to toggle status"
                    >
                      {d.active !== false ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {d.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(d)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Total: {filteredDepartments.length} departments{' '}
        {filteredDepartments.length !== departments.length ? `(filtered from ${departments.length})` : ''}
      </p>

      {/* ─── CONFIRM DELETE POPUP MODAL ─────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Confirm Department Deletion</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to delete <strong className="text-foreground">{deleteTarget.department_name}</strong>
                  {deleteTarget.department_code ? ` (${deleteTarget.department_code})` : ''}?
                </p>
              </div>
            </div>

            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-xs text-destructive space-y-1">
              <p className="font-semibold">Warning: This action cannot be undone.</p>
              <p>Deleting this department will detach it from any linked programs, faculty, and student records.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting…' : 'Delete Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
