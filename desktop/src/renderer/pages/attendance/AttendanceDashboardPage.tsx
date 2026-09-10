import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Plus,
  Play,
  CheckCircle2,
  Calendar,
  Users,
  Search,
  Building2,
  GraduationCap,
  BookOpen,
  RotateCcw,
  X,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export default function AttendanceDashboardPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Master lists for modal & filters
  const [departments, setDepartments] = useState<any[]>([])
  const [faculties, setFaculties] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])

  // Filter States (Ordered: 1. Dept -> 2. Batch -> 3. Subject -> 4. Faculty -> 5. Status)
  const [selectedDepartment, setSelectedDepartment] = useState('ALL')
  const [selectedBatch, setSelectedBatch] = useState('ALL')
  const [selectedSubject, setSelectedSubject] = useState('ALL')
  const [selectedFaculty, setSelectedFaculty] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Export dropdown & loading states
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Modal form state
  const [formData, setFormData] = useState({
    faculty_id: '',
    subject_id: '',
    batch_id: '',
    academic_year_id: '',
    topic_id: '',
    session_date: new Date().toISOString().split('T')[0],
    start_time: new Date().toTimeString().split(' ')[0],
    topic_notes: '',
  })

  const fetchSessions = async () => {
    try {
      setLoading(true)
      const list = await (window.api as any).attendance.listSessions()
      setSessions(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadDropdownData = async () => {
    try {
      const [facList, subList, batList, ayList, deptList] = await Promise.all([
        window.api.faculty.list(),
        window.api.subject.list(),
        window.api.batch.list(),
        window.api.academicYear.list(),
        window.api.department.list(),
      ])
      setFaculties(facList)
      setSubjects(subList)
      setBatches(batList)
      setAcademicYears(ayList)
      setDepartments(deptList || [])

      if (facList.length > 0 && !formData.faculty_id) {
        setFormData((prev) => ({
          ...prev,
          faculty_id: facList[0].faculty_id,
          subject_id: subList[0]?.subject_id || '',
          batch_id: batList[0]?.batch_id || '',
          academic_year_id: ayList[0]?.academic_year_id || '',
        }))
      }
    } catch (e) {
      console.error('Failed to load form dropdowns', e)
    }
  }

  useEffect(() => {
    fetchSessions()
    loadDropdownData()
  }, [])

  useEffect(() => {
    if (formData.subject_id) {
      window.api.topic.list(formData.subject_id).then((t) => setTopics(t)).catch(() => setTopics([]))
    }
  }, [formData.subject_id])

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newSession = await (window.api as any).attendance.createSession(formData)
      setShowCreateModal(false)
      navigate(`/attendance/session/${newSession.session_id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create session')
    }
  }

  const hasActiveFilters =
    selectedDepartment !== 'ALL' ||
    selectedBatch !== 'ALL' ||
    selectedSubject !== 'ALL' ||
    selectedFaculty !== 'ALL' ||
    statusFilter !== 'ALL' ||
    searchQuery.trim().length > 0

  const handleResetFilters = () => {
    setSelectedDepartment('ALL')
    setSelectedBatch('ALL')
    setSelectedSubject('ALL')
    setSelectedFaculty('ALL')
    setStatusFilter('ALL')
    setSearchQuery('')
    setPage(1)
  }

  const filteredSessions = sessions.filter((s) => {
    // Only submitted/completed sessions should show in admin, not OPEN sessions
    if (s.status === 'OPEN' || s.status === 'IN_PROGRESS') {
      return false
    }
    if (selectedDepartment !== 'ALL') {
      if (s.department_id !== selectedDepartment) {
        return false
      }
    }
    // 2. Batch Filter
    if (selectedBatch !== 'ALL') {
      if (s.batch_id !== selectedBatch) {
        return false
      }
    }
    // 3. Subject Filter
    if (selectedSubject !== 'ALL') {
      if (s.subject_id !== selectedSubject) {
        return false
      }
    }
    // 4. Faculty Filter
    if (selectedFaculty !== 'ALL') {
      if (s.faculty_id !== selectedFaculty) {
        return false
      }
    }
    // 5. Status Filter
    if (statusFilter !== 'ALL' && s.status !== statusFilter) {
      return false
    }
    // 6. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchSub = (s.subject_name || '').toLowerCase().includes(q)
      const matchCode = (s.subject_code || '').toLowerCase().includes(q)
      const matchBatch = (s.batch_name || '').toLowerCase().includes(q)
      const matchFac = (s.faculty_name || '').toLowerCase().includes(q)
      const matchDept = (s.department_name || '').toLowerCase().includes(q)
      const matchDate = (s.session_date || '').toLowerCase().includes(q)
      const matchTopic = (s.custom_topic || s.topic_name || s.topic_notes || '').toLowerCase().includes(q)
      return matchSub || matchCode || matchBatch || matchFac || matchDept || matchDate || matchTopic
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize))
  const paginatedSessions = filteredSessions.slice((page - 1) * pageSize, page * pageSize)

  const exportColumns = [
    { header: 'Session Date', key: 'session_date', width: 14 },
    { header: 'Start Time', key: 'start_time', width: 12 },
    { header: 'End Time', key: 'end_time', width: 12 },
    { header: 'Department', key: 'department_name', width: 22 },
    { header: 'Subject Code', key: 'subject_code', width: 14 },
    { header: 'Subject Name', key: 'subject_name', width: 26 },
    { header: 'Batch', key: 'batch_name', width: 20 },
    { header: 'Faculty', key: 'faculty_name', width: 22 },
    { header: 'Topic Covered', key: 'topic_display', width: 28 },
    { header: 'Total Students', key: 'total_students', width: 14 },
    { header: 'Present', key: 'present_count', width: 12 },
    { header: 'Absent', key: 'absent_count', width: 12 },
    { header: 'Attendance %', key: 'attendance_pct', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Sync Status', key: 'sync_status', width: 14 },
  ]

  const prepareExportRows = () => {
    return filteredSessions.map((s) => {
      const pct = s.total_students > 0 ? `${Math.round((s.present_count / s.total_students) * 100)}%` : '0%'
      const topicDisplay = s.custom_topic || s.topic_name || s.topic_notes || '—'
      return {
        session_date: s.session_date || '',
        start_time: s.start_time || '',
        end_time: s.end_time || '',
        department_name: s.department_name || 'General',
        subject_code: s.subject_code || '',
        subject_name: s.subject_name || '',
        batch_name: s.batch_name || '',
        faculty_name: s.faculty_name || '',
        topic_display: topicDisplay,
        total_students: s.total_students || 0,
        present_count: s.present_count || 0,
        absent_count: s.absent_count || 0,
        attendance_pct: pct,
        status: s.status || '',
        sync_status: s.sync_status || 'PENDING',
      }
    })
  }

  const handleExportExcel = async () => {
    setShowExportMenu(false)
    if (filteredSessions.length === 0) {
      alert('No sessions available to export.')
      return
    }
    setIsExporting(true)
    try {
      const dateStr = new Date().toISOString().split('T')[0]
      const rows = prepareExportRows()
      const res = await (window.api as any).report.exportToExcel(
        'Class Attendance Sessions',
        exportColumns,
        rows,
        `Class_Attendance_Sessions_${dateStr}.xlsx`
      )
      if (res?.success) {
        alert(`Excel export saved successfully:\n${res.filePath}`)
      } else if (res?.message && res.message !== 'Export cancelled') {
        alert(`Export failed: ${res.message}`)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPdf = async () => {
    setShowExportMenu(false)
    if (filteredSessions.length === 0) {
      alert('No sessions available to export.')
      return
    }
    setIsExporting(true)
    try {
      const dateStr = new Date().toISOString().split('T')[0]
      const rows = prepareExportRows()
      const res = await (window.api as any).report.exportToPdf(
        'Class Attendance Sessions',
        exportColumns,
        rows,
        `Class_Attendance_Sessions_${dateStr}.pdf`
      )
      if (res?.success) {
        alert(`PDF export saved successfully:\n${res.filePath}`)
      } else if (res?.message && res.message !== 'Export cancelled') {
        alert(`Export failed: ${res.message}`)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export PDF')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Toolbar (Ordered: 1. Dept -> 2. Batch -> 3. Subject -> 4. Faculty -> 5. Status) */}
      <div className="bg-card border rounded-lg p-3.5 shadow-sm space-y-3">
        {/* Top line: Search input + active counter + reset button + Export dropdown + Start New Class Session */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search topic, subject, faculty, department, date..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-8 py-1.5 border rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setPage(1) }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap px-1">
              Showing <strong className="text-foreground">{filteredSessions.length}</strong> of {sessions.length} sessions
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors whitespace-nowrap"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Filters
              </button>
            )}

            {/* Export Dropdown */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                type="button"
                disabled={isExporting || filteredSessions.length === 0}
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={filteredSessions.length === 0 ? 'No records to export' : 'Export filtered records'}
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-primary" />
                )}
                <span>Export</span>
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-150 ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-48 rounded-md bg-card border shadow-lg z-30 py-1 text-xs animate-in fade-in-50 zoom-in-95">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-border/60">
                    Export {filteredSessions.length} record{filteredSessions.length === 1 ? '' : 's'}
                  </div>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted text-foreground transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-medium">Excel (.xlsx)</span>
                      <span className="text-[10px] text-muted-foreground">Download spreadsheet</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted text-foreground transition-colors"
                  >
                    <FileText className="h-4 w-4 text-red-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-medium">PDF (.pdf)</span>
                      <span className="text-[10px] text-muted-foreground">Printable document</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Start New Class Session
            </button>
          </div>
        </div>

        {/* Bottom line: 5 Ordered Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-border/60">
          {/* 1. Department */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-primary" />
              1. Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => { setSelectedDepartment(e.target.value); setPage(1) }}
              className="w-full border rounded-md px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 truncate"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.department_name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Batch */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <GraduationCap className="h-3 w-3 text-primary" />
              2. Batch
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => { setSelectedBatch(e.target.value); setPage(1) }}
              className="w-full border rounded-md px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 truncate"
            >
              <option value="ALL">All Batches</option>
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Subject */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <BookOpen className="h-3 w-3 text-primary" />
              3. Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); setPage(1) }}
              className="w-full border rounded-md px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 truncate"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.subject_id} value={sub.subject_id}>
                  {sub.subject_name} {sub.subject_code ? `(${sub.subject_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Faculty */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Users className="h-3 w-3 text-primary" />
              4. Faculty
            </label>
            <select
              value={selectedFaculty}
              onChange={(e) => { setSelectedFaculty(e.target.value); setPage(1) }}
              className="w-full border rounded-md px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 truncate"
            >
              <option value="ALL">All Faculty</option>
              {faculties.map((f) => (
                <option key={f.faculty_id} value={f.faculty_id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Status */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              5. Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full border rounded-md px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="COMPLETED">Completed</option>
              <option value="LOCKED">Locked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sessions Table (Row-wise View) */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading attendance sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-card border-dashed">
          <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No Attendance Sessions Yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Start a new classroom session to freeze the student roster and take attendance via face recognition or manual entry.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Create First Session
          </button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-card p-6">
          <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <h4 className="text-sm font-semibold text-foreground">No sessions match the selected filters</h4>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Try adjusting or clearing your active filters to view more records.</p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/60 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4">Faculty</th>
                  <th className="py-3 px-4">Topic Covered</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedSessions.map((s) => {
                  const isCompleted = s.status === 'SUBMITTED' || s.status === 'LOCKED'
                  const pct = s.total_students > 0 ? Math.round((s.present_count / s.total_students) * 100) : 0
                  const topicDisplay = s.custom_topic || s.topic_name || s.topic_notes || '—'

                  return (
                    <tr
                      key={s.session_id}
                      onClick={() => navigate(`/attendance/session/${s.session_id}`)}
                      className="hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{s.session_date}</span>
                        </div>
                        <div className="text-xs text-muted-foreground pl-5">
                          {s.start_time} {s.end_time ? `– ${s.end_time}` : ''}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.department_name || 'General'}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <span>{s.subject_name || 'Subject Session'}</span>
                          {s.subject_code && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {s.subject_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <GraduationCap className="h-3.5 w-3.5" />
                          <span className="font-medium text-foreground">{s.batch_name || '—'}</span>
                        </div>
                      </td>

                      {/* Faculty */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Users className="h-3.5 w-3.5" />
                          <span>{s.faculty_name || '—'}</span>
                        </div>
                      </td>

                      {/* Topic */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <span className="text-xs text-foreground line-clamp-1" title={topicDisplay}>
                          {topicDisplay}
                        </span>
                      </td>

                      {/* Attendance (Present / Absent / %) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {s.present_count} P
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="font-semibold text-destructive">
                            {s.absent_count} A
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground ml-1">
                            {pct}%
                          </span>
                        </div>
                        <div className="w-24 bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}
                          >
                            {s.status}
                          </span>
                          {s.sync_status === 'SYNCED' && (
                            <span className="text-[10px] font-medium text-sky-600 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 px-1 rounded">
                              Cloud
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/attendance/session/${s.session_id}`)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary group-hover:bg-primary/10 rounded transition-colors"
                        >
                          Open <Play className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredSessions.length)} of {filteredSessions.length} sessions
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border text-xs disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs font-medium">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded border text-xs disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-foreground">Open Attendance Session</h2>
            <p className="text-xs text-muted-foreground">
              Opening a session will immediately snapshot all active enrolled students and pre-create an ABSENT record for each (Option A).
            </p>

            <form onSubmit={handleCreateSession} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Faculty Member</label>
                <select
                  required
                  value={formData.faculty_id}
                  onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded border bg-background text-foreground"
                >
                  <option value="">-- Select Faculty --</option>
                  {faculties.map((f) => (
                    <option key={f.faculty_id} value={f.faculty_id}>
                      {f.name} ({f.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Subject</label>
                <select
                  required
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded border bg-background text-foreground"
                >
                  <option value="">-- Select Subject --</option>
                  {subjects.map((sub) => (
                    <option key={sub.subject_id} value={sub.subject_id}>
                      {sub.subject_name} ({sub.subject_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Batch</label>
                  <select
                    required
                    value={formData.batch_id}
                    onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs rounded border bg-background text-foreground"
                  >
                    <option value="">-- Select Batch --</option>
                    {batches.map((b) => (
                      <option key={b.batch_id} value={b.batch_id}>
                        {b.batch_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Academic Year</label>
                  <select
                    required
                    value={formData.academic_year_id}
                    onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs rounded border bg-background text-foreground"
                  >
                    <option value="">-- Select Year --</option>
                    {academicYears.map((ay) => (
                      <option key={ay.academic_year_id} value={ay.academic_year_id}>
                        {ay.year_label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {topics.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-foreground">Topic Covered</label>
                  <select
                    value={formData.topic_id}
                    onChange={(e) => setFormData({ ...formData, topic_id: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs rounded border bg-background text-foreground"
                  >
                    <option value="">-- Optional: Select Topic --</option>
                    {topics.map((t) => (
                      <option key={t.topic_id} value={t.topic_id}>
                        {t.unit_name ? `[${t.unit_name}] ` : ''}{t.topic_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Freeze Roster & Start Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
