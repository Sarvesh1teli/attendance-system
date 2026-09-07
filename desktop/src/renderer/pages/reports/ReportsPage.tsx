import { useState, useEffect } from 'react'
import {
  BookOpen,
  Download,
  AlertTriangle,
  Users,
  Briefcase,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpDown
} from 'lucide-react'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'SHORTAGE' | 'WORKLOAD'>('SUMMARY')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [batches, setBatches] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedBatch, setSelectedBatch] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [threshold, setThreshold] = useState<number>(75)

  // Data
  const [studentSummary, setStudentSummary] = useState<any[]>([])
  const [shortageList, setShortageList] = useState<any[]>([])
  const [facultyWorkload, setFacultyWorkload] = useState<any[]>([])

  const loadDropdowns = async () => {
    try {
      const [batList, subList] = await Promise.all([
        window.api.batch.list(),
        window.api.subject.list(),
      ])
      setBatches(batList)
      setSubjects(subList)
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
          threshold,
        })
        setStudentSummary(data)
      } else if (activeTab === 'SHORTAGE') {
        const data = await (window.api as any).report.getShortageReport(
          selectedBatch || undefined,
          selectedSubject || undefined,
          threshold
        )
        setShortageList(data)
      } else if (activeTab === 'WORKLOAD') {
        const data = await (window.api as any).report.getFacultyWorkload()
        setFacultyWorkload(data)
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
  }, [activeTab, selectedBatch, selectedSubject, threshold])

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      const dateStr = new Date().toISOString().split('T')[0]

      if (activeTab === 'SUMMARY') {
        const columns = [
          { header: 'Roll Number', key: 'admission_number', width: 18 },
          { header: 'Student Name', key: 'name', width: 26 },
          { header: 'Gender', key: 'gender', width: 12 },
          { header: 'Batch', key: 'batch_name', width: 22 },
          { header: 'Subject', key: 'subject_name', width: 26 },
          { header: 'Total Sessions', key: 'total_sessions', width: 16 },
          { header: 'Attended', key: 'attended_sessions', width: 14 },
          { header: 'Present', key: 'present_count', width: 12 },
          { header: 'Late', key: 'late_count', width: 12 },
          { header: 'Absent', key: 'absent_count', width: 12 },
          { header: 'Attendance %', key: 'percentage', width: 16 },
        ]
        const res = await (window.api as any).report.exportToExcel(
          'Student Attendance Summary',
          columns,
          studentSummary,
          `Attendance_Summary_${dateStr}.xlsx`
        )
        if (res.success) alert(`Export saved: ${res.filePath}`)
      } else if (activeTab === 'SHORTAGE') {
        const columns = [
          { header: 'Roll Number', key: 'admission_number', width: 18 },
          { header: 'Student Name', key: 'name', width: 26 },
          { header: 'Batch', key: 'batch_name', width: 22 },
          { header: 'Subject', key: 'subject_name', width: 26 },
          { header: 'Total Sessions', key: 'total_sessions', width: 16 },
          { header: 'Attended', key: 'attended_sessions', width: 14 },
          { header: 'Current %', key: 'percentage', width: 14 },
          { header: 'Classes Needed For 75%', key: 'classes_needed_for_75', width: 24 },
        ]
        const res = await (window.api as any).report.exportToExcel(
          'Attendance Shortage Warning List',
          columns,
          shortageList,
          `Attendance_Shortage_Warning_${dateStr}.xlsx`
        )
        if (res.success) alert(`Export saved: ${res.filePath}`)
      } else if (activeTab === 'WORKLOAD') {
        const columns = [
          { header: 'Employee ID', key: 'employee_id', width: 18 },
          { header: 'Faculty Name', key: 'name', width: 26 },
          { header: 'Department', key: 'department_name', width: 22 },
          { header: 'Total Sessions', key: 'total_sessions', width: 16 },
          { header: 'Hours Delivered', key: 'total_hours', width: 18 },
          { header: 'Topics Covered', key: 'topics_covered_count', width: 18 },
          { header: 'Last Session Date', key: 'last_session_date', width: 20 },
        ]
        const res = await (window.api as any).report.exportToExcel(
          'Faculty Workload Report',
          columns,
          facultyWorkload,
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

  const filteredStudentSummary = studentSummary.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(search.toLowerCase())
  )

  const filteredShortage = shortageList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(search.toLowerCase())
  )

  const filteredWorkload = facultyWorkload.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.employee_id.toLowerCase().includes(search.toLowerCase())
  )

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
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}
        </button>
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded border bg-background text-foreground"
          />
        </div>

        {activeTab !== 'WORKLOAD' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_name}
                </option>
              ))}
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.subject_name} ({s.subject_code})
                </option>
              ))}
            </select>

            {activeTab === 'SHORTAGE' && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Cutoff:</span>
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-xs rounded border bg-background text-foreground font-mono"
                />
                <span>%</span>
              </div>
            )}
          </div>
        )}
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
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      Calculating attendance summaries...
                    </td>
                  </tr>
                ) : filteredStudentSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No student attendance data found. Complete classroom sessions to view analytics.
                    </td>
                  </tr>
                ) : (
                  filteredStudentSummary.map((s, idx) => (
                    <tr key={`${s.student_id}-${idx}`} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {s.admission_number}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">
                        {s.name}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.batch_name || 'N/A'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.subject_name ? `${s.subject_name} (${s.subject_code})` : 'N/A'}
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
                          {s.percentage.toFixed(1)}%
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
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        Scanning attendance shortage records...
                      </td>
                    </tr>
                  ) : filteredShortage.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        No students currently below the {threshold}% attendance threshold. Excellent compliance!
                      </td>
                    </tr>
                  ) : (
                    filteredShortage.map((s, idx) => (
                      <tr key={`shortage-${s.student_id}-${idx}`} className="hover:bg-rose-50/20 transition">
                        <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                          {s.admission_number}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-foreground">
                          {s.name}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {s.batch_name || 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {s.subject_name ? `${s.subject_name} (${s.subject_code})` : 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-center">
                          <span className="font-semibold text-destructive">{s.attended_sessions}</span>
                          <span className="text-muted-foreground"> / {s.total_sessions}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                            {s.percentage.toFixed(1)}%
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
                ) : filteredWorkload.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No faculty workload records found.
                    </td>
                  </tr>
                ) : (
                  filteredWorkload.map((f) => (
                    <tr key={f.faculty_id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {f.employee_id}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">
                        {f.name}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {f.department_name || 'General'}
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
    </div>
  )
}
