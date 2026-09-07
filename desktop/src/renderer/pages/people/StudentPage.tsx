import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Search,
  Filter,
  RotateCcw,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Phone,
  User,
  Calendar,
  BookOpen,
  Building2,
  Hash,
  GraduationCap,
  CheckCircle2,
  ArrowLeft,
  Check,
  ShieldAlert,
} from 'lucide-react'
import type {
  Student,
  Batch,
  CourseProgram,
  Department,
  CreateStudentInput,
  StudentStatus,
  Gender,
} from '@main/ipc/types'

const STATUS_COLORS: Record<StudentStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
  FAILED: 'bg-rose-100 text-rose-700 border-rose-200',
  REPEATER: 'bg-amber-100 text-amber-700 border-amber-200',
  DETAINED: 'bg-orange-100 text-orange-700 border-orange-200',
  LEFT: 'bg-red-100 text-red-600 border-red-200',
  DISCONTINUED: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  TRANSFERRED: 'bg-purple-100 text-purple-700 border-purple-200',
  COMPLETED: 'bg-blue-100 text-blue-700 border-blue-200',
}

export default function StudentPage() {
  // Navigation Menu: 'list' | 'add'
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list')

  // Master Data
  const [students, setStudents] = useState<Student[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [programs, setPrograms] = useState<CourseProgram[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const [filterProgram, setFilterProgram] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterFaceStatus, setFilterFaceStatus] = useState<'ALL' | 'ENROLLED' | 'PENDING'>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  // Editing state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  // Modals: View & Delete
  const [viewStudent, setViewStudent] = useState<Student | null>(null)
  const [deleteStudentTarget, setDeleteStudentTarget] = useState<Student | null>(null)
  const [actionOpenId, setActionOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Form State
  const [form, setForm] = useState({
    name: '',
    gender: '' as Gender | '',
    date_of_birth: '',
    phone: '',
    parent_phone: '',
    admission_number: '',
    batch_id: '',
    program_id: '',
    department_id: '',
    admission_date: new Date().toISOString().slice(0, 10),
    admission_type: 'NEW' as NonNullable<CreateStudentInput['admission_type']>,
    current_status: 'ACTIVE' as StudentStatus,
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Load Data
  const loadData = async () => {
    setLoading(true)
    try {
      const [sRes, bRes, pRes, dRes] = await Promise.allSettled([
        window.api.student.list(),
        window.api.batch.list(),
        window.api.courseProgram.list(),
        window.api.department.list(),
      ])

      if (sRes.status === 'fulfilled') setStudents(sRes.value)
      if (bRes.status === 'fulfilled') setBatches(bRes.value)
      if (pRes.status === 'fulfilled') setPrograms(pRes.value)
      if (dRes.status === 'fulfilled') setDepartments(dRes.value)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Close actions dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // 1. Text Search (name, admission no, phone)
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const nameMatch = s.name?.toLowerCase().includes(q)
        const admMatch = s.admission_number?.toLowerCase().includes(q)
        const phoneMatch = s.phone?.includes(q) || s.parent_phone?.includes(q)
        if (!nameMatch && !admMatch && !phoneMatch) return false
      }

      // 2. Batch Filter
      if (filterBatch && s.batch_id !== filterBatch) {
        return false
      }

      // 3. Program Filter
      if (filterProgram) {
        const batch = batches.find((b) => b.batch_id === s.batch_id)
        if (s.program_id && s.program_id !== filterProgram) return false
        if (batch && batch.program_id !== filterProgram) return false
      }

      // 4. Department Filter
      if (filterDepartment) {
        const batch = batches.find((b) => b.batch_id === s.batch_id)
        const deptId = s.department_id || batch?.department_id
        if (deptId !== filterDepartment) return false
      }

      // 5. Face Status Filter
      if (filterFaceStatus === 'ENROLLED' && !s.face_enrolled) return false
      if (filterFaceStatus === 'PENDING' && s.face_enrolled) return false

      // 6. Academic Status Filter
      if (filterStatus !== 'ALL' && s.current_status !== filterStatus) return false

      return true
    })
  }, [students, batches, search, filterBatch, filterProgram, filterDepartment, filterFaceStatus, filterStatus])

  const hasActiveFilters = Boolean(
    search.trim() ||
      filterBatch ||
      filterProgram ||
      filterDepartment ||
      filterFaceStatus !== 'ALL' ||
      filterStatus !== 'ALL'
  )

  const clearFilters = () => {
    setSearch('')
    setFilterBatch('')
    setFilterProgram('')
    setFilterDepartment('')
    setFilterFaceStatus('ALL')
    setFilterStatus('ALL')
  }

  // Switch to Add Form
  const handleOpenCreate = () => {
    setEditingStudent(null)
    setForm({
      name: '',
      gender: '',
      date_of_birth: '',
      phone: '',
      parent_phone: '',
      admission_number: '',
      batch_id: batches[0]?.batch_id ?? '',
      program_id: programs[0]?.program_id ?? '',
      department_id: departments[0]?.department_id ?? '',
      admission_date: new Date().toISOString().slice(0, 10),
      admission_type: 'NEW',
      current_status: 'ACTIVE',
    })
    setFormError('')
    setActiveTab('add')
  }

  // Switch to Edit Form
  const handleOpenEdit = (s: Student) => {
    setEditingStudent(s)
    setForm({
      name: s.name,
      gender: (s.gender as Gender) || '',
      date_of_birth: s.date_of_birth || '',
      phone: s.phone || '',
      parent_phone: s.parent_phone || '',
      admission_number: s.admission_number || '',
      batch_id: s.batch_id || '',
      program_id: s.program_id || '',
      department_id: s.department_id || '',
      admission_date: s.admission_date || new Date().toISOString().slice(0, 10),
      admission_type: (s.admission_type as any) || 'NEW',
      current_status: s.current_status,
    })
    setFormError('')
    setActiveTab('add')
  }

  // Save (Create or Update)
  const handleSaveStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Full Name is required')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (editingStudent) {
        await window.api.student.update(editingStudent.student_id, {
          name: form.name.trim(),
          gender: form.gender ? form.gender : undefined,
          date_of_birth: form.date_of_birth || undefined,
          phone: form.phone.trim() || undefined,
          parent_phone: form.parent_phone.trim() || undefined,
          current_status: form.current_status,
        })
        setSuccessBanner(`Student "${form.name.trim()}" updated successfully!`)
      } else {
        if (!form.admission_number.trim()) {
          setFormError('Admission Number is required')
          setSaving(false)
          return
        }
        if (!form.batch_id) {
          setFormError('Please select an Academic Batch')
          setSaving(false)
          return
        }
        if (!form.program_id) {
          setFormError('Please select a Course Program')
          setSaving(false)
          return
        }

        const input: CreateStudentInput = {
          name: form.name.trim(),
          gender: form.gender ? form.gender : undefined,
          date_of_birth: form.date_of_birth || undefined,
          phone: form.phone.trim() || undefined,
          parent_phone: form.parent_phone.trim() || undefined,
          admission_number: form.admission_number.trim(),
          batch_id: form.batch_id,
          program_id: form.program_id,
          department_id: form.department_id || undefined,
          admission_date: form.admission_date,
          admission_type: form.admission_type,
        }

        await window.api.student.create(input)
        setSuccessBanner(`Student "${form.name.trim()}" successfully registered!`)
      }

      await loadData()
      setActiveTab('list')
      setEditingStudent(null)
    } catch (err: any) {
      setFormError(err.message || 'Failed to save student record')
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleConfirmDelete = async () => {
    if (!deleteStudentTarget) return
    setDeleting(true)
    try {
      await window.api.student.delete(deleteStudentTarget.student_id)
      setDeleteStudentTarget(null)
      await loadData()
      setSuccessBanner(`Student record deleted successfully.`)
    } catch (err: any) {
      alert(err.message || 'Failed to delete student')
    } finally {
      setDeleting(false)
    }
  }

  // Metrics
  const totalCount = students.length
  const enrolledCount = students.filter((s) => s.face_enrolled).length
  const activeCount = students.filter((s) => s.current_status === 'ACTIVE').length
  const pendingCount = totalCount - enrolledCount

  const getBatchName = (batchId?: string) => {
    if (!batchId) return '—'
    return batches.find((b) => b.batch_id === batchId)?.batch_name || '—'
  }

  return (
    <div className="space-y-6">
      {/* ─── TOP BAR WITH MAIN TABS MENU ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Students</h1>
          <p className="text-muted-foreground text-sm">
            Manage student enrollment, profiles, and attendance credentials
          </p>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border">
          <button
            type="button"
            onClick={() => {
              setActiveTab('list')
              setEditingStudent(null)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'list'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Student List</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                activeTab === 'list' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'add' && !editingStudent
                ? 'bg-primary text-primary-foreground shadow-sm'
                : activeTab === 'add' && editingStudent
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            {editingStudent ? (
              <>
                <Pencil className="h-4 w-4 text-amber-500" />
                <span>Edit Student</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Add Student</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="p-1 rounded-md hover:bg-emerald-100 text-emerald-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: STUDENT LIST VIEW                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'list' && (
        <div className="space-y-5">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <span className="text-xs font-medium text-muted-foreground">Total Students</span>
              <p className="text-2xl font-bold mt-1 text-foreground">{totalCount}</p>
            </div>
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <span className="text-xs font-medium text-emerald-600">Active Status</span>
              <p className="text-2xl font-bold mt-1 text-foreground">{activeCount}</p>
            </div>
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <span className="text-xs font-medium text-blue-600">Face Enrolled</span>
              <p className="text-2xl font-bold mt-1 text-foreground">{enrolledCount}</p>
            </div>
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <span className="text-xs font-medium text-amber-600">Face Pending</span>
              <p className="text-2xl font-bold mt-1 text-foreground">{pendingCount}</p>
            </div>
          </div>

          {/* Comprehensive Filters Bar */}
          <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2 border-b pb-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Filter className="h-3.5 w-3.5 text-primary" />
                <span>Filter Student Records</span>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-md hover:bg-muted transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* 1. Search Box */}
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, admission no, phone…"
                  className="w-full border rounded-lg pl-9 pr-3 py-2 text-xs bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                />
              </div>

              {/* 2. Program Filter */}
              <div>
                <select
                  value={filterProgram}
                  onChange={(e) => setFilterProgram(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-2 text-xs bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                >
                  <option value="">All Programs ({programs.length})</option>
                  {programs.map((p) => (
                    <option key={p.program_id} value={p.program_id}>
                      {p.program_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Batch Filter */}
              <div>
                <select
                  value={filterBatch}
                  onChange={(e) => setFilterBatch(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-2 text-xs bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                >
                  <option value="">All Batches ({batches.length})</option>
                  {batches.map((b) => (
                    <option key={b.batch_id} value={b.batch_id}>
                      {b.batch_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Department Filter */}
              <div>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-2 text-xs bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                >
                  <option value="">All Depts ({departments.length})</option>
                  {departments.map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Face Status Filter */}
              <div>
                <select
                  value={filterFaceStatus}
                  onChange={(e) => setFilterFaceStatus(e.target.value as any)}
                  className="w-full border rounded-lg px-2.5 py-2 text-xs bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                >
                  <option value="ALL">All Face Status</option>
                  <option value="ENROLLED">Enrolled Only</option>
                  <option value="PENDING">Pending Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div className="bg-card border rounded-xl overflow-visible shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
                <p>Loading student records…</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">No students found</h3>
                  <p className="text-muted-foreground text-xs mt-1">
                    {hasActiveFilters
                      ? 'No students match your filter criteria. Try clearing some filters.'
                      : 'Get started by clicking "+ Add Student" to register your first student record.'}
                  </p>
                </div>
                {hasActiveFilters ? (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
                  </button>
                ) : (
                  <button
                    onClick={handleOpenCreate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:opacity-90"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add Student
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Student Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Admission No
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Batch / Program
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Phone
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Face Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStudents.map((s, i) => (
                    <tr
                      key={s.student_id}
                      className={`hover:bg-muted/30 transition-colors ${
                        i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                      }`}
                    >
                      {/* Name with Avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 uppercase border border-primary/20">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm leading-tight">{s.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {s.gender ? s.gender.toLowerCase() : 'student'}
                              {s.date_of_birth ? ` · DOB: ${s.date_of_birth}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Admission Number */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted font-medium text-foreground">
                          {s.admission_number || '—'}
                        </span>
                      </td>

                      {/* Batch & Program */}
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-foreground">
                          {s.batch_name || getBatchName(s.batch_id)}
                        </p>
                        {s.program_name && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                            {s.program_name}
                          </p>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {s.phone ? (
                          <span className="flex items-center gap-1 text-foreground">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {s.phone}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Face Enrollment */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                            s.face_enrolled
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.face_enrolled ? 'bg-blue-600' : 'bg-amber-500'
                            }`}
                          />
                          {s.face_enrolled ? 'Enrolled' : 'Pending'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                            STATUS_COLORS[s.current_status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {s.current_status}
                        </span>
                      </td>

                      {/* Actions Dropdown */}
                      <td className="px-4 py-3 text-right">
                        <div
                          className="relative inline-block text-left"
                          ref={actionOpenId === s.student_id ? menuRef : null}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setActionOpenId(actionOpenId === s.student_id ? null : s.student_id)
                            }
                            className={`p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${
                              actionOpenId === s.student_id ? 'bg-muted text-foreground' : ''
                            }`}
                            title="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {actionOpenId === s.student_id && (
                            <div
                              className={`absolute right-0 w-36 bg-card border rounded-xl shadow-xl py-1 z-50 animate-in fade-in-50 zoom-in-95 ${
                                i >= Math.max(1, filteredStudents.length - 2)
                                  ? 'bottom-full mb-1'
                                  : 'top-full mt-1'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActionOpenId(null)
                                  setViewStudent(s)
                                }}
                                className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2 text-foreground transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5 text-primary" />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionOpenId(null)
                                  handleOpenEdit(s)
                                }}
                                className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2 text-foreground transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5 text-amber-500" />
                                <span>Edit</span>
                              </button>
                              <div className="border-t my-1" />
                              <button
                                type="button"
                                onClick={() => {
                                  setActionOpenId(null)
                                  setDeleteStudentTarget(s)
                                }}
                                className="w-full px-3 py-1.5 text-xs text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive font-medium transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <p>
              Showing {filteredStudents.length} of {students.length} student records
            </p>
            {hasActiveFilters && (
              <p className="text-primary font-medium">Filters applied</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: ADD / EDIT STUDENT ("NICE VIEW FOR TEXT FIELDS")                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'add' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="flex items-center justify-between bg-card border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list')
                  setEditingStudent(null)
                }}
                className="p-2 rounded-xl border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Back to Student List"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {editingStudent ? `Edit Student: ${editingStudent.name}` : 'New Student Registration'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingStudent
                    ? 'Update profile details and academic status'
                    : 'Fill in the information below to enroll a new student into the institution'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('list')
                setEditingStudent(null)
              }}
              className="text-xs text-muted-foreground hover:text-foreground font-medium px-3 py-1.5 rounded-lg border hover:bg-muted"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl flex items-center gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Spacious Form Layout with Visual Field Groups */}
          <form onSubmit={handleSaveStudent} className="space-y-6">
            {/* GROUP 1: Academic & Admission Details */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Academic & Admission Details</h3>
                  <p className="text-xs text-muted-foreground">
                    Assign the student to their designated course program and cohort batch
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Admission Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" /> Admission Number *
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingStudent)}
                    value={form.admission_number}
                    onChange={(e) => setForm((f) => ({ ...f, admission_number: e.target.value }))}
                    placeholder="e.g. 2026-MED-0042"
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                  />
                  <p className="text-[11px] text-muted-foreground">Unique institutional ID</p>
                </div>

                {/* Course Program */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" /> Course / Program *
                  </label>
                  <select
                    disabled={Boolean(editingStudent)}
                    value={form.program_id}
                    onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                  >
                    <option value="">— Select Program —</option>
                    {programs.map((p) => (
                      <option key={p.program_id} value={p.program_id}>
                        {p.program_name} ({p.program_code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">Academic degree or curriculum</p>
                </div>

                {/* Batch */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" /> Academic Batch *
                  </label>
                  <select
                    disabled={Boolean(editingStudent)}
                    value={form.batch_id}
                    onChange={(e) => setForm((f) => ({ ...f, batch_id: e.target.value }))}
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                  >
                    <option value="">— Select Cohort Batch —</option>
                    {batches.map((b) => (
                      <option key={b.batch_id} value={b.batch_id}>
                        {b.batch_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">Graduation class group</p>
                </div>

                {/* Department (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Department (Optional)
                  </label>
                  <select
                    disabled={Boolean(editingStudent)}
                    value={form.department_id}
                    onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                  >
                    <option value="">— Default from Program —</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>
                        {d.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Admission Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Admission Date *
                  </label>
                  <input
                    type="date"
                    disabled={Boolean(editingStudent)}
                    value={form.admission_date}
                    onChange={(e) => setForm((f) => ({ ...f, admission_date: e.target.value }))}
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                  />
                </div>

                {/* Admission Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Admission Type</label>
                  <select
                    disabled={Boolean(editingStudent)}
                    value={form.admission_type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        admission_type: e.target.value as NonNullable<CreateStudentInput['admission_type']>,
                      }))
                    }
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                  >
                    <option value="NEW">New Admission (Regular)</option>
                    <option value="LATERAL">Lateral Entry</option>
                    <option value="TRANSFER">Transfer from Other Institute</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* GROUP 2: Personal Information */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Personal Information</h3>
                  <p className="text-xs text-muted-foreground">
                    Legal identification and demographic information of the student
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-xs font-semibold text-foreground">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender }))}
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  >
                    <option value="">— Select Gender —</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {/* Date of Birth */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Date of Birth
                  </label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* GROUP 3: Contact Details */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Contact Details</h3>
                  <p className="text-xs text-muted-foreground">
                    Phone numbers for SMS notifications, shortage alerts, and guardian communication
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student Mobile Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Student Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-muted-foreground">Used for student self-service & logins</p>
                </div>

                {/* Parent / Guardian Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Parent / Guardian Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={form.parent_phone}
                    onChange={(e) => setForm((f) => ({ ...f, parent_phone: e.target.value }))}
                    placeholder="e.g. 9876543211"
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-muted-foreground">Receives daily absence and shortage SMS alerts</p>
                </div>
              </div>
            </div>

            {/* GROUP 4: Academic Status (Editing mode) */}
            {editingStudent && (
              <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b pb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">Current Academic Standing</h3>
                    <p className="text-xs text-muted-foreground">
                      Set whether the student is active, detained, or has completed the curriculum
                    </p>
                  </div>
                </div>

                <div className="max-w-sm space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Academic Status</label>
                  <select
                    value={form.current_status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, current_status: e.target.value as StudentStatus }))
                    }
                    className="w-full border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  >
                    {(Object.keys(STATUS_COLORS) as StudentStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Form Footer Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list')
                  setEditingStudent(null)
                }}
                className="px-5 py-2.5 rounded-xl border text-sm font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                Back to Student List
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{editingStudent ? 'Update Student Record' : 'Save Student'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL 1: VIEW STUDENT DETAILS ────────────────────────────────────── */}
      {viewStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base">Student Profile</h3>
              </div>
              <button
                onClick={() => setViewStudent(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Profile Card */}
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl uppercase border border-primary/20">
                  {viewStudent.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-foreground">{viewStudent.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                        STATUS_COLORS[viewStudent.current_status]
                      }`}
                    >
                      {viewStudent.current_status}
                    </span>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                        viewStudent.face_enrolled
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {viewStudent.face_enrolled ? 'Face Enrolled' : 'Face Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted/30 p-4 rounded-xl border">
                <div>
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Hash className="h-3.5 w-3.5" /> Admission Number
                  </span>
                  <p className="font-semibold text-foreground mt-0.5 font-mono">
                    {viewStudent.admission_number || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Users className="h-3.5 w-3.5" /> Batch
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {viewStudent.batch_name || getBatchName(viewStudent.batch_id)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <BookOpen className="h-3.5 w-3.5" /> Program
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">{viewStudent.program_name || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Building2 className="h-3.5 w-3.5" /> Department
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">{viewStudent.department_name || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Phone className="h-3.5 w-3.5" /> Student Phone
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">{viewStudent.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Phone className="h-3.5 w-3.5" /> Parent Phone
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">{viewStudent.parent_phone || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Calendar className="h-3.5 w-3.5" /> Date of Birth
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">{viewStudent.date_of_birth || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <User className="h-3.5 w-3.5" /> Gender
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">{viewStudent.gender || '—'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-3 border-t bg-muted/10">
              <button
                type="button"
                onClick={() => {
                  const s = viewStudent
                  setViewStudent(null)
                  handleOpenEdit(s)
                }}
                className="px-3.5 py-1.5 text-xs rounded-xl border hover:bg-muted flex items-center gap-1.5 transition-colors font-medium"
              >
                <Pencil className="h-3.5 w-3.5 text-amber-500" /> Edit Profile
              </button>
              <button
                type="button"
                onClick={() => setViewStudent(null)}
                className="px-4 py-1.5 text-xs rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: CONFIRM DELETE POPUP ───────────────────────────────────── */}
      {deleteStudentTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-full bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Confirm Student Deletion</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to permanently delete student{' '}
                  <strong className="text-foreground">{deleteStudentTarget.name}</strong>
                  {deleteStudentTarget.admission_number ? ` (${deleteStudentTarget.admission_number})` : ''}?
                </p>
              </div>
            </div>

            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl text-xs text-destructive space-y-1">
              <p className="font-semibold">⚠️ Warning: Irreversible Operation</p>
              <p>
                This will delete the student's admission records, facial biometric training samples,
                academic enrollments, and past session attendance histories.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteStudentTarget(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting…' : 'Delete Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
