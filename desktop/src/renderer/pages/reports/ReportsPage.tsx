import { useState, useEffect, useMemo } from 'react'
import {
  BookOpen,
  Download,
  AlertTriangle,
  Users,
  Briefcase,
  Search,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
} from 'lucide-react'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'SHORTAGE' | 'WORKLOAD'>('SUMMARY')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedBatch, setSelectedBatch] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [threshold, setThreshold] = useState<number>(75)

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

  // Data
  const [studentSummary, setStudentSummary] = useState<any[]>([])
  const [shortageList, setShortageList] = useState<any[]>([])
  const [facultyWorkload, setFacultyWorkload] = useState<any[]>([])

  const loadDropdowns = async () => {
    try {
      const [ayList, batList, subList] = await Promise.all([
        window.api.academicYear.list(),
        window.api.batch.list(),
        window.api.subject.list(),
      ])
      setAcademicYears(Array.isArray(ayList) ? ayList : [])
      setBatches(Array.isArray(batList) ? batList : [])
      setSubjects(Array.isArray(subList) ? subList : [])
    } catch (err) {
      console.error('Failed to load filter dropdowns', err)
    }
  }

  const loadReportData = async () => {
    try {
      setLoading(true)
      if (activeTab === 'SUMMARY') {
        const data = await (window.api as any).report.getStudentSummary({
          batch_id: selectedBatch || undefined,
          subject_id: selectedSubject || undefined,
          academic_year_id: selectedYear || undefined,
          threshold,
        })
        setStudentSummary(Array.isArray(data) ? data : [])
      } else if (activeTab === 'SHORTAGE') {
        const data = await (window.api as any).report.getShortageReport(
          selectedBatch || undefined,
          selectedSubject || undefined,
          threshold,
          selectedYear || undefined
        )
        setShortageList(Array.isArray(data) ? data : [])
      } else if (activeTab === 'WORKLOAD') {
        const data = await (window.api as any).report.getFacultyWorkload()
        setFacultyWorkload(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to load report data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDropdowns()
  }, [])

  useEffect(() => {
    loadReportData()
    setCurrentPage(1)
  }, [activeTab, selectedYear, selectedBatch, selectedSubject, threshold])

  // Also pre-load workload for summary stats if on other tabs
  useEffect(() => {
    if (activeTab !== 'WORKLOAD' && facultyWorkload.length === 0) {
      ;(window.api as any).report.getFacultyWorkload().then((res: any) => {
        if (Array.isArray(res)) setFacultyWorkload(res)
      })
    }
  }, [activeTab])

  // Filter batches by selected academic year if applicable
  const visibleBatches = useMemo(() => {
    if (!selectedYear) return batches
    return batches.filter(
      (b: any) =>
        b.academic_year_id === selectedYear ||
        (b.batch_name && b.batch_name.includes(selectedYear.slice(0, 4)))
    )
  }, [batches, selectedYear])

  // Filtered dataset for Active Tab
  const filteredStudentSummary = useMemo(() => {
    return studentSummary.filter((s) => {
      const matchSearch =
        !search ||
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.admission_number || '').toLowerCase().includes(search.toLowerCase())
      return matchSearch
    })
  }, [studentSummary, search])

  const filteredShortage = useMemo(() => {
    return shortageList.filter((s) => {
      const matchSearch =
        !search ||
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.admission_number || '').toLowerCase().includes(search.toLowerCase())
      return matchSearch
    })
  }, [shortageList, search])

  const filteredWorkload = useMemo(() => {
    return facultyWorkload.filter((f) => {
      const matchSearch =
        !search ||
        (f.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.employee_id || '').toLowerCase().includes(search.toLowerCase())
      return matchSearch
    })
  }, [facultyWorkload, search])

  // Summary statistics metrics
  const summaryStats = useMemo(() => {
    const uniqueStudents = new Set(studentSummary.map((s) => s.student_id || s.name)).size
    const evaluatedRecords = studentSummary.filter((s) => s.total_sessions > 0)
    const avgPct =
      evaluatedRecords.length > 0
        ? Math.round(
            evaluatedRecords.reduce((acc, curr) => acc + (curr.percentage || 0), 0) /
              evaluatedRecords.length
          )
        : 0

    const shortageCount = studentSummary.filter(
      (s) => s.percentage < threshold && s.total_sessions > 0
    ).length
    const compliantCount = studentSummary.filter(
      (s) => s.percentage >= threshold && s.total_sessions > 0
    ).length
    const totalSessions = facultyWorkload.reduce((sum, f) => sum + (f.total_sessions || 0), 0)

    return {
      totalStudents: uniqueStudents || studentSummary.length,
      avgAttendance: avgPct,
      shortageCount,
      compliantCount,
      totalSessions,
    }
  }, [studentSummary, facultyWorkload, threshold])

  // Active dataset for pagination
  const currentList =
    activeTab === 'SUMMARY'
      ? filteredStudentSummary
      : activeTab === 'SHORTAGE'
      ? filteredShortage
      : filteredWorkload

  const totalPages = Math.ceil(currentList.length / pageSize) || 1
  const paginatedList = currentList.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      const dateStr = new Date().toISOString().split('T')[0]

      if (activeTab === 'SUMMARY') {
        const columns = [
          { header: 'Roll Number', key: 'admission_number' },
          { header: 'Student Name', key: 'name' },
          { header: 'Date', key: 'session_date' },
          { header: 'Gender', key: 'gender' },
          { header: 'Batch', key: 'batch_name' },
          { header: 'Subject', key: 'subject_name' },
          { header: 'Total Sessions', key: 'total_sessions' },
          { header: 'Attended', key: 'attended_sessions' },
          { header: 'Present', key: 'present_count' },
          { header: 'Late', key: 'late_count' },
          { header: 'Absent', key: 'absent_count' },
          { header: 'Attendance %', key: 'percentage' },
        ]
        const res = await (window.api as any).report.exportToExcel(
          'Student Attendance Summary',
          columns,
          filteredStudentSummary,
          `Attendance_Summary_${dateStr}.xlsx`
        )
        if (res.success) alert(`Export saved: ${res.filePath}`)
      } else if (activeTab === 'SHORTAGE') {
        const columns = [
          { header: 'Roll Number', key: 'admission_number' },
          { header: 'Student Name', key: 'name' },
          { header: 'Date', key: 'session_date' },
          { header: 'Batch', key: 'batch_name' },
          { header: 'Subject', key: 'subject_name' },
          { header: 'Total Sessions', key: 'total_sessions' },
          { header: 'Attended', key: 'attended_sessions' },
          { header: 'Current %', key: 'percentage' },
          { header: 'Classes Needed For 75%', key: 'classes_needed_for_75' },
        ]
        const res = await (window.api as any).report.exportToExcel(
          'Attendance Shortage Warning List',
          columns,
          filteredShortage,
          `Attendance_Shortage_Warning_${dateStr}.xlsx`
        )
        if (res.success) alert(`Export saved: ${res.filePath}`)
      } else if (activeTab === 'WORKLOAD') {
        const columns = [
          { header: 'Employee ID', key: 'employee_id' },
          { header: 'Faculty Name', key: 'name' },
          { header: 'Department', key: 'department_name' },
          { header: 'Total Sessions', key: 'total_sessions' },
          { header: 'Hours Delivered', key: 'total_hours' },
          { header: 'Topics Covered', key: 'topics_covered_count' },
          { header: 'Last Session Date', key: 'last_session_date' },
        ]
        const res = await (window.api as any).report.exportToExcel(
          'Faculty Workload Report',
          columns,
          filteredWorkload,
          `Faculty_Workload_${dateStr}.xlsx`
        )
        if (res.success) alert(`Export saved: ${res.filePath}`)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Institutional Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Subject-wise attendance percentages, <span className="font-semibold text-rose-600 dark:text-rose-400">75% shortage warning alerts</span>, faculty workload delivery, and Excel exports.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white font-medium text-xs sm:text-sm hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}
        </button>
      </div>

      {/* Proper Summary Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <div className="rounded-xl border border-blue-200/90 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Students Enrolled</p>
          <p className="text-2xl font-bold text-blue-950 dark:text-blue-100 mt-0.5">{summaryStats.totalStudents}</p>
          <p className="text-[11px] text-blue-600/80 dark:text-blue-400 mt-0.5">Active candidates</p>
        </div>

        <div className="rounded-xl border border-indigo-200/90 bg-indigo-50/60 dark:bg-indigo-950/20 dark:border-indigo-900/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Average Attendance</p>
          <p className="text-2xl font-bold text-indigo-950 dark:text-indigo-100 mt-0.5">{summaryStats.avgAttendance}%</p>
          <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400 mt-0.5">Across all subjects</p>
        </div>

        <div className="rounded-xl border border-rose-200/90 bg-rose-50/60 dark:bg-rose-950/20 dark:border-rose-900/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Shortage Alerts</p>
          <p className="text-2xl font-bold text-rose-950 dark:text-rose-100 mt-0.5">{summaryStats.shortageCount}</p>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400 mt-0.5">&lt; {threshold}% threshold</p>
        </div>

        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Award className="h-4 w-4" />
            </span>
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Good Attendance</p>
          <p className="text-2xl font-bold text-emerald-950 dark:text-emerald-100 mt-0.5">{summaryStats.compliantCount}</p>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">≥ {threshold}% compliant</p>
        </div>

        <div className="rounded-xl border border-amber-200/90 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/50 p-3.5 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sessions Conducted</p>
          <p className="text-2xl font-bold text-amber-950 dark:text-amber-100 mt-0.5">{summaryStats.totalSessions}</p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400 mt-0.5">Total class delivery</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => setActiveTab('SUMMARY')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
            activeTab === 'SUMMARY'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Student Attendance Summary
        </button>

        <button
          onClick={() => setActiveTab('SHORTAGE')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
            activeTab === 'SHORTAGE'
              ? 'border-destructive text-destructive'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Shortage Warning List (&lt;{threshold}%)
        </button>

        <button
          onClick={() => setActiveTab('WORKLOAD')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
            activeTab === 'WORKLOAD'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="h-3.5 w-3.5" /> Faculty Workload Tracking
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded border bg-background text-foreground"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 bg-background border rounded px-2.5 py-1">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value)
                setSelectedBatch('')
                setCurrentPage(1)
              }}
              className="text-xs bg-transparent border-0 focus:ring-0 cursor-pointer pr-1 text-foreground"
            >
              <option value="">All Academic Years</option>
              {academicYears.map((ay) => (
                <option key={ay.academic_year_id || ay.year_label} value={ay.academic_year_id || ay.year_label}>
                  {ay.year_label}
                </option>
              ))}
            </select>
          </div>

          {activeTab !== 'WORKLOAD' && (
            <>
              {/* Batch Filter */}
              <select
                value={selectedBatch}
                onChange={(e) => {
                  setSelectedBatch(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
              >
                <option value="">All Batches</option>
                {visibleBatches.map((b) => (
                  <option key={b.batch_id || b.id} value={b.batch_id || b.id}>
                    {b.batch_name || b.name}
                  </option>
                ))}
              </select>

              {/* Subject Filter */}
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.subject_id || s.id} value={s.subject_id || s.id}>
                    {s.subject_name || s.name} {s.subject_code ? `(${s.subject_code})` : ''}
                  </option>
                ))}
              </select>

              {/* Shortage Cutoff */}
              {activeTab === 'SHORTAGE' && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Cutoff:</span>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={threshold}
                    onChange={(e) => {
                      setThreshold(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="w-16 px-2 py-1 text-xs rounded border bg-background text-foreground font-mono"
                  />
                  <span>%</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Student Attendance Summary */}
      {activeTab === 'SUMMARY' && (
        <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Roll No</th>
                  <th className="px-4 py-2.5 font-medium">Student Name</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Batch</th>
                  <th className="px-4 py-2.5 font-medium">Subject</th>
                  <th className="px-4 py-2.5 font-medium text-center">Sessions</th>
                  <th className="px-4 py-2.5 font-medium text-center">Attended</th>
                  <th className="px-4 py-2.5 font-medium text-center">Present / Late / Absent</th>
                  <th className="px-4 py-2.5 font-medium text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      Calculating attendance summaries...
                    </td>
                  </tr>
                ) : paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      No student attendance data found. Complete classroom sessions to view analytics.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((s, idx) => (
                    <tr key={`${s.student_id}-${idx}`} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {s.admission_number}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">
                        {s.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                        {s.session_date || s.date || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.batch_name || 'MBBS'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.subject_name ? `${s.subject_name} ${s.subject_code ? `(${s.subject_code})` : ''}` : 'N/A'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-center font-medium">
                        {s.total_sessions}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-center font-semibold text-emerald-600">
                        {s.attended_sessions}
                      </td>
                      <td className="px-4 py-2.5 text-center text-[11px]">
                        <span className="text-emerald-600 font-medium">{s.present_count}P</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-amber-600 font-medium">{s.late_count}L</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-destructive font-medium">{s.absent_count}A</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            s.percentage >= 75.0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                        >
                          {typeof s.percentage === 'number' ? s.percentage.toFixed(1) : s.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Shortage Warning List (< 75%) */}
      {activeTab === 'SHORTAGE' && (
        <div className="space-y-3">
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-lg p-3 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span>
                <strong>Detention Risk Warning:</strong> The following students have attendance strictly below the <strong>{threshold}% statutory threshold</strong>. Minimum classes required without further absence is calculated for each candidate.
              </span>
            </div>
            <span className="font-bold text-rose-700 dark:text-rose-400">{filteredShortage.length} student(s) at risk</span>
          </div>

          <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-500/10 border-b text-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Roll No</th>
                    <th className="px-4 py-2.5 font-medium">Student Name</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Batch</th>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    <th className="px-4 py-2.5 font-medium text-center">Attended / Total</th>
                    <th className="px-4 py-2.5 font-medium text-center">Current Attendance %</th>
                    <th className="px-4 py-2.5 font-medium text-right text-destructive">Classes Needed to Reach 75%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        Scanning attendance shortage records...
                      </td>
                    </tr>
                  ) : paginatedList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        No students currently below the {threshold}% attendance threshold. Excellent compliance!
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map((s, idx) => (
                      <tr key={`shortage-${s.student_id}-${idx}`} className="hover:bg-rose-50/20 transition">
                        <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                          {s.admission_number}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-foreground">
                          {s.name}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                          {s.session_date || s.date || '-'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {s.batch_name || 'MBBS'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {s.subject_name ? `${s.subject_name} ${s.subject_code ? `(${s.subject_code})` : ''}` : 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-center">
                          <span className="font-semibold text-destructive">{s.attended_sessions}</span>
                          <span className="text-muted-foreground"> / {s.total_sessions}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                            {typeof s.percentage === 'number' ? s.percentage.toFixed(1) : s.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-destructive">
                          +{s.classes_needed_for_75} consecutive class(es)
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Faculty Workload */}
      {activeTab === 'WORKLOAD' && (
        <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Emp ID</th>
                  <th className="px-4 py-2.5 font-medium">Faculty Name</th>
                  <th className="px-4 py-2.5 font-medium">Department</th>
                  <th className="px-4 py-2.5 font-medium text-center">Total Sessions Delivered</th>
                  <th className="px-4 py-2.5 font-medium text-center">Total Hours</th>
                  <th className="px-4 py-2.5 font-medium text-center">Topics Covered</th>
                  <th className="px-4 py-2.5 font-medium text-right">Last Active Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aggregating faculty delivery metrics...
                    </td>
                  </tr>
                ) : paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No faculty workload records found.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((f) => (
                    <tr key={f.faculty_id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {f.employee_id}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">
                        {f.name}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {f.department_name || 'General Surgery'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-center font-semibold text-foreground">
                        {f.total_sessions}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-center font-medium text-indigo-600 dark:text-indigo-400">
                        {f.total_hours}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-center text-muted-foreground">
                        {f.topics_covered_count}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                        {f.last_session_date}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {currentList.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card border rounded-lg text-xs text-muted-foreground shadow-sm">
          <div>
            Showing <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-foreground">
              {Math.min(currentPage * pageSize, currentList.length)}
            </span>{' '}
            of <span className="font-semibold text-foreground">{currentList.length}</span> records
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 py-1 rounded border bg-background text-foreground text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="p-1 rounded border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-medium text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="p-1 rounded border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

